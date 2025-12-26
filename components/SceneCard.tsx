
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
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-lg hover:border-indigo-200 group/card relative">
      <div className="aspect-video bg-slate-100 relative group overflow-hidden">
        {scene.videoUrl ? (
          <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
        ) : scene.imageUrl ? (
          <img src={scene.imageUrl} alt={`场景 ${scene.sceneNumber}`} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 bg-slate-50 p-6">
            {scene.isGenerating || scene.isVideoGenerating ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                  {scene.isVideoGenerating ? "渲染视频中..." : "处理中..."}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={() => onGenerateImage(scene.id)}
                  className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 transition-all text-[9px] font-black uppercase tracking-widest shadow-sm"
                >
                  生成静态分镜
                </button>
                <button 
                  onClick={() => onGenerateVideo(scene.id)}
                  className="w-full py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all text-[9px] font-black uppercase tracking-widest shadow-md"
                >
                  生成视频片段
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-md text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-lg">
            分镜 S{scene.sceneNumber.toString().padStart(2, '0')}
          </div>
          {scene.videoUrl && (
             <div className="px-2 py-1 bg-indigo-600/80 backdrop-blur-md text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-lg">
               视频预览
             </div>
          )}
        </div>

        <button 
          onClick={() => onDelete(scene.id)}
          className="absolute top-3 right-3 p-1.5 bg-red-500/90 text-white rounded-lg shadow-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-600"
          title="删除分镜"
        >
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>

        {(scene.imageUrl || scene.videoUrl) && !scene.isGenerating && !scene.isVideoGenerating && (
           <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
             <button 
               onClick={() => onGenerateVideo(scene.id)}
               className="p-1.5 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all"
               title="重新生成视频"
             >
               <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
             </button>
           </div>
        )}
      </div>

      <div className="p-5 space-y-4 flex-grow">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">镜头与构图</label>
            <button 
              onClick={() => onRegenerateText(scene.id)}
              disabled={scene.isGenerating}
              className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-30"
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              重写脚本
            </button>
          </div>
          <input
            className="w-full text-xs font-bold text-slate-800 bg-slate-50 border-none rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20"
            value={scene.cameraAngle}
            onChange={(e) => onUpdate(scene.id, { cameraAngle: e.target.value })}
            placeholder="如：特写、俯拍、推镜头..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">画面动态描述</label>
          <textarea
            className="w-full text-[11px] font-medium text-slate-600 border-none p-0 focus:ring-0 resize-none leading-relaxed h-14 bg-transparent"
            value={scene.description}
            onChange={(e) => onUpdate(scene.id, { description: e.target.value })}
            placeholder="描述镜头内的动作细节..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
          <div className="space-y-1 text-xs">
            <label className="text-[8px] font-black text-slate-400 uppercase">灯光氛围</label>
            <input className="w-full bg-slate-50 p-2 rounded-lg text-[10px]" value={scene.lighting} onChange={(e) => onUpdate(scene.id, { lighting: e.target.value })} />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-[8px] font-black text-slate-400 uppercase">产品动作</label>
            <input className="w-full bg-slate-50 p-2 rounded-lg text-[10px]" value={scene.productAction} onChange={(e) => onUpdate(scene.id, { productAction: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
};
