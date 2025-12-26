
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Scene, StoryboardState, ProductAsset, HistoryItem } from './types';
import { geminiService } from './services/geminiService';
import { SceneCard } from './components/SceneCard';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true); // 默认假设有 key，避免初始闪烁
  const [state, setState] = useState<StoryboardState>({
    plot: '',
    cameraStyle: '',
    sceneCount: 5,
    scenes: [],
    productAssets: [],
    history: [],
    isGeneratingText: false,
    videoResolution: '720p',
    videoDuration: 5,
  });

  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.history]);

  const addHistory = (action: string) => {
    setState(prev => ({
      ...prev,
      history: [...prev.history, { id: uuidv4(), timestamp: Date.now(), action }]
    }));
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // 触发后立即假设成功，遵循 SDK 竞态处理建议
      setHasKey(true);
      addHistory("已触发 API Key 选择对话框");
    }
  };

  const handleGenerateScript = async () => {
    if (!state.plot.trim()) return;
    setState(prev => ({ ...prev, isGeneratingText: true }));
    addHistory(`开始生成脚本：${state.plot.substring(0, 20)}...`);
    try {
      const generated = await geminiService.generateScenes(state.plot, state.cameraStyle, state.sceneCount, state.productAssets);
      const newScenes: Scene[] = generated.map((s, idx) => ({
        id: uuidv4(),
        sceneNumber: s.sceneNumber || idx + 1,
        description: s.description || '',
        cameraAngle: s.cameraAngle || '',
        lighting: s.lighting || '',
        productAction: s.productAction || '',
        isGenerating: false,
        isVideoGenerating: false
      }));
      setState(prev => ({ ...prev, scenes: newScenes, isGeneratingText: false }));
      addHistory(`脚本生成成功（共 ${newScenes.length} 个分镜）`);
    } catch (error) {
      console.error(error);
      alert('脚本生成失败。');
      setState(prev => ({ ...prev, isGeneratingText: false }));
      addHistory("脚本生成失败");
    }
  };

  const handleRegenerateSceneText = async (id: string) => {
    const targetScene = state.scenes.find(s => s.id === id);
    if (!targetScene) return;

    handleUpdateScene(id, { isGenerating: true });
    addHistory(`重新设计第 ${targetScene.sceneNumber} 场脚本`);
    try {
      const updatedData = await geminiService.regenerateSingleScene(
        state.plot,
        state.cameraStyle,
        targetScene.sceneNumber,
        targetScene.description
      );
      handleUpdateScene(id, {
        ...updatedData,
        isGenerating: false,
        imageUrl: undefined,
        videoUrl: undefined
      });
      addHistory(`第 ${targetScene.sceneNumber} 场脚本已更新`);
    } catch (error) {
      handleUpdateScene(id, { isGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场脚本更新失败`);
    }
  };

  const handleDeleteScene = (id: string) => {
    const sceneToDelete = state.scenes.find(s => s.id === id);
    if (!sceneToDelete) return;
    if (window.confirm(`确定删除第 ${sceneToDelete.sceneNumber} 场分镜吗？`)) {
      setState(prev => ({
        ...prev,
        scenes: prev.scenes.filter(s => s.id !== id).map((s, idx) => ({ ...s, sceneNumber: idx + 1 }))
      }));
      addHistory(`已删除第 ${sceneToDelete.sceneNumber} 场分镜`);
    }
  };

  const handleUpdateScene = (id: string, updates: Partial<Scene>) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const handleGenerateSceneImage = async (id: string) => {
    const targetScene = state.scenes.find(s => s.id === id);
    if (!targetScene) return;
    handleUpdateScene(id, { isGenerating: true });
    addHistory(`生成第 ${targetScene.sceneNumber} 场静态分镜`);
    try {
      const imageUrl = await geminiService.generateImage(targetScene, state.productAssets);
      handleUpdateScene(id, { imageUrl, isGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场静态分镜渲染完成`);
    } catch (error) {
      handleUpdateScene(id, { isGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场静态分镜生成失败`);
    }
  };

  const handleGenerateSceneVideo = async (id: string) => {
    if (window.aistudio) {
      const active = await window.aistudio.hasSelectedApiKey();
      if (!active) {
        await handleOpenKeyDialog();
        return;
      }
    }

    const targetScene = state.scenes.find(s => s.id === id);
    if (!targetScene) return;
    handleUpdateScene(id, { isVideoGenerating: true });
    addHistory(`渲染第 ${targetScene.sceneNumber} 场视频 (${state.videoDuration}秒)`);
    try {
      const videoUrl = await geminiService.generateVideo(targetScene, state.productAssets, state.videoResolution, state.videoDuration);
      handleUpdateScene(id, { videoUrl, isVideoGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场视频生成完成`);
    } catch (error: any) {
      console.error("Video Generation Error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("项目授权已过期或无效，请重新选择 API Key。");
      } else {
        alert("视频生成失败，请检查控制台或稍后重试。");
      }
      handleUpdateScene(id, { isVideoGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场视频生成失败`);
    }
  };

  const handleGenerateAllVideos = async () => {
    if (state.scenes.length === 0) return;
    const confirmRender = window.confirm(`即将顺序生成 ${state.scenes.length} 个视频（每个约需2-3分钟），确定继续吗？`);
    if (!confirmRender) return;
    for (const scene of state.scenes) {
      // 如果已经有视频了，跳过以节省资源
      if (scene.videoUrl) continue;
      await handleGenerateSceneVideo(scene.id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const asset: ProductAsset = {
            id: uuidv4(),
            type: file.type.startsWith('video') ? 'video' : 'image',
            data: reader.result as string,
            mimeType: file.type
          };
          setState(prev => ({ ...prev, productAssets: [...prev.productAssets, asset] }));
          addHistory(`添加参考：${file.name}`);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAsset = (id: string) => {
    setState(prev => ({
      ...prev,
      productAssets: prev.productAssets.filter(a => a.id !== id)
    }));
    addHistory("移除参考资源");
  };

  const downloadAllVideos = () => {
    const scenesWithVideos = state.scenes.filter(s => !!s.videoUrl);
    if (scenesWithVideos.length === 0) {
      alert("尚未生成任何视频。");
      return;
    }
    addHistory("顺序下载所有视频...");
    scenesWithVideos.forEach((scene, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = scene.videoUrl!;
        link.download = `S${scene.sceneNumber.toString().padStart(2, '0')}_Scene.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 800);
    });
  };

  const exportAllDescriptions = () => {
    if (state.scenes.length === 0) {
      alert("尚未生成脚本内容。");
      return;
    }
    const content = state.scenes.map(s => (
      `场次 ${s.sceneNumber}\n` +
      `镜头构图: ${s.cameraAngle}\n` +
      `画面描述: ${s.description}\n` +
      `灯光氛围: ${s.lighting}\n` +
      `产品动作: ${s.productAction}\n` +
      `--------------------------\n`
    )).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `分镜脚本_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addHistory("导出了全部分镜描述文本");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
      {!hasKey && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[2.5rem] p-12 max-w-md shadow-2xl">
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">需要付费 API Key</h2>
            <p className="text-slate-500 mb-10 font-medium leading-relaxed">检测到未选择有效的 API Key。Veo 视频生成必须关联一个开启结算的付费项目。</p>
            <button onClick={handleOpenKeyDialog} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transform transition hover:scale-105 active:scale-95">选择 API Key</button>
            <p className="mt-6 text-[11px] text-slate-400 font-bold">请查阅 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline text-indigo-500">账单文档</a> 获取更多信息</p>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tighter">AI 分镜大师</h1>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-0.5">Mobile Video Pro v5.1</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={exportAllDescriptions}
                disabled={state.scenes.length === 0}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                导出脚本
              </button>
              <button 
                onClick={downloadAllVideos}
                disabled={state.scenes.filter(s => !!s.videoUrl).length === 0}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 disabled:opacity-30 transition-all"
              >
                下载所有视频
              </button>
              <button 
                onClick={handleGenerateAllVideos}
                disabled={state.scenes.length === 0}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all"
              >
                一键渲染全部
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剧情描述 & 风格</label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <textarea
                  className="w-full h-24 p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-sm outline-none bg-slate-50/50 font-medium leading-relaxed resize-none"
                  placeholder="输入您的视频创意大纲..."
                  value={state.plot}
                  onChange={(e) => setState(prev => ({ ...prev, plot: e.target.value }))}
                />
                <textarea
                  className="w-full h-24 p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm outline-none bg-indigo-50/10 font-medium leading-relaxed resize-none"
                  placeholder="镜头风格要求 (如：快剪、极简、暖色)..."
                  value={state.cameraStyle}
                  onChange={(e) => setState(prev => ({ ...prev, cameraStyle: e.target.value }))}
                />
              </div>
            </div>

            <div className="md:col-span-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">产品参考素材</label>
                {state.productAssets.length > 0 && (
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    结构一致性已激活
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <label className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 bg-slate-50 cursor-pointer transition-all">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileUpload} />
                </label>
                {state.productAssets.map(asset => (
                  <div key={asset.id} className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 group border border-slate-200">
                    {asset.type === 'image' ? (
                      <img src={asset.data} className="w-full h-full object-cover" />
                    ) : (
                      <video src={asset.data} className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => removeAsset(asset.id)} className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                       <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 flex items-end gap-3">
              <div className="flex-grow grid grid-cols-3 gap-3">
                <div className="bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">分辨率</span>
                  <select 
                    className="w-full bg-transparent font-black text-slate-800 text-xs outline-none appearance-none cursor-pointer"
                    value={state.videoResolution}
                    onChange={(e) => setState(prev => ({ ...prev, videoResolution: e.target.value as '720p' | '1080p' }))}
                  >
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p FHD</option>
                  </select>
                </div>
                <div className="bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">时长</span>
                  <select 
                    className="w-full bg-transparent font-black text-slate-800 text-xs outline-none appearance-none cursor-pointer"
                    value={state.videoDuration}
                    onChange={(e) => setState(prev => ({ ...prev, videoDuration: parseInt(e.target.value) as any }))}
                  >
                    <option value={5}>5秒</option>
                    <option value={10}>10秒</option>
                    <option value={15}>15秒</option>
                  </select>
                </div>
                <div className="bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">分镜数</span>
                  <input
                    type="number"
                    className="w-full bg-transparent font-black text-slate-800 text-xs outline-none"
                    value={state.sceneCount}
                    onChange={(e) => setState(prev => ({ ...prev, sceneCount: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                  />
                </div>
              </div>
              <button
                onClick={handleGenerateScript}
                disabled={state.isGeneratingText || !state.plot}
                className="px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-3 active:scale-95"
              >
                {state.isGeneratingText ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '生成脚本'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-[1600px] mx-auto w-full p-8 overflow-y-auto">
        {state.scenes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {state.scenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                onUpdate={handleUpdateScene}
                onGenerateImage={handleGenerateSceneImage}
                onGenerateVideo={handleGenerateSceneVideo}
                onRegenerateText={handleRegenerateSceneText}
                onDelete={handleDeleteScene}
              />
            ))}
          </div>
        )}

        <div className="mt-20 border-t border-slate-200 pt-10 pb-20">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">工作流日志</label>
          <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl max-h-60 overflow-y-auto font-mono text-xs text-indigo-200/60 leading-relaxed scrollbar-hide">
            {state.history.length === 0 ? (
              <div className="italic text-slate-700">等待操作中...</div>
            ) : (
              state.history.map(item => (
                <div key={item.id} className="flex gap-4 mb-2 hover:text-indigo-300 transition-colors">
                  <span className="opacity-30 whitespace-nowrap">[{new Date(item.timestamp).toLocaleTimeString()}]</span>
                  <span className="text-indigo-100/90 font-medium">{item.action}</span>
                </div>
              ))
            )}
            <div ref={historyEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
