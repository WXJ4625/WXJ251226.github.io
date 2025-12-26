
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
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [state, setState] = useState<StoryboardState>({
    plot: '',
    cameraStyle: '',
    sceneCount: 5,
    scenes: [],
    productAssets: [],
    history: [],
    isGeneratingText: false,
    videoResolution: '720p',
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
      setHasKey(true);
      addHistory("已选择 API Key");
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
        imageUrl: undefined, // 重写脚本后清除旧图
        videoUrl: undefined  // 重写脚本后清除旧视频
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
    if (!hasKey) {
      handleOpenKeyDialog();
      return;
    }
    const targetScene = state.scenes.find(s => s.id === id);
    if (!targetScene) return;
    handleUpdateScene(id, { isVideoGenerating: true });
    addHistory(`开始渲染第 ${targetScene.sceneNumber} 场视频 (耗时较长)`);
    try {
      const videoUrl = await geminiService.generateVideo(targetScene, state.productAssets, state.videoResolution);
      handleUpdateScene(id, { videoUrl, isVideoGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场视频生成完成`);
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("API Key 无效或已过期，请重新选择付费项目 Key。");
      } else {
        alert("视频生成失败。");
      }
      handleUpdateScene(id, { isVideoGenerating: false });
      addHistory(`第 ${targetScene.sceneNumber} 场视频生成失败`);
    }
  };

  const handleGenerateAllVideos = async () => {
    if (state.scenes.length === 0) return;
    const confirmRender = window.confirm(`即将生成 ${state.scenes.length} 个视频，这可能需要较长时间，确定继续吗？`);
    if (!confirmRender) return;
    for (const scene of state.scenes) {
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
          addHistory(`已添加产品参考：${file.name}`);
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
    addHistory("移除了一项产品参考资源");
  };

  const downloadAllVideos = () => {
    const scenesWithVideos = state.scenes.filter(s => !!s.videoUrl);
    if (scenesWithVideos.length === 0) {
      alert("尚未生成任何视频。");
      return;
    }
    addHistory("正在打包导出所有视频...");
    scenesWithVideos.forEach((scene, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = scene.videoUrl!;
        link.download = `视频_${scene.sceneNumber.toString().padStart(2, '0')}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500);
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc]">
      {!hasKey && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-10 max-w-md shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-4">需要付费 API Key</h2>
            <p className="text-slate-500 mb-8 font-medium">使用 Veo 视频生成功能需要有效的 API Key。</p>
            <button onClick={handleOpenKeyDialog} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100">选择 API Key</button>
          </div>
        </div>
      )}

      <aside className="lg:w-[420px] bg-white border-r border-slate-200 p-6 flex flex-col gap-6 h-screen overflow-y-auto sticky top-0 z-20 shadow-sm">
        <header className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl rotate-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">分镜大师 AI</h1>
            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">专业制作版 v4.1</p>
          </div>
        </header>

        <div className="flex flex-col gap-5">
          <section className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剧情大纲</label>
            <textarea
              className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all text-xs outline-none bg-slate-50/30 font-medium"
              placeholder="描述您的剧本内容..."
              value={state.plot}
              onChange={(e) => setState(prev => ({ ...prev, plot: e.target.value }))}
            />
          </section>

          <section className="space-y-2">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">镜头风格指令</label>
            <textarea
              className="w-full h-16 p-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 transition-all text-xs outline-none bg-indigo-50/10 font-medium"
              placeholder="例如：俯拍、微距特写、快剪感..."
              value={state.cameraStyle}
              onChange={(e) => setState(prev => ({ ...prev, cameraStyle: e.target.value }))}
            />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <section className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">视频分辨率</span>
              <select 
                className="bg-transparent font-bold text-indigo-600 text-xs outline-none cursor-pointer"
                value={state.videoResolution}
                onChange={(e) => setState(prev => ({ ...prev, videoResolution: e.target.value as '720p' | '1080p' }))}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </section>
            <section className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">分镜数量</span>
              <input
                type="number"
                min="1" max="50"
                className="bg-transparent font-bold text-indigo-600 text-xs outline-none w-full"
                value={state.sceneCount}
                onChange={(e) => setState(prev => ({ ...prev, sceneCount: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
              />
            </section>
          </div>

          <button
            onClick={handleGenerateScript}
            disabled={state.isGeneratingText || !state.plot}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest transition-transform active:scale-95"
          >
            {state.isGeneratingText ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '生成脚本'}
          </button>
        </div>

        <section className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">产品参考 (图片/视频)</label>
          <div className="grid grid-cols-4 gap-2">
            {state.productAssets.map(asset => (
              <div key={asset.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group">
                {asset.type === 'image' ? (
                  <img src={asset.data} className="w-full h-full object-cover" />
                ) : (
                  <video src={asset.data} className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeAsset(asset.id)} className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                   <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-400 bg-white cursor-pointer transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileUpload} />
            </label>
          </div>
        </section>

        <section className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-4 overflow-hidden">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">操作历史记录</label>
          <div className="h-32 overflow-y-auto bg-slate-50 rounded-xl p-3 flex flex-col gap-2 font-mono text-[9px] text-slate-500">
            {state.history.length === 0 ? (
              <div className="text-slate-300 italic">暂无记录</div>
            ) : (
              state.history.map(item => (
                <div key={item.id} className="flex gap-2 border-l-2 border-indigo-200 pl-2">
                  <span className="opacity-50">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-700 font-bold">{item.action}</span>
                </div>
              ))
            )}
            <div ref={historyEndRef} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadAllVideos} disabled={state.scenes.filter(s => !!s.videoUrl).length === 0} className="py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter disabled:opacity-30">导出视频</button>
            <button onClick={handleGenerateAllVideos} disabled={state.scenes.length === 0} className="py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-tighter disabled:opacity-30">一键生成</button>
          </div>
        </section>
      </aside>

      <main className="flex-grow p-8 overflow-y-auto max-h-screen">
        <header className="mb-8 border-b border-slate-200 pb-6 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">分镜制作面板</h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">AI 视觉序列工作流</p>
          </div>
        </header>

        {state.scenes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
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
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 shadow-sm">
             <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">等待剧本输入</h3>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest max-w-xs">请在左侧侧边栏上传产品参考并输入您的剧情构想。</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
