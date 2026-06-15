export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MAYOR = 'MAYOR',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  COUNCIL_MEMBER = 'COUNCIL_MEMBER',
  STAFF = 'STAFF',
  WARD_REP = 'WARD_REP',
  CITIZEN = 'CITIZEN',
  VOLUNTEER = 'VOLUNTEER',
  AUDITOR = 'AUDITOR',
  MEDIA = 'MEDIA',
}

export enum IssueCategory {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  PUBLIC_SAFETY = 'PUBLIC_SAFETY',
  SANITATION = 'SANITATION',
  UTILITIES = 'UTILITIES',
  HOUSING = 'HOUSING',
  ENVIRONMENT = 'ENVIRONMENT',
  TRANSPORTATION = 'TRANSPORTATION',
  EDUCATION = 'EDUCATION',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
}

export enum IssueStatus {
  SUBMITTED = 'SUBMITTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  RESOLVED = 'RESOLVED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  REOPENED = 'REOPENED',
}

export enum NotificationType {
  ISSUE_ASSIGNED = 'ISSUE_ASSIGNED',
  ISSUE_STATUS_CHANGED = 'ISSUE_STATUS_CHANGED',
  ISSUE_COMMENT = 'ISSUE_COMMENT',
  ISSUE_MENTION = 'ISSUE_MENTION',
  VOTE_RECEIVED = 'VOTE_RECEIVED',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  EVENT_REMINDER = 'EVENT_REMINDER',
  SURVEY_NEW = 'SURVEY_NEW',
  RESOLUTION_VOTE = 'RESOLUTION_VOTE',
  SYSTEM = 'SYSTEM',
}

export enum EventType {
  COUNCIL_MEETING = 'COUNCIL_MEETING',
  PUBLIC_HEARING = 'PUBLIC_HEARING',
  COMMUNITY_EVENT = 'COMMUNITY_EVENT',
  VOLUNTEER_EVENT = 'VOLUNTEER_EVENT',
  TOWN_HALL = 'TOWN_HALL',
  WORKSHOP = 'WORKSHOP',
}

export enum ResolutionStatus {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  VOTING = 'VOTING',
  PASSED = 'PASSED',
  REJECTED = 'REJECTED',
  IMPLEMENTED = 'IMPLEMENTED',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  wardId?: string;
  departmentId?: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  priority?: number;
  priorityJustification?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  upvotes: number;
  viewCount: number;
  isPublic: boolean;
  reporterId: string;
  reporter?: User;
  assigneeId?: string;
  assignee?: User;
  departmentId?: string;
  department?: { id: string; name: string };
  wardId?: string;
  ward?: { id: string; name: string };
  aiCategory?: string;
  aiSentiment?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  user?: User;
  issueId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  value: number;
  userId: string;
  issueId?: string;
  surveyId?: string;
  pollId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  issueId: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  budget?: number;
  headId?: string;
  head?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Ward {
  id: string;
  name: string;
  code: string;
  description?: string;
  boundary?: GeoJSON.Feature;
  createdAt: string;
  updatedAt: string;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creator?: User;
  isActive: boolean;
  closesAt?: string;
  createdAt: string;
  questions?: SurveyQuestion[];
  _count?: { responses: number };
}

export interface Forum {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creator?: User;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  posts?: ForumPost[];
  _count?: { posts: number };
}

export interface ForumPost {
  id: string;
  forumId: string;
  authorId: string;
  author?: User;
  content: string;
  createdAt: string;
}

export interface IssueTemplate {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  text: string;
  type: 'TEXT' | 'MULTIPLE_CHOICE' | 'RATING' | 'YES_NO';
  options?: string[];
  order: number;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  isActive: boolean;
  closesAt?: string;
  createdAt: string;
  options?: PollOption[];
}

export interface PollOption {
  id: string;
  pollId: string;
  text: string;
  votes: number;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  creatorId: string;
  type: EventType;
  isPublic: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: User;
  isPinned: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  sender?: User;
  receiverId: string;
  receiver?: User;
  isRead: boolean;
  createdAt: string;
}

export interface Resolution {
  id: string;
  title: string;
  description: string;
  issueId?: string;
  proposedById: string;
  status: ResolutionStatus;
  votesFor: number;
  votesAgainst: number;
  votedByIds: string[];
  createdAt: string;
  decidedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  avgResolutionTimeDays: number;
  totalUsers: number;
  issuesByCategory: Record<IssueCategory, number>;
  issuesByStatus: Record<IssueStatus, number>;
  recentIssues: Issue[];
}

export interface AICategorizeResponse {
  category: IssueCategory;
  confidence: number;
}

export interface AIPriorityResponse {
  score: number;
  justification: string;
}

export interface AISentimentResponse {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  score: number;
  justification: string;
}

export interface AISummaryResponse {
  summary: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =====================================================================
// v1.5 additions: PostGIS spatial, RAG / pgvector, PWA, 10-feature sweep
// =====================================================================

// === Spatial types ===

/** A longitude/latitude pair in WGS 84 (PostGIS SRID 4326). */
export interface LngLat {
  lng: number;
  lat: number;
}

/** A closed polygon expressed as a ring of [lng, lat] points. */
export type Polygon = LngLat[];

/** Axis-aligned bounding box. */
export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface SpatialIssue {
  id: string;
  title: string;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

export interface AreaSummaryRequest {
  polygon: Polygon;
}

export interface AreaSummaryResponse {
  mode: 'postgis' | 'fallback';
  summary: string;
  issueCount: number;
  issues: Issue[];
}

// === RAG / pgvector types ===

export type DocumentType = 'ORDINANCE' | 'DECISION' | 'REGULATION' | 'GUIDE' | 'OTHER';

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  source: string;
  description?: string;
  documentDate?: string;
  charCount: number;
  chunkCount: number;
  uploadedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  type: DocumentType;
  source: string;
  documentDate?: string;
  chunkIndex: number;
  score: number;
  chunk: string;
}

export interface DocumentIngestResult {
  id: string;
  chunksCreated: number;
  skipped: boolean;
}

export interface IssueEmbedding {
  id: string;
  issueId: string;
  model: string;
  contentHash: string;
  generatedAt: string;
}

export interface SimilarIssue {
  id: string;
  title: string;
  description: string;
  score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCitation {
  documentId: string;
  title: string;
  type: DocumentType;
  source: string;
  documentDate?: string;
  chunkIndex: number;
  score: number;
  chunk: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  ragUsed: boolean;
}

// === Weekly summary ===

export type WeeklySummarySource = 'AUTO' | 'MANUAL';

export interface WeeklySummaryHighlight {
  title: string;
  body: string;
}

export interface WeeklySummary {
  id: string;
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  stats: Record<string, unknown>;
  highlights: WeeklySummaryHighlight[];
  body: string;
  issueIds: string[];
  source: WeeklySummarySource;
  generatedAt: string;
  createdAt: string;
}

// === 10-feature sweep ===

export interface IssueSubscription {
  id: string;
  issueId: string;
  userId: string;
  createdAt: string;
}

export interface IssueShareLink {
  id: string;
  issueId: string;
  token: string;
  expiresAt?: string;
  createdAt: string;
  createdById: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

export type NotificationChannel = 'inApp' | 'email' | 'push';

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: string;
  enabled: boolean;
}

export interface InternalNote {
  id: string;
  issueId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface SlaTracking {
  id: string;
  issueId: string;
  priority: string;
  dueAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  breached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueAssignment {
  id: string;
  issueId: string;
  assigneeId?: string;
  assignedById: string;
  unassignedById?: string;
  assignedAt: string;
  unassignedAt?: string;
  reason?: string;
}

// === Status history ===

export interface StatusHistory {
  id: string;
  issueId: string;
  oldStatus?: IssueStatus;
  newStatus: IssueStatus;
  changedBy: string;
  note?: string;
  createdAt: string;
}

// === Issue template (refined in v1.5: category typed as IssueCategory) ===

