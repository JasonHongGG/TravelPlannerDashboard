
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

interface LocalApiResponse {
    text: string;
    images: string[];
}

export class LocalApiService implements IAIService {
    private getBaseUrl() {
        return SERVICE_CONFIG.local_api.baseUrl;
    }

    private async callApi(prompt: string, model: string): Promise<LocalApiResponse> {
        const url = `${this.getBaseUrl()}/chat`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    model: model
                })
            });

            if (!response.ok) {
                throw new Error(`Local API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as LocalApiResponse;

            // Append images to text if available, so they show up in the UI (assuming Markdown support)
            if (data.images && data.images.length > 0) {
                const imageMarkdown = data.images.map(img => `![Generated Image](${img})`).join('\n\n');
                data.text = data.text ? `${data.text}\n\n${imageMarkdown}` : imageMarkdown;
            }

            return data;
        } catch (error) {
            console.error("Failed to call local API:", error);
            throw error;
        }
    }

    private parseJsonFromResponse(text: string, strict = true): any {
        // Try to find the JSON block (either object or array)
        const objectStart = text.indexOf('{');
        const arrayStart = text.indexOf('[');

        let start = -1;
        let end = -1;
        let isArray = false;

        // Determine which type comes first or exists
        if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
            start = objectStart;
            end = text.lastIndexOf('}');
        } else if (arrayStart !== -1) {
            start = arrayStart;
            end = text.lastIndexOf(']');
            isArray = true;
        }

        if (start === -1 || end === -1) {
            throw new Error("Invalid response format: No JSON object or array found.");
        }

        const jsonStr = text.substring(start, end + 1);
        try {
            const data = JSON.parse(jsonStr);
            if (strict && !isArray) {
                if (!data.tripMeta || !data.days) {
                    throw new Error("Response is missing required trip data fields (tripMeta or days).");
                }
            }
            return data;
        } catch (e) {
            console.error("JSON Parse Error:", e);
            console.error(text);
            throw new Error("Failed to parse data.");
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

    async generateTrip(input: TripInput): Promise<TripData> {
        const userPrompt = constructTripPrompt(input);
        const fullPrompt = `${SYSTEM_INSTRUCTION}\n\n---\n\n${userPrompt}`;
        const model = SERVICE_CONFIG.local_api.models.tripGenerator;

        const response = await this.callApi(fullPrompt, model);
        return this.parseJsonFromResponse(response.text, true) as TripData;
    }

    async updateTrip(
        currentData: TripData,
        history: Message[],
        onThought?: (text: string) => void
    ): Promise<UpdateResult> {
        const userPrompt = constructUpdatePrompt(currentData, history);
        const fullPrompt = `${SYSTEM_INSTRUCTION}\n\n---\n\n${userPrompt}`;
        const model = SERVICE_CONFIG.local_api.models.tripUpdater;

        // Simulate "thought" if needed, but since API is sync, we just call it.
        if (onThought) onThought("Connecting to local API...");

        const response = await this.callApi(fullPrompt, model);

        // The response.text might contain the thought process AND the JSON.
        // We can pass it all to parseJsonFromResponse?
        // Usually Gemini wraps JSON in ```json ... ``` or just outputs it. 
        // The GeminiService splits strictly. 
        // Let's assume the local wrapper returns similar text outputs as the raw model.

        // Use regex to match various UPDATE_JSON delimiter formats:
        // - ___UPDATE_JSON___ (original format)
        // - ***UPDATE_JSON*** (markdown bold)
        // - **UPDATE_JSON** (markdown bold)
        // - *UPDATE_JSON* (markdown italic)
        const fullText = response.text;
        const delimiterRegex = /(\*{1,3}UPDATE_JSON\*{1,3}|_{3}UPDATE_JSON_{3})/;
        const match = fullText.match(delimiterRegex);

        if (match) {
            const delimiterIndex = match.index!;
            const delimiterLength = match[0].length;
            const thought = fullText.substring(0, delimiterIndex).trim();
            const jsonPart = fullText.substring(delimiterIndex + delimiterLength);

            if (onThought) onThought(thought);

            const updates = this.parseJsonFromResponse(jsonPart, false);
            const updatedData = this.mergeTripData(currentData, updates);

            return { responseText: thought, updatedData };
        } else {
            // No delimiter found - try to separate text from JSON
            // Look for JSON starting with { after some text
            const jsonStartIndex = fullText.indexOf('\n{');

            if (jsonStartIndex !== -1) {
                const thought = fullText.substring(0, jsonStartIndex).trim();
                const jsonPart = fullText.substring(jsonStartIndex);

                try {
                    const updates = this.parseJsonFromResponse(jsonPart, false);
                    const updatedData = this.mergeTripData(currentData, updates);
                    if (onThought) onThought(thought);
                    return { responseText: thought, updatedData };
                } catch (e) {
                    // JSON parsing failed, return full text
                    if (onThought) onThought(fullText);
                    return { responseText: fullText };
                }
            }

            // No JSON found, just text response
            if (onThought) onThought(fullText);
            return { responseText: fullText };
        }
    }

    async getRecommendations(
        location: string,
        interests: string,
        category: 'attraction' | 'food' = 'attraction',
        excludeNames: string[] = []
    ): Promise<AttractionRecommendation[]> {
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames);
        const model = SERVICE_CONFIG.local_api.models.recommender;

        const response = await this.callApi(prompt, model);

        try {
            return this.parseJsonFromResponse(response.text, false);
        } catch (e) {
            console.error("Failed to parse recommendations:", e);
            console.error("Raw text:", response.text);
            return [];
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string
    ): Promise<FeasibilityResult> {
        const prompt = constructFeasibilityPrompt(currentData, modificationContext);
        const model = SERVICE_CONFIG.local_api.models.recommender;

        const response = await this.callApi(prompt, model);

        try {
            return JSON.parse(response.text || "{}");
        } catch (e) {
            try {
                return this.parseJsonFromResponse(response.text, false);
            } catch (e2) {
                console.error("Failed to parse feasibility check", e);
                return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
            }
        }
    }
}
