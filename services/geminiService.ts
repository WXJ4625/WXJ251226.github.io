
import { GoogleGenAI, Type, GenerateContentResponse, VideoGenerationReferenceType, VideoGenerationReferenceImage } from "@google/genai";
import { Scene, ProductAsset } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateScenes(plot: string, styleInstructions: string, count: number, assets: ProductAsset[]): Promise<Partial<Scene>[]> {
    const ai = this.getAI();
    const parts: any[] = [
      { text: `你是一位专业的导演和分镜师。
                 请根据以下剧情大纲： "${plot}"。
                 并应用这些特定的镜头/镜头风格指南： "${styleInstructions}"。
                 
                 请生成一个包含恰好 ${count} 个场景的详细专业分镜 JSON。
                 要求：
                 1. "cameraAngle": 必须使用专业的中文摄影术语（如：特写、俯拍、仰拍、推镜头、拉镜头、环绕镜头等）。
                 2. "description": 描述视觉构图，重点关注演员和环境。
                 3. "productAction": 详细描述产品在镜头中的物理位置或运动。
                 4. 如果提供了产品参考图，请分析其结构，并确保分镜设计能完美展示该产品的结构特点。` }
    ];

    assets.forEach(asset => {
      if (asset.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: asset.mimeType,
            data: asset.data.split(',')[1]
          }
        });
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              description: { type: Type.STRING },
              cameraAngle: { type: Type.STRING },
              lighting: { type: Type.STRING },
              productAction: { type: Type.STRING }
            },
            required: ["sceneNumber", "description", "cameraAngle", "lighting", "productAction"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 未返回有效响应");
    return JSON.parse(text);
  }

  async regenerateSingleScene(plot: string, styleInstructions: string, sceneNumber: number, currentDescription: string): Promise<Partial<Scene>> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你是一位专业的导演和分镜师。
                 全局剧情大纲： "${plot}"。
                 风格指南： "${styleInstructions}"。
                 
                 请重新设计第 ${sceneNumber} 场分镜的脚本。当前内容是 "${currentDescription}"，请提供一个更有创意或更符合风格的新版本。
                 要求：
                 1. "cameraAngle": 必须使用专业的中文摄影术语。
                 2. "description": 视觉构图描述。
                 3. "productAction": 产品动态描述。
                 
                 仅返回这一个场景的 JSON 对象。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneNumber: { type: Type.INTEGER },
            description: { type: Type.STRING },
            cameraAngle: { type: Type.STRING },
            lighting: { type: Type.STRING },
            productAction: { type: Type.STRING }
          },
          required: ["sceneNumber", "description", "cameraAngle", "lighting", "productAction"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 未返回有效响应");
    return JSON.parse(text);
  }

  async generateImage(scene: Scene, assets: ProductAsset[]): Promise<string> {
    const ai = this.getAI();
    const prompt = `
      STORYBOARD PRODUCTION FRAME.
      CAMERA DIRECTION: ${scene.cameraAngle}.
      SCENE DESCRIPTION: ${scene.description}. 
      LIGHTING DESIGN: ${scene.lighting}. 
      PRODUCT SPECIFICS: ${scene.productAction}. 
      
      TECHNICAL STIPULATIONS:
      - Strictly render from the angle: ${scene.cameraAngle}.
      - Please preserve the product's structure, branding, and shape from the provided reference images.
      - Style: Clean cinematic concept art, highly legible for production crews.
    `;
    
    const parts: any[] = [{ text: prompt }];
    
    assets.filter(a => a.type === 'image').forEach(asset => {
      parts.push({
        inlineData: {
          mimeType: asset.mimeType,
          data: asset.data.split(',')[1]
        }
      });
    });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("画面生成失败");
  }

  async generateVideo(scene: Scene, assets: ProductAsset[], resolution: '720p' | '1080p'): Promise<string> {
    const ai = this.getAI();
    const prompt = `电影级视频：${scene.description}。镜头：${scene.cameraAngle}。灯光：${scene.lighting}。产品动作：${scene.productAction}。保持产品结构一致。专业质量。`;
    
    const images = assets.filter(a => a.type === 'image');
    
    let operation;
    
    if (images.length > 1) {
      const referenceImages: VideoGenerationReferenceImage[] = images.slice(0, 3).map(asset => ({
        image: {
          imageBytes: asset.data.split(',')[1],
          mimeType: asset.mimeType,
        },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));

      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          referenceImages: referenceImages,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
    } else {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: images.length > 0 ? {
          imageBytes: images[0].data.split(',')[1],
          mimeType: images[0].mimeType
        } : undefined,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: '16:9'
        }
      });
    }

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("视频生成失败");

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}

export const geminiService = new GeminiService();
