import type { Request, Response } from 'express';
import { CopilotClient } from "@github/copilot-sdk";
import path from 'path';
import {
    constructTripPrompt,
    constructUpdatePrompt,
    constructRecommendationPrompt,
    constructFeasibilityPrompt,
    constructExplorerUpdatePrompt,
    SYSTEM_INSTRUCTION
} from "../config/aiConfig";
import { SERVICE_CONFIG } from "../config/serviceConfig";

// Copilot Client Setup
const binPath = path.join(process.cwd(), 'node_modules', '.bin');
const copilotScript = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'index.js');
const env = { ...process.env, PATH: `${binPath}${path.delimiter}${process.env.PATH}` };

let client: CopilotClient | null = null;
let isReady = false;

// Initialize Client
if (process.env.GITHUB_TOKEN) {
    try {
        process.env.PATH = env.PATH;
        client = new CopilotClient({
            cliPath: process.execPath,
            cliArgs: [copilotScript, '--allow-all'],
            logLevel: 'debug',
        });
        client.start().then(() => {
            console.log('[Copilot Server] Client started.');
            isReady = true;
        }).catch(err => console.error('[Copilot Server] Start failed:', err));
    } catch (e) {
        console.error('[Copilot Server] Init failed:', e);
    }
} else {
    console.warn('[Copilot Server] No GITHUB_TOKEN found. Service will fail.');
}

async function ensureClient() {
    if (!client) throw new Error("Copilot Client not initialized.");
    if (!isReady) await new Promise(r => setTimeout(r, 2000));
    if (!isReady) throw new Error("Copilot Client not ready.");
    return client;
}

export async function processCopilot(req: Request, res: Response) {
    try {
        const { action, tripInput, currentData, history, language, location, interests, category, excludeNames, modificationContext, dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting } = req.body;

        console.log(`[Copilot Server] Processing Action: ${action}`);
        const activeClient = await ensureClient();

        let prompt = "";
        let model = 'gpt-4o';

        switch (action) {
            case 'GENERATE_TRIP':
                console.log(`[Copilot Server] Generating Trip: ${tripInput.destination}`);
                prompt = constructTripPrompt(tripInput);
                model = SERVICE_CONFIG.copilot.models.tripGenerator;
                break;
            case 'CHAT_UPDATE':
                console.log(`[Copilot Server] Updating Trip: ${currentData.tripMeta.destination}`);
                prompt = constructUpdatePrompt(currentData, history, language);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                break;
            case 'GET_RECOMMENDATIONS':
                console.log(`[Copilot Server] Getting Recommendations: ${location}`);
                prompt = constructRecommendationPrompt(location, interests, category, excludeNames, language);
                model = SERVICE_CONFIG.copilot.models.recommender;
                break;
            case 'CHECK_FEASIBILITY':
                console.log(`[Copilot Server] Checking Feasibility: ${currentData.tripMeta.destination}`);
                prompt = constructFeasibilityPrompt(currentData, modificationContext, language);
                model = SERVICE_CONFIG.copilot.models.recommender;
                break;
            case 'EXPLORER_UPDATE':
                console.log(`[Copilot Server] Updating Explorer: ${currentData.tripMeta.destination}`);
                prompt = constructExplorerUpdatePrompt(dayIndex, newMustVisit, newAvoid, keepExisting, removeExisting);
                model = SERVICE_CONFIG.copilot.models.tripUpdater;
                break;
            default:
                return res.status(400).json({ error: "Unknown Action" });
        }

        const session = await activeClient.createSession({ model });
        const response = await (session as any).send({
            systemPrompt: SYSTEM_INSTRUCTION,
            userPrompt: prompt
        });

        let fullResponse = "";

        for await (const event of response as AsyncIterable<any>) {
            console.log(`[Copilot Server] Event: ${event.type}`);

            if (event.type === 'message' && event.message?.content?.length) {
                const candidate = event.message.content.find((c: any) => c.type === 'text')?.text;

                console.log("[Copilot Server] Full Message Event Keys:", Object.keys(event));
                console.log("[Copilot Server] Full Message Event Data:", JSON.stringify(event, null, 2));
                console.log("[Copilot Server] Extracted Candidate:", typeof candidate, candidate ? candidate.substring(0, 50) : "null");

                if (candidate) {
                    fullResponse += candidate;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', text: candidate })}\n\n`);
                }
            }
        }

        console.log("[Copilot Server] Output Preview:", fullResponse.substring(0, 200).replace(/\n/g, ' '));
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

    } catch (e: any) {
        console.error("[Copilot Server] Error:", e);
        res.status(500).json({ error: e.message || 'Copilot server error' });
    }
}
