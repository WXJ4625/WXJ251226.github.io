
export interface ProductAsset {
  id: string;
  type: 'image' | 'video';
  data: string; // base64
  mimeType: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  action: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  cameraAngle: string;
  lighting: string;
  productAction: string;
  imageUrl?: string;
  videoUrl?: string;
  isGenerating?: boolean;
  isVideoGenerating?: boolean;
}

export interface StoryboardState {
  plot: string;
  cameraStyle: string;
  sceneCount: number;
  scenes: Scene[];
  productAssets: ProductAsset[];
  history: HistoryItem[];
  isGeneratingText: boolean;
  videoResolution: '720p' | '1080p';
  videoDuration: 5 | 10 | 15;
}
