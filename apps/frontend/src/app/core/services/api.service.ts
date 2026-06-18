import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Issue, PaginatedResponse, DashboardStats, User, Notification, Department, Ward, Resolution, Poll, Event, Announcement, Attachment, Survey, Forum, ForumPost, IssueTemplate } from '@dd/shared-types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Issues
  getIssues(params: Record<string, string> = {}): Observable<PaginatedResponse<Issue>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) httpParams = httpParams.set(key, value);
    });
    return this.http.get<PaginatedResponse<Issue>>(`${this.apiUrl}/issues`, { params: httpParams }) as any;
  }

  getIssue(id: string): Observable<{ success: boolean; data: Issue }> {
    return this.http.get<{ success: boolean; data: Issue }>(`${this.apiUrl}/issues/${id}`);
  }

  createIssue(data: Partial<Issue>): Observable<{ success: boolean; data: Issue }> {
    return this.http.post<{ success: boolean; data: Issue }>(`${this.apiUrl}/issues`, data);
  }

  updateIssueStatus(
    id: string,
    status: string,
    note?: string,
    notificationMessage?: string,
  ): Observable<{ success: boolean; data: Issue }> {
    return this.http.patch<{ success: boolean; data: Issue }>(
      `${this.apiUrl}/issues/${id}/status`,
      { status, note, notificationMessage },
    );
  }

  assignIssue(id: string, assigneeId: string, departmentId?: string): Observable<{ success: boolean; data: Issue }> {
    return this.http.patch<{ success: boolean; data: Issue }>(`${this.apiUrl}/issues/${id}/assign`, { assigneeId, departmentId });
  }

  upvoteIssue(id: string): Observable<{ success: boolean; data: { voted: boolean } }> {
    return this.http.post<{ success: boolean; data: { voted: boolean } }>(`${this.apiUrl}/issues/${id}/upvote`, {});
  }

  getDepartmentResolutionRates(): Observable<{ success: boolean; data: Array<{ department: string; total: number; resolved: number; pct: number }> }> {
    return this.http.get<{ success: boolean; data: Array<{ department: string; total: number; resolved: number; pct: number }> }>(
      `${this.apiUrl}/issues/stats/departments`
    );
  }

  getIssueStats(params?: Record<string, string>): Observable<{ success: boolean; data: DashboardStats }> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<{ success: boolean; data: DashboardStats }>(`${this.apiUrl}/issues/stats`, { params: httpParams });
  }

  /**
   * Semantic ("smart") search over the issues table. Returns issues in
   * similarity order with a `score` field (cosine similarity 0-1). The
   * backend falls back to plain text matching if the embedding service
   * is unavailable, and surfaces that via `mode: 'text-fallback'`.
   */
  searchSimilarIssues(text: string, topK: number = 5, minScore: number = 0.2): Observable<{ success: boolean; data: any[]; total: number; mode: 'semantic' | 'text-fallback' | 'text-empty'; query: string }> {
    const params = new HttpParams()
      .set('text', text)
      .set('topK', String(topK))
      .set('minScore', String(minScore));
    return this.http.get<{ success: boolean; data: any[]; total: number; mode: 'semantic' | 'text-fallback' | 'text-empty'; query: string }>(
      `${this.apiUrl}/issues/search-similar`,
      { params },
    );
  }

  getIssueTemplates(): Observable<{ success: boolean; data: IssueTemplate[] }> {
    return this.http.get<{ success: boolean; data: IssueTemplate[] }>(`${this.apiUrl}/issues/templates`);
  }

  bulkUpdateIssues(ids: string[], updates: { status?: string; assigneeId?: string; departmentId?: string }): Observable<{ success: boolean; data: Issue[] }> {
    return this.http.patch<{ success: boolean; data: Issue[] }>(`${this.apiUrl}/issues/bulk`, { ids, ...updates });
  }

  exportIssuesCsv(params: Record<string, string> = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/reports/issues.csv`, { params: httpParams, responseType: 'blob' });
  }

  /**
   * RAG-style summary of all issues inside a user-drawn polygon on the map.
   * Returns the count, a sample of the issues, and an AI-generated prose summary.
   */
  summarizeArea(polygon: Array<[number, number]>): Observable<{ success: boolean; data: { count: number; issues: Array<{ id: string; title: string; category: string; status: string; department: string | null }>; summary: string; fallback?: boolean } }> {
    return this.http.post<{ success: boolean; data: { count: number; issues: Array<{ id: string; title: string; category: string; status: string; department: string | null }>; summary: string; fallback?: boolean } }>(
      `${this.apiUrl}/issues/summarize-area`,
      { polygon },
    );
  }

  clusterReport(polygon: Array<[number, number]>): Observable<{ success: boolean; data: { totalIssues: number; clusters: Array<{ label: string; category: string; count: number; issueIds: string[]; sampleTitles: string[] }>; narrative: string; fallback?: boolean } }> {
    return this.http.post<{ success: boolean; data: { totalIssues: number; clusters: Array<{ label: string; category: string; count: number; issueIds: string[]; sampleTitles: string[] }>; narrative: string; fallback?: boolean } }>(
      `${this.apiUrl}/issues/cluster-report`,
      { polygon },
    );
  }

  aiRelatedImpact(issueId: string): Observable<{ success: boolean; data: { semanticNeighbors: any[]; spatialNeighbors: any[]; analysis: { rootCause: string; impact: string; recommendations: string[]; fallback?: boolean } } }> {
    return this.http.post<{ success: boolean; data: { semanticNeighbors: any[]; spatialNeighbors: any[]; analysis: { rootCause: string; impact: string; recommendations: string[]; fallback?: boolean } } }>(
      `${this.apiUrl}/ai/related-impact`,
      { issueId },
    );
  }

  exportAuditCsv(params: Record<string, string> = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/reports/audit.csv`, { params: httpParams, responseType: 'blob' });
  }

  // Users
  getUsers(params: Record<string, string> = {}): Observable<PaginatedResponse<User>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/users`, { params: httpParams }) as any;
  }

  getUser(id: string): Observable<{ success: boolean; data: User }> {
    return this.http.get<{ success: boolean; data: User }>(`${this.apiUrl}/users/${id}`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, data);
  }

  updateUser(id: string, data: Partial<User>): Observable<{ success: boolean; data: User }> {
    return this.http.patch<{ success: boolean; data: User }>(`${this.apiUrl}/users/${id}`, data);
  }

  getUserStats(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/users/stats`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/change-password`, { currentPassword, newPassword });
  }

  // Notifications
  getNotifications(params: Record<string, string> = {}): Observable<PaginatedResponse<Notification>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<PaginatedResponse<Notification>>(`${this.apiUrl}/notifications`, { params: httpParams }) as any;
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/read-all`, {});
  }

  // Attachments
  uploadAttachment(issueId: string, file: File): Observable<{ success: boolean; data: Attachment }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; data: Attachment }>(
      `${this.apiUrl}/issues/${issueId}/attachments`,
      formData
    );
  }

  getAttachments(issueId: string): Observable<{ success: boolean; data: Attachment[] }> {
    return this.http.get<{ success: boolean; data: Attachment[] }>(
      `${this.apiUrl}/issues/${issueId}/attachments`
    );
  }

  deleteAttachment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/attachments/${id}`);
  }

  // Departments
  getDepartments(): Observable<{ success: boolean; data: Department[] }> {
    return this.http.get<{ success: boolean; data: Department[] }>(`${this.apiUrl}/departments`);
  }

  createDepartment(data: Partial<Department>): Observable<{ success: boolean; data: Department }> {
    return this.http.post<{ success: boolean; data: Department }>(`${this.apiUrl}/departments`, data);
  }

  getWards(): Observable<{ success: boolean; data: Ward[] }> {
    return this.http.get<{ success: boolean; data: Ward[] }>(`${this.apiUrl}/departments/wards`);
  }

  createWard(data: Partial<Ward>): Observable<{ success: boolean; data: Ward }> {
    return this.http.post<{ success: boolean; data: Ward }>(`${this.apiUrl}/departments/wards`, data);
  }

  // AI
  aiCategorize(text: string, locale?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/categorize`, { text, locale });
  }

  aiHealth(): Observable<{ success: boolean; data: {
    status: string;
    tier: string;
    ollamaReachable: boolean;
    recommendedChatModel: string;
    configured: { chatModel: string; embedModel: string; visionModel: string; whisperModel: string };
    pulledModels: string[];
    chatLatencyMs: number | null;
    ram: { totalGb: number; freeGb: number };
    capabilities: { chat: boolean; embeddings: boolean; vision: boolean; voice: boolean; bilingual: boolean };
    warnings: string[];
  } }> {
    return this.http.get<{ success: boolean; data: {
      status: string;
      tier: string;
      ollamaReachable: boolean;
      recommendedChatModel: string;
      configured: { chatModel: string; embedModel: string; visionModel: string; whisperModel: string };
      pulledModels: string[];
      chatLatencyMs: number | null;
      ram: { totalGb: number; freeGb: number };
      capabilities: { chat: boolean; embeddings: boolean; vision: boolean; voice: boolean; bilingual: boolean };
      warnings: string[];
    } }>(`${this.apiUrl}/ai/health`);
  }

  aiDescribeImage(file: File, locale?: string): Observable<{ success: boolean; data: { title: string; description: string; fallback?: boolean } }> {
    const form = new FormData();
    form.append('image', file);
    if (locale) form.append('locale', locale);
    return this.http.post<{ success: boolean; data: { title: string; description: string; fallback?: boolean } }>(
      `${this.apiUrl}/ai/describe-image`,
      form,
    );
  }

  aiTranscribe(audio: Blob, locale?: string, filename = 'recording.webm'): Observable<{ success: boolean; data: { transcript: string; fallback?: boolean } }> {
    const form = new FormData();
    form.append('audio', audio, filename);
    if (locale) form.append('locale', locale);
    return this.http.post<{ success: boolean; data: { transcript: string; fallback?: boolean } }>(
      `${this.apiUrl}/ai/transcribe`,
      form,
    );
  }

  aiPrioritize(text: string, category?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/priority`, { text, category });
  }

  aiSentiment(text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/sentiment`, { text });
  }

  aiSummarize(text: string, maxLength?: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/summary`, { text, maxLength });
  }

  aiTrends(issues: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/trends`, { issues });
  }

  aiChat(messages: { role: string; content: string }[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/chat`, { messages });
  }

  aiDuplicates(text: string, candidates: Array<{ id: string; title: string; description: string; category: string }>): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/duplicates`, { text, candidates });
  }

  aiSuggestResolution(text: string, category?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/resolve`, { text, category });
  }

  aiGenerateDescription(title: string, category?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/describe`, { title, category });
  }

  aiExtractTags(text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/tags`, { text });
  }

  aiResolutionTime(text: string, category?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/resolution-time`, { text, category });
  }

  aiSuggestDepartment(text: string, category?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/department`, { text, category });
  }

  aiTranslate(text: string, language: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/translate`, { text, language });
  }

  aiSmartSearch(query: string, issues: Array<{ id: string; title: string; description: string; category: string }>): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/search`, { query, issues });
  }

  aiDraftStatusUpdate(params: {
    title: string;
    oldStatus: string;
    newStatus: string;
    note?: string;
    locale?: string;
  }): Observable<{ success: boolean; data: { draft: string; fallback?: boolean } }> {
    return this.http.post<{ success: boolean; data: { draft: string; fallback?: boolean } }>(
      `${this.apiUrl}/ai/draft-status-update`,
      params,
    );
  }

  getDuplicateCandidates(limit = 20): Observable<{ success: boolean; data: any[]; total: number }> {
    return this.http.get<{ success: boolean; data: any[]; total: number }>(
      `${this.apiUrl}/issues/duplicate-candidates`,
      { params: new HttpParams().set('limit', String(limit)) },
    );
  }

  linkIssueDuplicate(duplicateId: string, canonicalId: string): Observable<{ success: boolean; data: Issue }> {
    return this.http.patch<{ success: boolean; data: Issue }>(
      `${this.apiUrl}/issues/${duplicateId}/link-duplicate`,
      { canonicalId },
    );
  }

  getLatestWardDigest(wardId?: string): Observable<{ success: boolean; data: WardDigestRow | null }> {
    let params = new HttpParams();
    if (wardId) params = params.set('wardId', wardId);
    return this.http.get<{ success: boolean; data: WardDigestRow | null }>(
      `${this.apiUrl}/ward-digests/latest`,
      { params },
    );
  }

  generateWardDigest(wardId?: string): Observable<{ success: boolean; data: WardDigestRow; created: boolean }> {
    return this.http.post<{ success: boolean; data: WardDigestRow; created: boolean }>(
      `${this.apiUrl}/ward-digests/generate`,
      wardId ? { wardId } : {},
    );
  }

  aiSlaRisk(issueIds: string[]): Observable<{ success: boolean; data: Array<{ issueId: string; risk: string; daysToBreach: number; justification: string }> }> {
    return this.http.post<{ success: boolean; data: Array<{ issueId: string; risk: string; daysToBreach: number; justification: string }> }>(
      `${this.apiUrl}/ai/sla-risk`,
      { issueIds },
    );
  }

  aiScoreResolution(params: { title: string; description?: string; resolutionNote: string; category?: string }): Observable<{ success: boolean; data: { score: number; gaps: string[]; suggestions: string[] } }> {
    return this.http.post<{ success: boolean; data: { score: number; gaps: string[]; suggestions: string[] } }>(
      `${this.apiUrl}/ai/score-resolution`,
      params,
    );
  }

  aiExplainBallot(params: { title: string; description?: string; body?: string; type: 'poll' | 'referendum'; locale?: string }): Observable<{ success: boolean; data: { explanation: string } }> {
    return this.http.post<{ success: boolean; data: { explanation: string } }>(
      `${this.apiUrl}/ai/explain-ballot`,
      params,
    );
  }

  aiGenerateAgenda(params?: { date?: string; maxItems?: number; departmentId?: string }): Observable<{ success: boolean; data: { title: string; items: Array<{ order: number; title: string; type: string; notes: string }> } }> {
    return this.http.post<{ success: boolean; data: { title: string; items: Array<{ order: number; title: string; type: string; notes: string }> } }>(
      `${this.apiUrl}/ai/generate-agenda`,
      params || {},
    );
  }

  getFlaggedForumPosts(limit = 20): Observable<{ success: boolean; data: any[]; total: number }> {
    return this.http.get<{ success: boolean; data: any[]; total: number }>(
      `${this.apiUrl}/forums/flagged-posts`,
      { params: new HttpParams().set('limit', String(limit)) },
    );
  }

  getLatestSeasonalForecast(): Observable<{ success: boolean; data: SeasonalForecastRow | null }> {
    return this.http.get<{ success: boolean; data: SeasonalForecastRow | null }>(
      `${this.apiUrl}/seasonal-forecasts/latest`,
    );
  }

  generateSeasonalForecast(): Observable<{ success: boolean; data: SeasonalForecastRow; created: boolean }> {
    return this.http.post<{ success: boolean; data: SeasonalForecastRow; created: boolean }>(
      `${this.apiUrl}/seasonal-forecasts/generate`,
      {},
    );
  }

  /**
   * RAG-augmented chat. Pass `useRag: false` to skip retrieval.
   * Response shape: { success, data: { answer: string, citations: ChatCitation[], ragUsed: boolean, fallback?: boolean } }
   * `ragUsed` is true only when at least one citation was actually returned.
   */
  aiChatWithCitations(messages: { role: string; content: string }[], useRag: boolean = true): Observable<{ success: boolean; data: { answer: string; citations: Array<{ documentId: string; title: string; type: string; source: string; documentDate: string | null; chunkIndex: number; score: number; chunk: string }>; ragUsed: boolean; fallback?: boolean } }> {
    return this.http.post<{ success: boolean; data: { answer: string; citations: Array<{ documentId: string; title: string; type: string; source: string; documentDate: string | null; chunkIndex: number; score: number; chunk: string }>; ragUsed: boolean; fallback?: boolean } }>(
      `${this.apiUrl}/ai/chat`, { messages, useRag }
    );
  }

  async aiChatStream(
    messages: { role: string; content: string }[],
    useRag: boolean = true,
    onChunk: (text: string) => void,
    onMeta?: (meta: { citations: any[]; ragUsed: boolean }) => void
  ): Promise<void> {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${this.apiUrl}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
      },
      body: JSON.stringify({ messages, useRag })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported by response body');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned.startsWith('data: ')) continue;
        
        const dataStr = cleaned.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'meta') {
            if (onMeta) onMeta({ citations: parsed.citations, ragUsed: parsed.ragUsed });
          } else if (parsed.type === 'content') {
            onChunk(parsed.content);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (e) {
          // ignore parsing error for partial buffers or heartbeats
        }
      }
    }
  }


  // Documents (legislation KB) — admin only
  listDocuments(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/admin/documents`);
  }

  getDocument(id: string): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/admin/documents/${id}`);
  }

  /**
   * Upload / ingest a document. Either pass `file` (PDF / .txt) or
   * `content` (text) — exactly one of the two is required.
   */
  uploadDocument(input: { title: string; type: string; source: string; documentDate?: string; description?: string; file?: File; content?: string }): Observable<{ success: boolean; data: { documentId: string; chunksCreated: number; skipped: boolean }; message: string }> {
    if (input.file) {
      const fd = new FormData();
      fd.append('file', input.file);
      fd.append('title', input.title);
      fd.append('type', input.type);
      fd.append('source', input.source);
      if (input.documentDate) fd.append('documentDate', input.documentDate);
      if (input.description) fd.append('description', input.description);
      return this.http.post<{ success: boolean; data: { documentId: string; chunksCreated: number; skipped: boolean }; message: string }>(
        `${this.apiUrl}/admin/documents`, fd,
      );
    }
    return this.http.post<{ success: boolean; data: { documentId: string; chunksCreated: number; skipped: boolean }; message: string }>(
      `${this.apiUrl}/admin/documents`, input,
    );
  }

  /**
   * Semantic search over the legislation KB (no LLM). Returns the raw
   * matching chunks with their similarity scores, suitable for an admin
   * "browse legislation" page that audits which content would be cited.
   */
  retrieveDocuments(query: string, topK: number = 5, minScore: number = 0.3): Observable<{ success: boolean; data: { query: string; chunks: Array<{ chunkId: string; documentId: string; documentTitle: string; documentType: string; documentSource: string; documentDate: string | null; chunkIndex: number; content: string; score: number }>; count: number } }> {
    return this.http.post<{ success: boolean; data: { query: string; chunks: Array<{ chunkId: string; documentId: string; documentTitle: string; documentType: string; documentSource: string; documentDate: string | null; chunkIndex: number; content: string; score: number }>; count: number } }>(
      `${this.apiUrl}/admin/documents/retrieve`, { query, topK, minScore }
    );
  }

  deleteDocument(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/admin/documents/${id}`);
  }

  // Comments
  getComments(issueId: string, params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/issues/${issueId}/comments`, { params: httpParams });
  }

  createComment(issueId: string, data: { content: string; parentId?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/issues/${issueId}/comments`, data);
  }

  deleteComment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/comments/${id}`);
  }

  // Events
  getEvents(params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/events`, { params: httpParams });
  }

  getEvent(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/events/${id}`);
  }

  createEvent(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/events`, data);
  }

  updateEvent(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/events/${id}`, data);
  }

  deleteEvent(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/events/${id}`);
  }

  rsvpEvent(id: string, status: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/events/${id}/rsvp`, { status });
  }

  cancelRsvpEvent(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/events/${id}/rsvp`);
  }

  // Announcements
  getAnnouncements(params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/announcements`, { params: httpParams });
  }

  getAnnouncement(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/announcements/${id}`);
  }

  createAnnouncement(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/announcements`, data);
  }

  updateAnnouncement(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/announcements/${id}`, data);
  }

  deleteAnnouncement(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/announcements/${id}`);
  }

  // Polls
  getPolls(params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/polls`, { params: httpParams });
  }

  getPoll(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/polls/${id}`);
  }

  createPoll(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/polls`, data);
  }

  votePoll(id: string, optionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/polls/${id}/vote`, { optionId });
  }

  closePoll(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/polls/${id}/close`, {});
  }

  // Resolutions
  getResolutions(params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/resolutions`, { params: httpParams });
  }

  getResolution(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/resolutions/${id}`);
  }

  createResolution(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/resolutions`, data);
  }

  voteResolution(id: string, voteFor: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/resolutions/${id}/vote`, { voteFor });
  }

  updateResolutionStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/resolutions/${id}/status`, { status });
  }

  // Referendums (Phase D1) — distinct from Resolutions: public ballot with YES/NO/ABSTAIN
  getReferendums(params: Record<string, string> = {}): Observable<{ success: boolean; data: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<{ success: boolean; data: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `${this.apiUrl}/referendums`, { params: httpParams },
    );
  }

  getReferendum(id: string): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}`);
  }

  getMyReferendumVote(id: string): Observable<{ success: boolean; data: { choice: 'YES' | 'NO' | 'ABSTAIN' } | null }> {
    return this.http.get<{ success: boolean; data: { choice: 'YES' | 'NO' | 'ABSTAIN' } | null }>(
      `${this.apiUrl}/referendums/${id}/my-vote`,
    );
  }

  getReferendumVotes(id: string): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/referendums/${id}/votes`);
  }

  createReferendum(data: {
    title: string; description: string; body: string;
    opensAt: string; closesAt: string;
    passThreshold?: number; minParticipation?: number; eligibleRoles?: string[];
  }): Observable<{ success: boolean; data: any }> {
    return this.http.post<{ success: boolean; data: any }>(`${this.apiUrl}/referendums`, data);
  }

  updateReferendum(id: string, data: any): Observable<{ success: boolean; data: any }> {
    return this.http.patch<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}`, data);
  }

  updateReferendumStatus(id: string, status: string): Observable<{ success: boolean; data: any }> {
    return this.http.patch<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}/status`, { status });
  }

  voteReferendum(id: string, choice: 'YES' | 'NO' | 'ABSTAIN'): Observable<{ success: boolean; data: any }> {
    return this.http.post<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}/vote`, { choice });
  }

  closeReferendum(id: string): Observable<{ success: boolean; data: any }> {
    return this.http.post<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}/close`, {});
  }

  deleteReferendum(id: string): Observable<{ success: boolean; data: any }> {
    return this.http.delete<{ success: boolean; data: any }>(`${this.apiUrl}/referendums/${id}`);
  }

  // Transparency Portal (Phase D2) — public, no auth required
  getPortalStats(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/portal/stats`);
  }

  getPortalIssues(params: Record<string, string> = {}): Observable<{ success: boolean; data: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<{ success: boolean; data: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `${this.apiUrl}/portal/issues`, { params: httpParams },
    );
  }

  getPortalRecentIssues(limit: number = 10): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/issues/recent?limit=${limit}`);
  }

  getPortalTopIssues(limit: number = 10): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/issues/top?limit=${limit}`);
  }

  getPortalDepartments(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/departments`);
  }

  getPortalWards(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/wards`);
  }

  getPortalAnnouncements(limit: number = 20): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/announcements?limit=${limit}`);
  }

  getPortalMeetings(limit: number = 20): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/meetings?limit=${limit}`);
  }

  getPortalUpcomingEvents(limit: number = 10): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/events/upcoming?limit=${limit}`);
  }

  getPortalReferendums(limit: number = 10): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/referendums?limit=${limit}`);
  }

  getPortalResolutions(limit: number = 20): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/portal/resolutions?limit=${limit}`);
  }

  getPortalFaq(limit: number = 20): Observable<{ success: boolean; data: Array<{ id: string; question: string; answer: string; category: string | null }>; total: number }> {
    return this.http.get<{ success: boolean; data: Array<{ id: string; question: string; answer: string; category: string | null }>; total: number }>(
      `${this.apiUrl}/portal/faq`,
      { params: new HttpParams().set('limit', String(limit)) },
    );
  }

  // Messages
  getConversations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/conversations`);
  }

  getConversation(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/conversations/${userId}`);
  }

  sendMessage(receiverId: string, content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages`, { receiverId, content });
  }

  // Audit Logs
  getAuditAnomalies(): Observable<{ success: boolean; data: { anomalies: Array<{ title: string; severity: string; desc: string; date: string }>; summary: string; items: Array<{ title: string; severity: string; narrative: string; recommendedAction: string }> } }> {
    return this.http.get<{ success: boolean; data: { anomalies: Array<{ title: string; severity: string; desc: string; date: string }>; summary: string; items: Array<{ title: string; severity: string; narrative: string; recommendedAction: string }> } }>(
      `${this.apiUrl}/audit/anomalies`
    );
  }

  getAuditLogs(params: Record<string, string> = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get(`${this.apiUrl}/audit`, { params: httpParams });
  }

  getAuditTrail(entity: string, entityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/audit/entity/${entity}/${entityId}`);
  }

  // Surveys
  getSurveys(params: Record<string, string> = {}): Observable<PaginatedResponse<Survey>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<PaginatedResponse<Survey>>(`${this.apiUrl}/surveys`, { params: httpParams }) as any;
  }

  getSurvey(id: string): Observable<{ success: boolean; data: Survey }> {
    return this.http.get<{ success: boolean; data: Survey }>(`${this.apiUrl}/surveys/${id}`);
  }

  createSurvey(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/surveys`, data);
  }

  submitSurveyResponse(id: string, answers: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/surveys/${id}/respond`, { answers });
  }

  closeSurvey(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/surveys/${id}/close`, {});
  }

  // Forums
  getForums(params: Record<string, string> = {}): Observable<PaginatedResponse<Forum>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => { if (value) httpParams = httpParams.set(key, value); });
    return this.http.get<PaginatedResponse<Forum>>(`${this.apiUrl}/forums`, { params: httpParams }) as any;
  }

  getForum(id: string): Observable<{ success: boolean; data: Forum }> {
    return this.http.get<{ success: boolean; data: Forum }>(`${this.apiUrl}/forums/${id}`);
  }

  createForum(data: { title: string; description?: string }): Observable<{ success: boolean; data: Forum }> {
    return this.http.post<{ success: boolean; data: Forum }>(`${this.apiUrl}/forums`, data);
  }

  addForumPost(forumId: string, content: string): Observable<{ success: boolean; data: ForumPost }> {
    return this.http.post<{ success: boolean; data: ForumPost }>(`${this.apiUrl}/forums/${forumId}/posts`, { content });
  }

  // Auth password reset
  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  // Phase B — feature sweep (subscriptions, notes, SLA, prefs)

  subscribeToIssue(issueId: string): Observable<{ success: boolean; data: { issueId: string; userId: string } }> {
    return this.http.post<{ success: boolean; data: { issueId: string; userId: string } }>(
      `${this.apiUrl}/issues/${issueId}/subscribe`, {},
    );
  }

  unsubscribeFromIssue(issueId: string): Observable<{ success: boolean; data: { removed: number } }> {
    return this.http.delete<{ success: boolean; data: { removed: number } }>(
      `${this.apiUrl}/issues/${issueId}/subscribe`,
    );
  }

  getMySubscriptions(): Observable<{ success: boolean; data: Array<{ issueId: string; issue?: Issue }> }> {
    return this.http.get<{ success: boolean; data: Array<{ issueId: string; issue?: Issue }> }>(
      `${this.apiUrl}/users/me/subscriptions`,
    );
  }

  getInternalNotes(issueId: string): Observable<{ success: boolean; data: Array<{ id: string; content: string; createdAt: string; author?: { firstName: string; lastName: string } }> }> {
    return this.http.get<{ success: boolean; data: Array<{ id: string; content: string; createdAt: string; author?: { firstName: string; lastName: string } }> }>(
      `${this.apiUrl}/issues/${issueId}/internal-notes`,
    );
  }

  addInternalNote(issueId: string, content: string): Observable<{ success: boolean; data: { id: string; content: string } }> {
    return this.http.post<{ success: boolean; data: { id: string; content: string } }>(
      `${this.apiUrl}/issues/${issueId}/internal-notes`, { content },
    );
  }

  getIssueSla(issueId: string): Observable<{ success: boolean; data: { priority: string; dueAt: string; breached: boolean; firstResponseAt?: string } | null }> {
    return this.http.get<{ success: boolean; data: { priority: string; dueAt: string; breached: boolean; firstResponseAt?: string } | null }>(
      `${this.apiUrl}/issues/${issueId}/sla`,
    );
  }

  getNotificationPrefs(): Observable<{ success: boolean; data: Array<{ channel: string; type: string; enabled: boolean }> }> {
    return this.http.get<{ success: boolean; data: Array<{ channel: string; type: string; enabled: boolean }> }>(
      `${this.apiUrl}/users/me/notification-prefs`,
    );
  }

  updateNotificationPrefs(
    preferences: Array<{ channel: 'inApp' | 'email' | 'push'; type: string; enabled: boolean }>,
  ): Observable<{ success: boolean; data: Array<{ channel: string; type: string; enabled: boolean }> }> {
    return this.http.put<{ success: boolean; data: Array<{ channel: string; type: string; enabled: boolean }> }>(
      `${this.apiUrl}/users/me/notification-prefs`, { preferences },
    );
  }

  // Phase C — weekly executive briefings
  getLatestWeeklySummary(): Observable<{ success: boolean; data: WeeklySummaryRow | null }> {
    return this.http.get<{ success: boolean; data: WeeklySummaryRow | null }>(`${this.apiUrl}/weekly-summaries/latest`);
  }

  generateWeeklySummary(force = false): Observable<{ success: boolean; data: WeeklySummaryRow; created: boolean }> {
    return this.http.post<{ success: boolean; data: WeeklySummaryRow; created: boolean }>(
      `${this.apiUrl}/weekly-summaries`, { force },
    );
  }

  // Phase B — share links
  createShareLink(issueId: string, expiresInDays?: number): Observable<{ success: boolean; data: { id: string; token: string; expiresAt?: string } }> {
    return this.http.post<{ success: boolean; data: { id: string; token: string; expiresAt?: string } }>(
      `${this.apiUrl}/issues/${issueId}/share-link`,
      expiresInDays != null ? { expiresInDays } : {},
    );
  }

  resolveShareLink(token: string): Observable<{ success: boolean; data: { token: string; issue: Issue; expiresAt?: string } }> {
    return this.http.get<{ success: boolean; data: { token: string; issue: Issue; expiresAt?: string } }>(
      `${this.apiUrl}/share/${token}`,
    );
  }
}

export interface WeeklySummaryRow {
  id: string;
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  body: string;
  highlights: Array<{ title: string; body: string }>;
  stats: Record<string, unknown>;
  generatedAt: string;
  source: string;
}

export interface WardDigestRow {
  id: string;
  wardId: string;
  dateKey: string;
  body: string;
  issueCount: number;
  issueIds: string[];
  generatedAt: string;
  source: string;
  ward?: { id: string; name: string; code: string };
}

export interface SeasonalForecastRow {
  id: string;
  monthKey: string;
  stats: Record<string, unknown>;
  narrative: string;
  generatedAt: string;
  source: string;
}
