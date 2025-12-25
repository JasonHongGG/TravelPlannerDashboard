
import { IAIService } from "./aiInterface";
import { GeminiService } from "./geminiService";
import { OllamaService } from "./ollamaService";
import { SERVICE_CONFIG } from "../config/serviceConfig";

// Factory Pattern: Choose implementation based on config
let serviceInstance: IAIService;

if (SERVICE_CONFIG.provider === 'ollama') {
    console.log("Using Ollama Service");
    serviceInstance = new OllamaService();
} else {
    console.log("Using Gemini Service");
    serviceInstance = new GeminiService();
}

export const aiService = serviceInstance;
