import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Segment, VocabularyItem } from "../types";

// --- CONFIGURATION ---
const USE_MOCK_DATA = false; 

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Short silent MP3 base64 for testing audio functions without API
const MOCK_AUDIO_BASE64 = "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

/**
 * Helper to get the AI instance dynamically.
 * It checks LocalStorage first (user input), then Environment Variable.
 */
const getAiInstance = (): GoogleGenAI => {
  const localKey = localStorage.getItem('GEMINI_API_KEY');
  // Fallback to env var if available, otherwise use empty string (will fail gracefully later if used)
  const apiKey = localKey || process.env.API_KEY || "";
  
  if (!apiKey && !USE_MOCK_DATA) {
    throw new Error("API Key is missing. Please click the Settings icon and enter your Google Gemini API Key.");
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Converts a File object to a Base64 string.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const cleanJsonString = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json\n?|```/g, '').trim();
};

/**
 * Converts timestamp string (MM:SS.mmm) to seconds (number)
 * Example: "01:05.500" -> 65.5
 */
const parseTimestamp = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseFloat(parts[1]);
        return minutes * 60 + seconds;
    }
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseFloat(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    return parseFloat(timeStr) || 0;
};

const handleApiError = (error: any, context: string): never => {
    console.error(`${context} error details:`, error);
    
    let message = "An unknown error occurred.";
    let isQuota = false;

    // Check for standard Error object
    if (error instanceof Error) {
        message = error.message;
        if (message.includes("429") || message.toLowerCase().includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
            isQuota = true;
        }
    } 
    // Check for raw API error object structure
    else if (typeof error === 'object' && error !== null) {
        if (error.error) {
            if (error.error.code === 429 || error.error.status === 'RESOURCE_EXHAUSTED') {
                isQuota = true;
            }
            message = error.error.message || JSON.stringify(error.error);
        } else {
            message = JSON.stringify(error);
            if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
                isQuota = true;
            }
        }
    }

    if (isQuota) {
        throw new Error("API Quota Exceeded (429). The free plan limit has been reached. Please wait a moment or update your API Key in Settings.");
    }
    
    throw new Error(`Failed to ${context}: ${message}`);
};

// --- REAL API FUNCTIONS ---

export const transcribeAudio = async (file: File): Promise<Segment[]> => {
  if (USE_MOCK_DATA) {
      console.log("⚠️ USING MOCK DATA: transcribeAudio");
      await delay(1000); 
      return [
          { id: "1", text: "Hello, this is a mock transcription.", translation: "Xin chào, đây là bản dịch giả lập.", start: 0, end: 2.5 },
          { id: "2", text: "We are using this mode because the API quota is exhausted.", translation: "Chúng ta dùng chế độ này vì hết hạn ngạch API.", start: 2.5, end: 6.0 },
          { id: "3", text: "You can continue coding the UI safely.", translation: "Bạn có thể tiếp tục code giao diện an toàn.", start: 6.0, end: 9.0 }
      ];
  }

  try {
    const ai = getAiInstance();
    const base64Audio = await fileToGenerativePart(file);

    /* 
     * STRATEGY CHANGE: 
     * Instead of JSON Schema (which confuses time alignment), we ask for a strict text format
     * that looks like a subtitle file. LLMs are much better at this "linear" task.
     */
    const prompt = `
      Listen to the audio file and transcribe it into segments.
      
      OUTPUT FORMAT RULES:
      1. Use this EXACT format for each line:
         [MM:SS.mmm -> MM:SS.mmm] English Text | Vietnamese Translation
      
      2. TIMING RULES:
         - Start and End times must be PRECISE to the millisecond.
         - Do not overlap segments significantly.
         - Do not output timestamps for silence or music.
      
      3. CONTENT RULES:
         - Transcribe exactly what is spoken.
         - Translate the meaning to Vietnamese naturally.
         - STOP generating immediately when the speech ends. 
         - DO NOT hallucinate or invent text that is not in the audio.
      
      Example Output:
      [00:00.000 -> 00:02.500] Hello everyone. | Xin chào mọi người.
      [00:02.500 -> 00:05.100] Welcome to the lesson. | Chào mừng đến với bài học.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: file.type || "audio/mp3", data: base64Audio } },
          { text: prompt }
        ]
      },
      // Note: No responseSchema or responseMimeType JSON here. We want raw text.
    });

    const rawText = response.text || "";
    console.log("Raw AI Response:", rawText);

    const segments: Segment[] = [];
    
    // Parse the Line-by-Line output
    // Regex matches: [00:00.000 -> 00:05.000] Text | Translation
    const lineRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?) -> (\d{1,2}:\d{2}(?:\.\d{1,3})?)\] (.*?)(?: \| (.*))?$/;
    
    const lines = rawText.split('\n');
    
    lines.forEach((line, index) => {
        const match = line.trim().match(lineRegex);
        if (match) {
            const startStr = match[1];
            const endStr = match[2];
            const textContent = match[3].trim();
            const translationContent = match[4] ? match[4].trim() : "";

            if (textContent) {
                segments.push({
                    id: `seg-${index}-${Date.now()}`,
                    start: parseTimestamp(startStr),
                    end: parseTimestamp(endStr),
                    text: textContent,
                    translation: translationContent
                });
            }
        }
    });

    if (segments.length === 0) {
        throw new Error("Could not parse audio. The AI response was empty or malformed.");
    }

    return segments;

  } catch (error: any) {
    handleApiError(error, "transcribe audio");
    return []; 
  }
};

export const lookupWord = async (word: string, contextSentence: string): Promise<Omit<VocabularyItem, 'id' | 'savedAt' | 'word' | 'originalSentence'>> => {
    if (USE_MOCK_DATA) {
        console.log("⚠️ USING MOCK DATA: lookupWord");
        await delay(500);
        return {
            translation: "Giả lập (Danh từ)",
            ipa: "mɒk",
            definition: "A fake data object used for testing purposes.",
            examples: ["We use mock data when the API is down.", "This is a mock response."]
        };
    }

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{
                    text: `Analyze the word "${word}" in the context of this sentence: "${contextSentence}".
                    Provide Vietnamese translation, IPA, definition, and 2 examples. Return JSON.`
                }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        translation: { type: Type.STRING },
                        ipa: { type: Type.STRING },
                        definition: { type: Type.STRING },
                        examples: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["translation", "ipa", "definition", "examples"]
                }
            }
        });

        const cleanJson = cleanJsonString(response.text || "{}");
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Lookup error:", error);
        // Fallback for lookup to prevent UI freeze
        return { 
            translation: "API Error", 
            ipa: "???", 
            definition: "Could not look up word due to API limit or error.", 
            examples: [] 
        };
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
  if (USE_MOCK_DATA) {
      console.log("⚠️ USING MOCK DATA: generateSpeech");
      await delay(300);
      return MOCK_AUDIO_BASE64; // Return silent/short audio
  }

  if (!text || text.trim().length === 0) throw new Error("Text is empty");
  
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) return part.inlineData.data;
      }
    }
    throw new Error("No audio content returned");
  } catch (error) {
    handleApiError(error, "generate speech");
    return "";
  }
};