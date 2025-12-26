
import React from 'react';
import { Scene } from '../types';

interface SceneCardProps {
  scene: Scene;
  onUpdate: (id: string, updates: Partial<Scene>) => void;
  onGenerateImage: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onRegenerateText: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ 
  scene, 
  onUpdate, 
  onGenerateImage, 
  onGenerateVideo,
  onRegenerateText,
  onDelete
}) => {
  const isProcessing = scene.isGenerating || scene.isVideoGenerating;

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col transition-all hover:-translate-y-2 hover:shadow-2xl hover:border-indigo-100 group/card relative h-full">
      
      {/* 顶部标题与删除按钮 */}
      <div className="px-6 pt-6 flex justify-between items-center">
        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-lg">
          S{scene.sceneNumber.toString().padStart(2, '0')}
        </div>
        <button 
          onClick={() => onDelete(scene.id)}
          className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
          title="移除分镜"
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      </div>

      {/* 文案编辑区 */}
      <div className="p-6 space-y-5 flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">镜头构图</label>
            <button 
              onClick={() => onRegenerateText(scene.id)}
              disabled={isProcessing}
              className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5 disabled:opacity-30 group/redo"
            >
              <svg width="12" height="12" className="group-hover/redo:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              AI 润色
            </button>
          </div>
          <input
            className="w-full text-[13px] font-black text-slate-800 bg-slate-50 border-none rounded-xl p-3.5 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300"
            value={scene.cameraAngle}
            onChange={(e) => onUpdate(scene.id, { cameraAngle: e.target.value })}
            placeholder="如：纵向构图、仰拍特写..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">画面描述</label>
          <textarea
            className="w-full text-xs font-medium text-slate-600 border-none p-0 focus:ring-0 resize-none leading-relaxed h-20 bg-transparent placeholder:text-slate-200"
            value={scene.description}
            onChange={(e) => onUpdate(scene.id, { description: e.target.value })}
            placeholder="具体画面动态描述..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-300 uppercase">灯光氛围</label>
            <input className="w-full bg-slate-50/50 p-2.5 rounded-xl text-[11px] font-bold text-slate-700 border-none" value={scene.lighting} onChange={(e) => onUpdate(scene.id, { lighting: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-300 uppercase">产品动态</label>
            <input className="w-full bg-slate-50/50 p-2.5 rounded-xl text-[11px] font-bold text-slate-700 border-none" value={scene.productAction} onChange={(e) => onUpdate(scene.id, { productAction: e.target.value })} />
          </div>
        </div>
      </div>

      {/* 操作栏 - 修改脚本后点击这里更新渲染 */}
      <div className="px-6 pb-4 flex gap-2">
        <button 
          onClick={() => onGenerateImage(scene.id)}
          disabled={isProcessing}
          className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 disabled:opacity-50"
        >
          {scene.imageUrl ? "更新图" : "生成图"}
        </button>
        <button 
          onClick={() => onGenerateVideo(scene.id)}
          disabled={isProcessing}
          className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
        >
          {scene.videoUrl ? "重新渲染视频" : "渲染视频"}
        </button>
      </div>

      {/* 预览区 - 9:16 比例，放在最底部 */}
      <div className="aspect-[9/16] bg-slate-50 relative group overflow-hidden border-t border-slate-100 mx-6 mb-6 rounded-3xl">
        {scene.videoUrl ? (
          <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
        ) : scene.imageUrl ? (
          <img src={scene.imageUrl} alt={`场景 ${scene.sceneNumber}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 bg-slate-100/30 p-8 border-2 border-dashed border-slate-200 m-1 rounded-2xl">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest text-center animate-pulse">
                  {scene.isVideoGenerating ? "正在渲染视频" : "生成预览图"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">暂无媒体预览</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
