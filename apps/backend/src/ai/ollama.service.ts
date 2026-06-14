import ollama from 'ollama';
import { config } from '../config';

const MODEL = config.ollama.model;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  INFRASTRUCTURE: ['pothole', 'road', 'bridge', 'sidewalk', 'streetlight', 'manhole', 'pavement'],
  PUBLIC_SAFETY: ['crime', 'police', 'safety', 'graffiti', 'vandalism', 'theft', 'assault'],
  SANITATION: ['trash', 'garbage', 'dumping', 'recycling', 'litter', 'waste', 'sanitation'],
  UTILITIES: ['water', 'sewer', 'electric', 'power', 'gas', 'utility', 'main break'],
  HOUSING: ['housing', 'homeless', 'rent', 'building', 'apartment', 'shelter'],
  ENVIRONMENT: ['tree', 'park', 'pollution', 'air quality', 'green', 'environment', 'wildlife'],
  TRANSPORTATION: ['traffic', 'bus', 'transit', 'bike', 'parking', 'transportation', 'crosswalk'],
  EDUCATION: ['school', 'education', 'library', 'student', 'teacher'],
  HEALTH: ['health', 'hospital', 'clinic', 'medical', 'disease', 'mental health'],
};

function keywordCategorize(text: string) {
  const lower = text.toLowerCase();
  let best = 'OTHER';
  let bestScore = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = category; }
  }
  return { category: best, confidence: bestScore > 0 ? 0.6 : 0.3, fallback: true };
}

function keywordPrioritize(text: string, category?: string) {
  const lower = text.toLowerCase();
  const urgent = ['emergency', 'dangerous', 'flooding', 'fire', 'injury', 'break', 'gushing', 'collapse'];
  const high = ['unsafe', 'hazard', 'urgent', 'damage', 'blocked'];
  if (urgent.some(w => lower.includes(w))) return { score: 5, justification: 'Keyword-based: urgent safety keywords detected', fallback: true };
  if (high.some(w => lower.includes(w))) return { score: 4, justification: 'Keyword-based: high-priority keywords detected', fallback: true };
  if (category === 'UTILITIES' || category === 'PUBLIC_SAFETY') return { score: 3, justification: 'Keyword-based: moderate priority category', fallback: true };
  return { score: 2, justification: 'Keyword-based: standard priority', fallback: true };
}

function keywordSentiment(text: string) {
  const lower = text.toLowerCase();
  const positive = ['thank', 'great', 'wonderful', 'excellent', 'appreciate', 'good job'];
  const negative = ['terrible', 'awful', 'angry', 'frustrated', 'dangerous', 'unsafe', 'broken', 'complaint'];
  if (positive.some(w => lower.includes(w))) return { sentiment: 'POSITIVE', score: 0.7, justification: 'Keyword-based positive tone', fallback: true };
  if (negative.some(w => lower.includes(w))) return { sentiment: 'NEGATIVE', score: 0.7, justification: 'Keyword-based negative tone', fallback: true };
  return { sentiment: 'NEUTRAL', score: 0.5, justification: 'Keyword-based neutral tone', fallback: true };
}

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
    try {
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
        return keywordCategorize(text);
      }
    } catch {
      return keywordCategorize(text);
    }
  },

  async prioritize(text: string, category?: string) {
    try {
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
        return keywordPrioritize(text, category);
      }
    } catch {
      return keywordPrioritize(text, category);
    }
  },

  async sentiment(text: string) {
    try {
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
        return keywordSentiment(text);
      }
    } catch {
      return keywordSentiment(text);
    }
  },

  async summarize(text: string, maxLength = 50) {
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal briefing assistant. Summarize the following civic issue in under ${maxLength} words
suitable for a city council agenda item. Be factual and concise.`,
        },
        { role: 'user', content: text },
      ]);
      return { summary: response };
    } catch {
      const words = text.split(/\s+/).slice(0, maxLength).join(' ');
      return { summary: words + (text.split(/\s+/).length > maxLength ? '...' : ''), fallback: true };
    }
  },

  async detectTrends(issues: Array<{ title: string; description: string; category: string }>) {
    try {
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
        return this._keywordTrends(issues);
      }
    } catch {
      return this._keywordTrends(issues);
    }
  },

  _keywordTrends(issues: Array<{ title: string; description: string; category: string }>) {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    }
    const trends = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic, frequency]) => ({ topic, frequency, ward: 'Unknown', urgency: frequency >= 3 ? 'high' : 'medium', fallback: true }));
    return { trends };
  },

  async chat(messages: Array<{ role: string; content: string }>) {
    try {
      const systemMessage = {
        role: 'system',
        content: `You are CivicAssist, an AI assistant for the municipal government. Help citizens navigate
the issue reporting process, answer frequently asked questions about city services, and guide
them to the appropriate department. Be friendly, professional, and helpful. Keep responses concise.`,
      };
      return chatCompletion([systemMessage, ...messages]);
    } catch {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const q = (lastUser?.content || '').toLowerCase();
      if (q.includes('report') || q.includes('pothole') || q.includes('issue')) {
        return 'To report an issue, go to "Report New Issue" from your dashboard or visit /issues/new. Describe the problem, location, and optionally attach a photo.';
      }
      if (q.includes('department') || q.includes('contact')) {
        return 'You can contact the relevant city department through the Messages feature, or check announcements for department contact information.';
      }
      return 'I\'m CivicAssist. I can help you report issues, find city services, or navigate the platform. What would you like help with?';
    }
  },
};