import os from 'os';
import { config } from '../config';

export type AiTier = 'insufficient' | 'pilot' | 'production' | 'multimodal';

function modelMatches(models: string[], needle: string): boolean {
  return models.some((m) => m.toLowerCase().includes(needle.toLowerCase()));
}

function recommendTier(totalRamGb: number): AiTier {
  if (totalRamGb >= 24) return 'multimodal';
  if (totalRamGb >= 16) return 'production';
  if (totalRamGb >= 8) return 'pilot';
  return 'insufficient';
}

export const aiHealthService = {
  async check() {
    const totalRamGb = os.totalmem() / 1024 ** 3;
    const freeRamGb = os.freemem() / 1024 ** 3;
    const tier = recommendTier(totalRamGb);

    let pulledModels: string[] = [];
    let ollamaReachable = false;
    let chatLatencyMs: number | null = null;
    const warnings: string[] = [];

    try {
      const tagsRes = await fetch(`${config.ollama.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (tagsRes.ok) {
        ollamaReachable = true;
        const body = await tagsRes.json() as { models?: Array<{ name: string }> };
        pulledModels = (body.models || []).map((m) => m.name);
      } else {
        warnings.push(`Ollama tags endpoint returned ${tagsRes.status}`);
      }
    } catch (err: any) {
      warnings.push(`Ollama unreachable: ${err.message}`);
    }

    if (ollamaReachable) {
      const start = Date.now();
      try {
        const ping = await fetch(`${config.ollama.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.ollama.model,
            prompt: 'Reply with exactly: ok',
            stream: false,
            options: { num_predict: 2 },
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (ping.ok) chatLatencyMs = Date.now() - start;
      } catch {
        warnings.push('Chat model ping timed out or failed');
      }
    }

    const hasChat = modelMatches(pulledModels, 'gemma') || modelMatches(pulledModels, config.ollama.model);
    const hasEmbed = modelMatches(pulledModels, 'nomic-embed') || modelMatches(pulledModels, config.ollama.embedModel);
    const hasVision = modelMatches(pulledModels, 'llava') || modelMatches(pulledModels, 'moondream');
    const hasWhisper = modelMatches(pulledModels, 'whisper');

    const recommendedChatModel = tier === 'production' || tier === 'multimodal'
      ? 'gemma2:9b-instruct-q4_K_M'
      : 'gemma2:2b';

    let status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
    if (ollamaReachable && hasChat && hasEmbed) {
      status = hasVision && hasWhisper && tier !== 'insufficient' ? 'healthy' : 'degraded';
    } else if (ollamaReachable) {
      status = 'degraded';
    }

    return {
      status,
      ollamaReachable,
      tier,
      recommendedChatModel,
      recommendedVisionModel: 'llava:7b',
      recommendedWhisperModel: 'whisper-small',
      configured: {
        chatModel: config.ollama.model,
        embedModel: config.ollama.embedModel,
        visionModel: config.ollama.visionModel,
        whisperModel: config.ollama.whisperModel,
      },
      pulledModels,
      chatLatencyMs,
      ram: {
        totalGb: Math.round(totalRamGb * 10) / 10,
        freeGb: Math.round(freeRamGb * 10) / 10,
      },
      capabilities: {
        chat: hasChat,
        embeddings: hasEmbed,
        vision: hasVision,
        voice: hasWhisper,
        bilingual: tier === 'production' || tier === 'multimodal' || config.ollama.model.includes('9b'),
      },
      warnings,
    };
  },
};