import ollama from 'ollama';
import { config } from '../config';

const MODEL = config.ollama.model;

type ContentLocale = 'en' | 'el';

function localeLabel(locale?: string): string {
  return locale === 'el' ? 'Greek' : 'English';
}

function detectLanguageHeuristic(text: string): ContentLocale {
  const greek = text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g);
  if (greek && greek.length >= Math.max(3, text.length * 0.12)) return 'el';
  return 'en';
}

function withLocaleInstruction(messages: Array<{ role: string; content: string }>, locale?: string) {
  if (!locale || (locale !== 'en' && locale !== 'el')) return messages;
  const lang = localeLabel(locale);
  const prefix = {
    role: 'system',
    content: `Respond in ${lang}. If citing municipal terms, keep them accurate for Greek municipalities when locale is Greek.`,
  };
  const hasSystem = messages.some((m) => m.role === 'system');
  return hasSystem ? messages : [prefix, ...messages];
}

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

function keywordDuplicate(text: string, candidates: Array<{ id: string; title: string; description: string; category: string }>) {
  const tokens = new Set(
    text.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  if (tokens.size === 0) return { matches: [] };

  const scored = candidates.map(c => {
    const otherTokens = `${c.title} ${c.description}`.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const overlap = otherTokens.filter(t => tokens.has(t)).length;
    const score = Math.min(1, overlap / Math.max(tokens.size, 5));
    return { id: c.id, title: c.title, category: c.category, score };
  })
  .filter(s => s.score >= 0.25)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

  return { matches: scored, fallback: true };
}

function keywordTags(text: string) {
  const tagMap: Record<string, string[]> = {
    'pothole': ['pothole', 'hole', 'pavement'],
    'road-damage': ['road', 'asphalt', 'street'],
    'streetlight': ['streetlight', 'light', 'lamp'],
    'sidewalk': ['sidewalk', 'walk', 'curb'],
    'graffiti': ['graffiti', 'vandalism', 'tag'],
    'water-leak': ['water', 'leak', 'flooding', 'main'],
    'power-outage': ['power', 'outage', 'electric', 'electricity'],
    'trash': ['trash', 'garbage', 'litter', 'dumping'],
    'tree-down': ['tree', 'branch', 'fallen'],
    'noise': ['noise', 'loud', 'music'],
    'parking': ['parking', 'car', 'vehicle'],
    'traffic-light': ['traffic light', 'signal', 'intersection'],
    'crosswalk': ['crosswalk', 'pedestrian', 'crossing'],
    'safety': ['safety', 'dangerous', 'unsafe', 'hazard'],
    'accessibility': ['wheelchair', 'accessibility', 'ada', 'ramp'],
  };

  const lower = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(k => lower.includes(k))) tags.push(tag);
    if (tags.length >= 5) break;
  }
  return { tags, fallback: true };
}

function keywordResolutionTime(text: string, category?: string) {
  const lower = text.toLowerCase();
  if (lower.includes('emergency') || lower.includes('fire') || lower.includes('flooding')) {
    return { days: 1, confidence: 0.7, justification: 'Emergency-level response expected', fallback: true };
  }
  if (lower.includes('broken') || lower.includes('down') || lower.includes('out')) {
    return { days: 3, confidence: 0.6, justification: 'Standard repair timeline', fallback: true };
  }
  if (category === 'SANITATION' || category === 'UTILITIES') {
    return { days: 5, confidence: 0.5, justification: 'Category-based estimate', fallback: true };
  }
  if (category === 'INFRASTRUCTURE' || category === 'TRANSPORTATION') {
    return { days: 14, confidence: 0.5, justification: 'Project-based estimate', fallback: true };
  }
  return { days: 7, confidence: 0.4, justification: 'Default municipal response window', fallback: true };
}

function keywordDepartment(category: string, text: string) {
  const lower = text.toLowerCase();
  const map: Record<string, string> = {
    INFRASTRUCTURE: 'Public Works',
    PUBLIC_SAFETY: 'Police',
    SANITATION: 'Sanitation',
    UTILITIES: 'Utilities',
    HOUSING: 'Housing',
    ENVIRONMENT: 'Parks & Recreation',
    TRANSPORTATION: 'Transportation',
    EDUCATION: 'Education',
    HEALTH: 'Health',
    OTHER: 'General Services',
  };
  if (lower.includes('fire')) return { department: 'Fire', confidence: 0.85, fallback: true };
  if (lower.includes('water')) return { department: 'Utilities', confidence: 0.9, fallback: true };
  return { department: map[category] || 'General Services', confidence: 0.6, fallback: true };
}

async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  format?: string,
  locale?: string,
) {
  try {
    const response = await ollama.chat({
      model: MODEL,
      messages: withLocaleInstruction(messages, locale),
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
  detectLanguageHeuristic,

  async detectLanguage(text: string): Promise<ContentLocale> {
    const heuristic = detectLanguageHeuristic(text);
    if (heuristic === 'el') return 'el';
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: 'Detect whether the text is primarily English or Greek. Output ONLY valid JSON: {"language":"en"|"el"}',
        },
        { role: 'user', content: text.slice(0, 500) },
      ], 'json');
      const parsed = JSON.parse(response);
      return parsed.language === 'el' ? 'el' : 'en';
    } catch {
      return heuristic;
    }
  },

  /**
   * Populate bilingual title/description fields for dual storage.
   */
  async buildBilingualContent(title: string, description: string) {
    const contentLocale = await this.detectLanguage(`${title} ${description}`);
    const fallback = {
      contentLocale,
      titleEn: title,
      titleEl: title,
      descriptionEn: description,
      descriptionEl: description,
      fallback: true,
    };
    try {
      if (contentLocale === 'el') {
        const [tEn, dEn] = await Promise.all([
          this.translate(title, 'English'),
          this.translate(description, 'English'),
        ]);
        return {
          contentLocale: 'el' as const,
          titleEl: title,
          descriptionEl: description,
          titleEn: tEn.translation,
          descriptionEn: dEn.translation,
          fallback: !!(tEn.fallback || dEn.fallback),
        };
      }
      const [tEl, dEl] = await Promise.all([
        this.translate(title, 'Greek'),
        this.translate(description, 'Greek'),
      ]);
      return {
        contentLocale: 'en' as const,
        titleEn: title,
        descriptionEn: description,
        titleEl: tEl.translation,
        descriptionEl: dEl.translation,
        fallback: !!(tEl.fallback || dEl.fallback),
      };
    } catch {
      return fallback;
    }
  },

  async describeImage(imageBase64: string, locale?: string) {
    const lang = localeLabel(locale);
    const fallback = {
      title: 'Municipal infrastructure issue',
      description: 'A citizen-submitted photo shows a visible problem requiring municipal attention.',
      fallback: true,
    };
    try {
      const response = await ollama.chat({
        model: config.ollama.visionModel,
        messages: [{
          role: 'user',
          content: `You help citizens report municipal issues from photos. In ${lang}, suggest a concise issue title (max 12 words) and a 2-3 sentence description for staff.
Output ONLY valid JSON: {"title":"...","description":"..."}`,
          images: [imageBase64],
        }],
        stream: false,
        format: 'json',
      });
      try {
        const parsed = JSON.parse(response.message.content);
        return {
          title: parsed.title || fallback.title,
          description: parsed.description || fallback.description,
          fallback: false,
        };
      } catch {
        return fallback;
      }
    } catch (err: any) {
      console.warn('[AI] describeImage failed:', err.message);
      return fallback;
    }
  },

  async transcribeAudio(audioBase64: string, locale?: string) {
    const fallback = {
      transcript: '',
      fallback: true,
      error: 'Voice transcription unavailable',
    };
    try {
      const res = await fetch(`${config.ollama.baseUrl}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollama.whisperModel,
          file: audioBase64,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Transcribe failed (${res.status}): ${detail.slice(0, 200)}`);
      }
      const json = await res.json() as { text?: string };
      const transcript = (json.text || '').trim();
      if (!transcript) return { ...fallback, error: 'Empty transcript' };
      return { transcript, locale: locale || 'en', fallback: false };
    } catch (err: any) {
      console.warn('[AI] transcribe failed:', err.message);
      return { ...fallback, error: err.message };
    }
  },

  async categorize(text: string, locale?: string) {
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
      ], 'json', locale);
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

  /**
   * Detect possible duplicates of a new issue against existing issues.
   */
  async detectDuplicates(text: string, candidates: Array<{ id: string; title: string; description: string; category: string }>) {
    if (!candidates || candidates.length === 0) return { matches: [] };
    try {
      const candidatesText = candidates
        .map((c, idx) => `${idx + 1}. [${c.id}] [${c.category}] ${c.title}: ${c.description.slice(0, 120)}`)
        .join('\n');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are helping prevent duplicate municipal issue reports. Compare the user's report
against the existing issues. Return a JSON object listing up to 3 most similar existing issues
by ID with a similarity score from 0 to 1. Only include matches with score >= 0.4.
Output ONLY valid JSON: {"matches": [{"id": "...", "score": 0.0-1.0, "reason": "..."}]}`,
        },
        { role: 'user', content: `New report: ${text}\n\nExisting issues:\n${candidatesText}` },
      ], 'json');
      try {
        const parsed = JSON.parse(response);
        // Enrich with title/category for client display
        if (Array.isArray(parsed.matches)) {
          parsed.matches = parsed.matches.map((m: any) => {
            const c = candidates.find(x => x.id === m.id);
            return { ...m, title: c?.title, category: c?.category };
          });
        }
        return parsed;
      } catch {
        return keywordDuplicate(text, candidates);
      }
    } catch {
      return keywordDuplicate(text, candidates);
    }
  },

  /**
   * Suggest a brief plan describing how the city should resolve a reported issue.
   */
  async suggestResolution(text: string, category?: string) {
    try {
      const context = category ? `Category: ${category}. ` : '';
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal operations expert. ${context}Given a citizen issue,
produce a concise, action-oriented resolution plan in 3-5 short steps that the relevant
city department should follow. Reference relevant municipal best practices.`,
        },
        { role: 'user', content: text },
      ]);
      return { plan: response };
    } catch {
      return {
        plan: '1. Send an inspector to verify the report on-site.\n2. Document the issue with photographs and measurements.\n3. Coordinate with the responsible department for scheduling.\n4. Notify the reporter of the planned resolution timeline.',
        fallback: true,
      };
    }
  },

  /**
   * Expand a short title into a fuller description.
   */
  async generateDescription(title: string, category?: string) {
    try {
      const context = category ? ` Category: ${category}.` : '';
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are helping a citizen write a clear, factual municipal issue report.${context}
Given the title, draft a 3-4 sentence description that the citizen would submit. Include
what is happening, where, and any impact on the community. Do not invent specific addresses.`,
        },
        { role: 'user', content: `Title: ${title}` },
      ]);
      return { description: response };
    } catch {
      const lower = title.toLowerCase();
      return {
        description: `There is a ${lower} that needs attention from the relevant city department. Please send someone to assess and address this issue. The problem has been present recently and is affecting the local community.`,
        fallback: true,
      };
    }
  },

  /**
   * Extract short, relevant tag words from issue text.
   */
  async extractTags(text: string) {
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are tagging municipal issues. Extract up to 5 short, kebab-case tag words
that best describe the issue. Tags should be reusable across many reports.
Output ONLY valid JSON: {"tags": ["...", "..."]}`,
        },
        { role: 'user', content: text },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return keywordTags(text);
      }
    } catch {
      return keywordTags(text);
    }
  },

  /**
   * Predict how many days the issue will likely take to resolve.
   */
  async predictResolutionTime(text: string, category?: string) {
    try {
      const context = category ? `Category: ${category}. ` : '';
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal operations forecaster. ${context}Given a citizen issue,
estimate how many days it will take for the city to fully resolve it (1-30 days).
Output ONLY valid JSON: {"days": N, "confidence": 0.0-1.0, "justification": "..."}`,
        },
        { role: 'user', content: text },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return keywordResolutionTime(text, category);
      }
    } catch {
      return keywordResolutionTime(text, category);
    }
  },

  /**
   * Recommend the most appropriate department to handle the issue.
   */
  async suggestDepartment(text: string, category?: string) {
    try {
      const context = category ? `Category: ${category}. ` : '';
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal routing assistant. ${context}Given a citizen issue,
recommend the best city department to handle it (e.g. Public Works, Sanitation, Utilities,
Police, Fire, Parks & Recreation, Transportation, Health, Housing, Education, General Services).
Output ONLY valid JSON: {"department": "...", "confidence": 0.0-1.0}`,
        },
        { role: 'user', content: text },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return keywordDepartment(category || 'OTHER', text);
      }
    } catch {
      return keywordDepartment(category || 'OTHER', text);
    }
  },

  /**
   * Translate a piece of municipal feedback into a target language.
   * Falls back gracefully when no language is given or AI is unavailable.
   */
  async translate(text: string, targetLanguage = 'English') {
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal translation assistant. Translate the user's text into ${targetLanguage}.
Preserve tone and meaning. Return only the translated text, no extra commentary.`,
        },
        { role: 'user', content: text },
      ]);
      return { translation: response, language: targetLanguage };
    } catch {
      return { translation: text, language: targetLanguage, fallback: true };
    }
  },

  /**
   * Draft a citizen-friendly status update notification message.
   */
  async draftStatusUpdate(params: {
    title: string;
    oldStatus: string;
    newStatus: string;
    note?: string;
    locale?: string;
  }) {
    const { title, oldStatus, newStatus, note, locale = 'en' } = params;
    const lang = locale === 'el' ? 'Greek' : 'English';
    const fallback = {
      draft: `"${title}" has been updated from ${oldStatus.replace(/_/g, ' ').toLowerCase()} to ${newStatus.replace(/_/g, ' ').toLowerCase()}.${note ? ` ${note}` : ''}`,
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal communications assistant. Write a short, friendly status update
for a citizen who reported an issue. Use ${lang}. Keep it under 60 words. Be professional and reassuring.
Do not use markdown. Return only the message text.`,
        },
        {
          role: 'user',
          content: `Issue: "${title}"
Previous status: ${oldStatus}
New status: ${newStatus}
${note ? `Staff note: ${note}` : ''}`,
        },
      ]);
      return { draft: response.trim(), fallback: false };
    } catch {
      return fallback;
    }
  },

  /**
   * Semantic / intent-based search over a list of issues.
   */
  async smartSearch(query: string, issues: Array<{ id: string; title: string; description: string; category: string }>) {
    if (!issues || issues.length === 0) return { results: [] };
    const keywordRank = (q: string, list: Array<{ id: string; title: string; description: string; category: string }>) => {
      const tokens = new Set(q.toLowerCase().split(/\W+/).filter(w => w.length > 2));
      return {
        results: list
          .map(i => {
            const haystack = `${i.title} ${i.description}`.toLowerCase();
            const score = [...tokens].filter(t => haystack.includes(t)).length / Math.max(tokens.size, 1);
            return { id: i.id, title: i.title, category: i.category, score };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5),
        fallback: true,
      };
    };
    try {
      const list = issues.map((i, idx) => `${idx + 1}. [${i.id}] [${i.category}] ${i.title}: ${i.description.slice(0, 100)}`).join('\n');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal search assistant. Rank the following issues by relevance to the user's
search query. Return at most 5 results, most relevant first, by ID with a relevance score 0-1.
Output ONLY valid JSON: {"results": [{"id": "...", "score": 0.0-1.0, "reason": "..."}]}`,
        },
        { role: 'user', content: `Query: ${query}\n\nIssues:\n${list}` },
      ], 'json');
      try {
        const parsed = JSON.parse(response);
        if (Array.isArray(parsed.results)) {
          parsed.results = parsed.results.map((r: any) => {
            const issue = issues.find(i => i.id === r.id);
            return { ...r, title: issue?.title, category: issue?.category };
          });
        }
        return parsed;
      } catch {
        return keywordRank(query, issues);
      }
    } catch {
      return keywordRank(query, issues);
    }
  },

  async predictSlaRisk(params: {
    title: string;
    status: string;
    priority: number;
    hoursUntilDue: number;
    breached: boolean;
    hasFirstResponse: boolean;
    category?: string;
  }) {
    const { title, status, priority, hoursUntilDue, breached, hasFirstResponse, category } = params;
    let risk: 'low' | 'medium' | 'high' = 'low';
    let daysToBreach = Math.max(0, hoursUntilDue / 24);
    if (breached || hoursUntilDue <= 0) risk = 'high';
    else if (hoursUntilDue <= 8 || (priority >= 4 && !hasFirstResponse)) risk = 'high';
    else if (hoursUntilDue <= 24 || priority >= 3) risk = 'medium';

    const fallback = {
      risk,
      daysToBreach: Math.round(daysToBreach * 10) / 10,
      justification: breached
        ? 'SLA deadline has already passed.'
        : `Approximately ${Math.round(hoursUntilDue)} hours remain before SLA breach.`,
      fallback: true,
    };

    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal SLA risk analyst. Assess breach likelihood for an open issue.
Output ONLY valid JSON: {"risk": "low|medium|high", "daysToBreach": N, "justification": "..."}`,
        },
        {
          role: 'user',
          content: `Issue: "${title}"
Category: ${category || 'OTHER'}
Status: ${status}
Priority: ${priority}/5
Hours until SLA due: ${hoursUntilDue.toFixed(1)}
Already breached: ${breached}
First response recorded: ${hasFirstResponse}`,
        },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async narrateAnomalies(anomalies: Array<{ title: string; severity: string; desc: string }>) {
    if (!anomalies.length) return { summary: 'No anomalies detected.', items: [], fallback: true };
    const fallback = {
      summary: `${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected in the past 7 days.`,
      items: anomalies.map((a) => ({
        ...a,
        narrative: a.desc,
        recommendedAction: a.severity === 'HIGH' ? 'Review immediately with department head.' : 'Monitor and document.',
      })),
      fallback: true,
    };
    try {
      const list = anomalies.map((a, i) => `${i + 1}. [${a.severity}] ${a.title}: ${a.desc}`).join('\n');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal compliance auditor. Turn rule-based anomaly alerts into clear narratives
with recommended actions for auditors. Output ONLY valid JSON:
{"summary": "...", "items": [{"title": "...", "severity": "...", "narrative": "...", "recommendedAction": "..."}]}`,
        },
        { role: 'user', content: `Anomalies:\n${list}` },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async scoreResolution(params: { title: string; description: string; resolutionNote: string; category?: string }) {
    const { title, description, resolutionNote, category } = params;
    const wordCount = resolutionNote.trim().split(/\s+/).filter(Boolean).length;
    const fallbackScore = wordCount >= 20 ? 75 : wordCount >= 8 ? 55 : 35;
    const fallback = {
      score: fallbackScore,
      gaps: wordCount < 20 ? ['Add more detail about actions taken.'] : [],
      suggestions: ['Confirm the citizen can verify the fix on-site.'],
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal quality reviewer. Score a staff resolution note (0-100) for completeness,
citizen-facing tone, and evidence. Output ONLY valid JSON:
{"score": N, "gaps": ["..."], "suggestions": ["..."]}`,
        },
        {
          role: 'user',
          content: `Issue: "${title}" (${category || 'OTHER'})
Description: ${description.slice(0, 300)}
Resolution note: ${resolutionNote}`,
        },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async explainBallot(params: { title: string; description: string; body: string; type: 'poll' | 'referendum'; locale?: string }) {
    const lang = params.locale === 'el' ? 'Greek' : 'English';
    const text = params.body || params.description || params.title;
    const fallback = {
      explanation: `This ${params.type} asks citizens to decide on: ${params.title}. ${text.slice(0, 200)}`,
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a civic educator. Explain a municipal ${params.type} in plain ${lang} for everyday citizens.
Use short paragraphs, no legal jargon, under 120 words.`,
        },
        { role: 'user', content: `Title: ${params.title}\nDescription: ${params.description}\nFull text: ${text}` },
      ]);
      return { explanation: response.trim(), fallback: false };
    } catch {
      return fallback;
    }
  },

  async generateAgenda(params: {
    date: string;
    issues: Array<{ title: string; category: string; priority: number; status: string }>;
    resolutions: Array<{ title: string; status: string }>;
    maxItems?: number;
  }) {
    const max = params.maxItems ?? 10;
    const fallback = {
      title: `City Council Agenda — ${params.date}`,
      items: [
        ...params.issues.slice(0, max).map((i, idx) => ({
          order: idx + 1,
          title: i.title,
          type: 'issue',
          notes: `${i.category} · priority ${i.priority}/5 · ${i.status}`,
        })),
        ...params.resolutions.slice(0, 3).map((r, idx) => ({
          order: params.issues.length + idx + 1,
          title: r.title,
          type: 'resolution',
          notes: r.status,
        })),
      ],
      fallback: true,
    };
    try {
      const issueList = params.issues.map((i, idx) =>
        `${idx + 1}. [${i.category}] ${i.title} (P${i.priority}, ${i.status})`,
      ).join('\n');
      const resList = params.resolutions.map((r, idx) => `${idx + 1}. ${r.title} (${r.status})`).join('\n');
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal clerk. Build a concise meeting agenda JSON with at most ${max} items.
Output ONLY valid JSON: {"title": "...", "items": [{"order": N, "title": "...", "type": "issue|resolution", "notes": "..."}]}`,
        },
        { role: 'user', content: `Meeting date: ${params.date}\n\nPriority issues:\n${issueList || 'None'}\n\nPending resolutions:\n${resList || 'None'}` },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async moderateText(content: string) {
    const lower = content.toLowerCase();
    const toxic = ['idiot', 'stupid', 'hate', 'kill', 'threat'];
    const pii = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b/;
    const flagged = toxic.some((w) => lower.includes(w)) || pii.test(content);
    const fallback = {
      flag: flagged,
      severity: flagged ? 'medium' : 'none',
      reason: flagged ? 'Keyword or PII pattern detected' : 'No issues detected',
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a forum moderator for a municipal platform. Flag toxic language, threats, spam, or PII.
Output ONLY valid JSON: {"flag": true|false, "severity": "none|low|medium|high", "reason": "..."}`,
        },
        { role: 'user', content },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async analyzeRelatedImpact(params: {
    title: string;
    category: string;
    department?: string;
    ward?: string;
    context: string;
  }) {
    const fallback = {
      rootCause: `Multiple ${params.category.toLowerCase().replace(/_/g, ' ')} reports in the same area may share infrastructure or service gaps.`,
      impact: 'Nearby residents may experience similar problems until the underlying cause is addressed.',
      recommendations: ['Inspect shared infrastructure in the cluster area.', 'Coordinate a single work order if issues are linked.'],
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal operations analyst. Given a primary issue and related neighbors,
identify possible root causes, community impact, and 2-3 staff recommendations.
Output ONLY valid JSON:
{"rootCause": "...", "impact": "...", "recommendations": ["..."]}`,
        },
        {
          role: 'user',
          content: `Issue: "${params.title}" (${params.category})
Department: ${params.department || 'N/A'} | Ward: ${params.ward || 'N/A'}

${params.context}`,
        },
      ], 'json');
      try {
        return JSON.parse(response);
      } catch {
        return fallback;
      }
    } catch {
      return fallback;
    }
  },

  async generateSeasonalForecast(statsSummary: string) {
    const fallback = {
      narrative: 'Historical issue patterns suggest monitoring infrastructure and sanitation categories during seasonal transitions.',
      fallback: true,
    };
    try {
      const response = await chatCompletion([
        {
          role: 'system',
          content: `You are a municipal operations forecaster. Given monthly issue statistics, write a 3-4 sentence
forecast narrative for the mayor about expected demand spikes. Be specific about categories and timing.`,
        },
        { role: 'user', content: statsSummary },
      ]);
      return { narrative: response.trim(), fallback: false };
    } catch {
      return fallback;
    }
  },
};
