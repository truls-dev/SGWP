import { GoogleGenAI, Type } from "@google/genai";

// Always use the required initialization format with import.meta.env.VITE_GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateConversation = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a realistic Snapchat conversation based on this topic: "${prompt}". 
    Format as a JSON array of messages with 'sender' (ME or THEM) and 'text'. 
    Make it informal, use emojis, and keep it brief (5-8 messages).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sender: { type: Type.STRING, enum: ['ME', 'THEM'] },
            text: { type: Type.STRING }
          },
          required: ['sender', 'text']
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateProfilePic = async (description: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `Create a professional 3D bitmoji-style avatar face on a simple colorful background for: ${description}` }
      ]
    },
    config: {
        imageConfig: {
            aspectRatio: "1:1"
        }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};