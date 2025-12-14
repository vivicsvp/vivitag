import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes an image and suggests an engaging caption for Telegram.
 */
export const generateSmartCaption = async (base64Image: string): Promise<string> => {
  try {
    // Remove header if present (data:image/png;base64,)
    const cleanBase64 = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image and write a creative, engaging caption for a Telegram Channel post. Include emojis. Keep it concise but persuasive. Do NOT include hashtags at the end. Just the caption text."
          }
        ]
      }
    });

    if (response.text) {
      return response.text;
    }
    return "Confira este novo conteúdo exclusivo! 🔥✨";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar legenda. Tente novamente.";
  }
};