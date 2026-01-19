
import { GoogleGenAI, Type } from "@google/genai";
import { TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult } from "../types";
import {
  SYSTEM_INSTRUCTION,
  constructTripPrompt,
  constructUpdatePrompt,
  constructRecommendationPrompt,
  constructFeasibilityPrompt
} from "../config/aiConfig";
import { SERVICE_CONFIG } from "../config/serviceConfig";
import { IAIService, UpdateResult } from "./aiInterface";


export class GeminiService implements IAIService {
  private getClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({ apiKey });
  }

  private parseJsonFromResponse(text: string, strict = true): any {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
      throw new Error("Invalid response format: No JSON object found.");
    }

    const jsonStr = text.substring(start, end + 1);
    try {
      const data = JSON.parse(jsonStr);
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
  }

  private mergeTripData(original: TripData, updates: Partial<TripData>): TripData {
    const newData = { ...original };
    if (updates.tripMeta) newData.tripMeta = { ...newData.tripMeta, ...updates.tripMeta };

    if (updates.days && Array.isArray(updates.days)) {
      const newDays = [...newData.days];
      updates.days.forEach(updatedDay => {
        const index = newDays.findIndex(d => d.day === updatedDay.day);
        if (index !== -1) newDays[index] = updatedDay;
        else newDays.push(updatedDay);
      });
      newDays.sort((a, b) => a.day - b.day);
      newData.days = newDays;
    }

    if (updates.totals) newData.totals = updates.totals;
    if (updates.risks) newData.risks = updates.risks;

    return newData;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.warn(`API call failed, retrying in ${delay}ms... (${retries} attempts left)`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async generateTrip(input: TripInput): Promise<TripData> {
    const ai = this.getClient();
    const prompt = constructTripPrompt(input);

    return await this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: SERVICE_CONFIG.gemini.models.tripGenerator,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
        },
      });
      return this.parseJsonFromResponse(response.text || "{}", true) as TripData;
    });
  }

  async updateTrip(
    currentData: TripData,
    history: Message[],
    onThought?: (text: string) => void,
    language: string = "Traditional Chinese"
  ): Promise<UpdateResult> {
    const ai = this.getClient();
    const prompt = constructUpdatePrompt(currentData, history, language);

    const responseStream = await ai.models.generateContentStream({
      model: SERVICE_CONFIG.gemini.models.tripUpdater,
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
          isJsonMode = true;
          const thoughtPart = fullText.substring(0, delimiterIndex);
          if (onThought) onThought(thoughtPart);
          jsonBuffer = fullText.substring(delimiterIndex + delimiter.length);
        } else {
          if (onThought) onThought(fullText);
        }
      } else {
        jsonBuffer += text;
      }
    }

    if (isJsonMode) {
      const partialUpdate = this.parseJsonFromResponse(jsonBuffer, false);
      const updatedData = this.mergeTripData(currentData, partialUpdate);
      const finalText = fullText.split(delimiter)[0];
      return { responseText: finalText, updatedData: updatedData };
    } else {
      return { responseText: fullText };
    }
  }

  async getRecommendations(
    location: string,
    interests: string,
    category: 'attraction' | 'food' = 'attraction',
    excludeNames: string[] = [],
    language: string = "Traditional Chinese"
  ): Promise<AttractionRecommendation[]> {
    const ai = this.getClient();
    const prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language);

    const response = await ai.models.generateContent({
      model: SERVICE_CONFIG.gemini.models.recommender,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
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
  }

  async checkFeasibility(
    currentData: TripData,
    modificationContext: string,
    language: string = "Traditional Chinese"
  ): Promise<FeasibilityResult> {
    const ai = this.getClient();
    const prompt = constructFeasibilityPrompt(currentData, modificationContext, language);

    const response = await ai.models.generateContent({
      model: SERVICE_CONFIG.gemini.models.recommender, // Use faster model for check
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feasible: { type: Type.BOOLEAN },
            riskLevel: { type: Type.STRING, enum: ['low', 'moderate', 'high'] },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['feasible', 'riskLevel', 'issues', 'suggestions']
        }
      },
    });

    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("Failed to parse feasibility check", e);
      // Default to safe/feasible if parsing fails, to avoid blocking flow
      return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
    }
  }
}