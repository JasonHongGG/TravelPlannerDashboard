
import { TripInput, TripData, Message, AttractionRecommendation, FeasibilityResult } from "../types";
import { 
  SYSTEM_INSTRUCTION, 
  constructTripPrompt, 
  constructUpdatePrompt, 
  constructRecommendationPrompt,
  constructFeasibilityPrompt
} from "../config/aiConfig";
import { IAIService, UpdateResult } from "./aiInterface";
import { SERVICE_CONFIG } from "../config/serviceConfig";

export class OllamaService implements IAIService {
    private baseUrl: string;
    private models: {
        tripGenerator: string;
        tripUpdater: string;
        recommender: string;
    };

    constructor() {
        this.baseUrl = SERVICE_CONFIG.ollama.baseUrl;
        this.models = SERVICE_CONFIG.ollama.models;
    }

    private cleanJsonString(text: string) {
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    private parseJsonFromOllama(text: string, strict = true): any {
        try {
            const cleaned = this.cleanJsonString(text);
            const start = cleaned.search(/[{[]/);
            const end = cleaned.lastIndexOf(cleaned[start] === '{' ? '}' : ']');
            
            if (start === -1 || end === -1) throw new Error("No JSON found in Ollama response");
            
            return JSON.parse(cleaned.substring(start, end + 1));
        } catch (e) {
            console.error("Ollama JSON Parse Error", e);
            console.error("Raw Text:", text); // Debug log
            if (strict) throw e;
            return {};
        }
    }

    private async callOllama(messages: { role: string, content: string }[], model: string, format = 'json', stream = false) {
        try {
            // 1. 移除 'ngrok-skip-browser-warning' 以避免 Ollama CORS Preflight 失敗 (Header disallowed)
            // 2. 加入 Accept header 嘗試讓部分 Tunnel 識別為 API 請求
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    format: format === 'json' ? 'json' : undefined,
                    stream: stream,
                    options: {
                        temperature: 0.7, 
                        num_ctx: 8192 
                    }
                })
            });

            // 檢查是否被 Ngrok 攔截並回傳 HTML 警告頁面
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                const text = await response.text();
                if (text.includes("ngrok") || text.includes("Visit Site")) {
                    throw new Error("NGROK_BLOCK");
                }
                throw new Error(`Ollama API 回傳了 HTML 而非 JSON。請檢查網址配置 (${this.baseUrl})。`);
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Ollama API Error (${response.status}): ${errText}`);
            }
            return response;
        } catch (error: any) {
            console.error("Network connection to Ollama failed:", error);
            throw error;
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
        const prompt = constructTripPrompt(input);
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, this.models.tripGenerator, 'json', false);
            const data = await response.json();
            return this.parseJsonFromOllama(data.message.content) as TripData;
        } catch (error: any) {
            console.error("Ollama Generation Error:", error);
            throw new Error(error.message);
        }
    }

    async updateTrip(
        currentData: TripData, 
        history: Message[], 
        onThought?: (text: string) => void
    ): Promise<UpdateResult> {
        const prompt = constructUpdatePrompt(currentData, history);
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, this.models.tripUpdater, 'json', true);
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            if (!reader) throw new Error("Failed to read Ollama stream");

            let fullText = "";
            let isJsonMode = false;
            let jsonBuffer = "";
            const delimiter = "___UPDATE_JSON___";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.done) continue;
                        
                        const textContent = json.message?.content || "";

                        if (!isJsonMode) {
                            fullText += textContent;
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
                            jsonBuffer += textContent;
                        }

                    } catch (e) { /* Ignore partial chunk parse errors */ }
                }
            }

            if (isJsonMode) {
                const partialUpdate = this.parseJsonFromOllama(jsonBuffer, false);
                const updatedData = this.mergeTripData(currentData, partialUpdate);
                return {
                    responseText: fullText.split(delimiter)[0],
                    updatedData: updatedData
                };
            } else {
                return { responseText: fullText };
            }

        } catch (error) {
            console.error("Ollama Update Error:", error);
            throw error;
        }
    }

    async getRecommendations(
        location: string, 
        interests: string, 
        category: 'attraction' | 'food' = 'attraction', 
        excludeNames: string[] = []
    ): Promise<AttractionRecommendation[]> {
        const prompt = constructRecommendationPrompt(location, interests, category, excludeNames);
        const messages = [
            { role: 'user', content: prompt }
        ];

        try {
            const response = await this.callOllama(messages, this.models.recommender, 'json', false);
            const data = await response.json();
            const parsed = this.parseJsonFromOllama(data.message.content, false);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Ollama Recommendation Error:", error);
            return [];
        }
    }

    async checkFeasibility(
        currentData: TripData,
        modificationContext: string
      ): Promise<FeasibilityResult> {
        const prompt = constructFeasibilityPrompt(currentData, modificationContext);
        const messages = [
            { role: 'user', content: prompt }
        ];
    
        try {
            const response = await this.callOllama(messages, this.models.recommender, 'json', false);
            const data = await response.json();
            return this.parseJsonFromOllama(data.message.content, false);
        } catch (e) {
            console.error("Ollama Feasibility Error", e);
            return { feasible: true, riskLevel: 'low', issues: [], suggestions: [] };
        }
      }
}