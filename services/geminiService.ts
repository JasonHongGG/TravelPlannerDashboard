
import { GoogleGenAI, Type } from "@google/genai";
import { TripInput, TripData, Message, AttractionRecommendation } from "../types";
import { 
  AI_CONFIG, 
  SYSTEM_INSTRUCTION, 
  constructTripPrompt, 
  constructUpdatePrompt, 
  constructRecommendationPrompt 
} from "../config/aiConfig";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseJsonFromResponse = (text: string, strict = true): any => {
  // Find the first '{' and the last '}' to extract the JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1) {
    // Fallback: Sometimes model puts text before/after. If we have a lot of text, try to find JSON.
    throw new Error("Invalid response format: No JSON object found.");
  }

  const jsonStr = text.substring(start, end + 1);
  try {
    const data = JSON.parse(jsonStr);
    // Basic validation to ensure critical fields exist ONLY if strict mode is on
    if (strict) {
        if (!data.tripMeta || !data.days) {
            throw new Error("Response is missing required trip data fields (tripMeta or days).");
        }
    }
    return data;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("Failed to parse itinerary data.");
  }
};

// Helper to merge partial updates into full trip data
const mergeTripData = (original: TripData, updates: Partial<TripData>): TripData => {
  const newData = { ...original };

  // 1. Merge Meta
  if (updates.tripMeta) {
    newData.tripMeta = { ...newData.tripMeta, ...updates.tripMeta };
  }

  // 2. Merge Days
  if (updates.days && Array.isArray(updates.days)) {
    // We expect updates.days to contain full objects for the days that changed.
    // If the AI returns a day, we replace the entire day object in the original array.
    const newDays = [...newData.days];
    
    updates.days.forEach(updatedDay => {
      const index = newDays.findIndex(d => d.day === updatedDay.day);
      if (index !== -1) {
        // Replace the entire day object
        newDays[index] = updatedDay;
      } else {
        // Add new day (rare case, e.g. extending trip)
        newDays.push(updatedDay);
      }
    });

    // Re-sort to be safe, in case AI added a day out of order
    newDays.sort((a, b) => a.day - b.day);
    newData.days = newDays;
  }

  // 3. Merge Totals/Risks (Direct replace is usually safer for lists/objects unless we want deep merge)
  if (updates.totals) newData.totals = updates.totals;
  if (updates.risks) newData.risks = updates.risks;

  return newData;
};

// Retry helper function
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`API call failed, retrying in ${delay}ms... (${retries} attempts left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateTripItinerary = async (input: TripInput): Promise<TripData> => {
  const ai = getClient();
  const prompt = constructTripPrompt(input);

  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: AI_CONFIG.models.tripGenerator, 
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          ...AI_CONFIG.generationConfig.jsonMode,
        },
      });
      // Strict parsing for initial generation
      return parseJsonFromResponse(response.text || "{}", true) as TripData;
    });
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export interface UpdateResult {
    responseText: string;
    updatedData?: TripData;
}

export const updateTripItinerary = async (
  currentData: TripData, 
  history: Message[],
  onThought?: (text: string) => void
): Promise<UpdateResult> => {
  const ai = getClient();
  const prompt = constructUpdatePrompt(currentData, history);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: AI_CONFIG.models.tripUpdater,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    let fullText = "";
    let isJsonMode = false;
    let jsonBuffer = "";
    const delimiter = "___UPDATE_JSON___";

    for await (const chunk of responseStream) {
      const text = chunk.text;
      
      if (!isJsonMode) {
        fullText += text;
        const delimiterIndex = fullText.indexOf(delimiter);
        
        if (delimiterIndex !== -1) {
            // We found the delimiter. Everything before it is thought/text.
            // Everything after is the start of JSON.
            isJsonMode = true;
            
            const thoughtPart = fullText.substring(0, delimiterIndex);
            if (onThought) onThought(thoughtPart);
            
            // Start buffering JSON from whatever came after the delimiter in this chunk
            jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
        } else {
            // Still in text mode, stream to UI
            if (onThought) onThought(fullText);
        }
      } else {
         // We are fully in JSON mode, just buffer it, don't stream to chat UI
         jsonBuffer += text;
      }
    }

    // Final Processing
    if (isJsonMode) {
        // Scenario B: Update
        // Relaxed parsing for updates (strict=false)
        const partialUpdate = parseJsonFromResponse(jsonBuffer, false);
        // Merge partial update with current data
        const updatedData = mergeTripData(currentData, partialUpdate);
        
        const finalText = fullText.split(delimiter)[0];
        return {
            responseText: finalText,
            updatedData: updatedData
        };
    } else {
        // Scenario A: Chat only
        return {
            responseText: fullText
        };
    }

  } catch (error) {
    console.error("Gemini Update Error:", error);
    throw error;
  }
};

export const getAttractionRecommendations = async (
  location: string, 
  interests: string,
  category: 'attraction' | 'food' = 'attraction',
  excludeNames: string[] = []
): Promise<AttractionRecommendation[]> => {
  const ai = getClient();
  const prompt = constructRecommendationPrompt(location, interests, category, excludeNames);

  const response = await ai.models.generateContent({
    model: AI_CONFIG.models.recommender,
    contents: prompt,
    config: {
      ...AI_CONFIG.generationConfig.jsonMode,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            reason: { type: Type.STRING },
            openHours: { type: Type.STRING },
          },
          required: ['name', 'description', 'category', 'reason', 'openHours'],
        }
      }
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse recommendations", e);
    return [];
  }
};
