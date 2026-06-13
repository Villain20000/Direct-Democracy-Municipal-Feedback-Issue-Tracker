import ollama from 'ollama';
import { config } from '../config';

const MODEL = config.ollama.model;

async function chatCompletion(messages: Array<{ role: string; content: string }>, format?: string) {
  try {
    const response = await ollama.chat({
      model: MODEL,
      messages,
      stream: false,
      ...(format ? { format: format as any } : {}),
    });
    return response.message.content;
  } catch (error: any) {
    console.error('[AI] Ollama error:', error.message);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
}

export const aiService = {
  async categorize(text: string) {
    const response = await chatCompletion([
      {
        role: 'system',
        content: `You are a municipal issue classifier. Classify citizen reports into exactly one category:
INFRASTRUCTURE, PUBLIC_SAFETY, SANITATION, UTILITIES, HOUSING, ENVIRONMENT,
TRANSPORTATION, EDUCATION, HEALTH, or OTHER.
Output ONLY valid JSON: {"category": "...", "confidence": 0.0-1.0}`,
      },
      { role: 'user', content: text },
    ], 'json');
    try {
      return JSON.parse(response);
    } catch {
      return { category: 'OTHER', confidence: 0.5 };
    }
  },

  async prioritize(text: string, category?: string) {
    const context = category ? `Category: ${category}. ` : '';
    const response = await chatCompletion([
      {
        role: 'system',
        content: `You are a municipal urgency assessor. Rate issue urgency from 1 (low) to 5 (critical)
based on public safety risk, severity, and community impact.
${context}Output ONLY valid JSON: {"score": N, "justification": "..."}`,
      },
      { role: 'user', content: text },
    ], 'json');
    try {
      return JSON.parse(response);
    } catch {
      return { score: 3, justification: 'Unable to determine urgency' };
    }
  },

  async sentiment(text: string) {
    const response = await chatCompletion([
      {
        role: 'system',
        content: `You are a sentiment analyst for municipal feedback. Classify as POSITIVE, NEUTRAL, or NEGATIVE.
Output ONLY valid JSON: {"sentiment": "...", "score": 0.0-1.0, "justification": "..."}`,
      },
      { role: 'user', content: text },
    ], 'json');
    try {
      return JSON.parse(response);
    } catch {
      return { sentiment: 'NEUTRAL', score: 0.5, justification: 'Unable to determine sentiment' };
    }
  },

  async summarize(text: string, maxLength = 50) {
    const response = await chatCompletion([
      {
        role: 'system',
        content: `You are a municipal briefing assistant. Summarize the following civic issue in under ${maxLength} words
suitable for a city council agenda item. Be factual and concise.`,
      },
      { role: 'user', content: text },
    ]);
    return { summary: response };
  },

  async detectTrends(issues: Array<{ title: string; description: string; category: string }>) {
    const issueText = issues.map((i, idx) => `${idx + 1}. [${i.category}] ${i.title}: ${i.description.slice(0, 100)}`).join('\n');
    const response = await chatCompletion([
      {
        role: 'system',
        content: `You are a municipal data analyst. Analyze the following issues and identify emerging trends.
Output ONLY valid JSON: {"trends": [{"topic": "...", "frequency": N, "ward": "...", "urgency": "low|medium|high"}]}`,
      },
      { role: 'user', content: `Analyze these recent issues:\n${issueText}` },
    ], 'json');
    try {
      return JSON.parse(response);
    } catch {
      return { trends: [] };
    }
  },

  async chat(messages: Array<{ role: string; content: string }>) {
    const systemMessage = {
      role: 'system',
      content: `You are CivicAssist, an AI assistant for the municipal government. Help citizens navigate
the issue reporting process, answer frequently asked questions about city services, and guide
them to the appropriate department. Be friendly, professional, and helpful. Keep responses concise.`,
    };
    return chatCompletion([systemMessage, ...messages]);
  },
};
