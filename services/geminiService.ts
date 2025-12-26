
import { GoogleGenAI, Type, GenerateContentResponse, VideoGenerationReferenceType, VideoGenerationReferenceImage } from "@google/genai";
import { Scene, ProductAsset } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateScenes(plot: string, styleInstructions: string, count: number, assets: ProductAsset[]): Promise<Partial<Scene>[]> {
    const ai = this.getAI();
    const parts: any[] = [
      { text: `你是一位顶级导演和分镜专家。
                 核心任务：根据剧情大纲 "${plot}" 生成专业分镜。
                 风格要求："${styleInstructions}"。
                 画幅：9:16 纵向。
                 
                 重要：参考图中展示了核心产品。在设计分镜时，必须：
                 1. 深入分析产品的物理结构、比例和独特细节。
                 2. 分镜描述中应指明如何通过构图展现产品的精细特征。
                 3. "productAction": 详细描述产品如何运动，且运动必须符合其物理结构。
                 
                 请生成一个包含恰好 ${count} 个场景的 JSON。
                 字段要求：
                 - "cameraAngle": 专业中文术语（如：微距特写、环绕推镜）。
                 - "description": 视觉描述，强调产品在 9:16 构图中的位置。
                 - "lighting": 氛围灯光设计。
                 - "productAction": 产品具体的物理反馈或位移。` }
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
      contents: `重写分镜脚本。全局大纲："${plot}"，风格："${styleInstructions}"。
                 当前第 ${sceneNumber} 场内容： "${currentDescription}"。
                 
                 必须确保：
                 1. 维持 9:16 纵向构图。
                 2. 完美适配参考图中产品的结构细节。
                 3. 创意升级，镜头感更强。
                 
                 仅返回 JSON 格式。`,
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
      STORYBOARD FRAME: 9:16 PORTRAIT.
      PRODUCT CONSISTENCY PROTOCOL: MANDATORY.
      
      SCENE: ${scene.description}.
      ANGLE: ${scene.cameraAngle}.
      LIGHT: ${scene.lighting}.
      ACTION: ${scene.productAction}.
      
      TECHNICAL INSTRUCTIONS:
      - THE PRODUCT IN THIS IMAGE MUST BE IDENTICAL TO THE PROVIDED REFERENCE IMAGES.
      - MAINTAIN ALL PHYSICAL STRUCTURES, LOGOS, BUTTONS, TEXTURES, AND SHAPES.
      - Render as a high-quality cinematic production storyboard.
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
          aspectRatio: "9:16"
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

  async generateVideo(scene: Scene, assets: ProductAsset[], resolution: '720p' | '1080p', duration: number): Promise<string> {
    const ai = this.getAI();
    // 极其严厉地要求产品一致性
    const prompt = `9:16 PORTRAIT VIDEO. PRODUCT CONSISTENCY IS TOP PRIORITY. 
      The product MUST look exactly like the reference images in terms of structure, material, and details.
      Content: ${scene.description}. 
      Camera: ${scene.cameraAngle}. 
      Lighting: ${scene.lighting}. 
      Movement: ${scene.productAction}.
      Duration: ${duration} seconds.`;
    
    const images = assets.filter(a => a.type === 'image');
    
    let operation;
    
    // 使用 Veo 3.1 并在配置中传入参考图
    if (images.length > 0) {
      const referenceImages: VideoGenerationReferenceImage[] = images.slice(0, 3).map(asset => ({
        image: {
          imageBytes: asset.data.split(',')[1],
          mimeType: asset.mimeType,
        },
        referenceType: VideoGenerationReferenceType.ASSET, // 使用 ASSET 类型确保产品一致性
      }));

      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          referenceImages: referenceImages,
          resolution: '720p', // 保持 720p 以获得更好的参考图遵循度
          aspectRatio: '9:16'
        }
      });
    } else {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: '9:16'
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
