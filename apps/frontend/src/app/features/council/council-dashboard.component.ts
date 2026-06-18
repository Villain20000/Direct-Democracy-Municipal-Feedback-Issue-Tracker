import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutComponent } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Event } from '@dd/shared-types';

interface CouncilMeeting {
  title: string;
  day: string;
  month: string;
  time: string;
  location: string;
}

interface ChatCitation {
  documentId: string;
  title: string;
  type: string;
  source: string;
  documentDate: string | null;
  chunkIndex: number;
  score: number;
  chunk: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  ragUsed?: boolean;
  fallback?: boolean;
  error?: boolean;
}

@Component({
  selector: 'app-council-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, RouterLink, TranslatePipe],
  template: `
    <app-layout [pageTitle]="i18n.t('council.pageTitle')" [navItems]="navItems" (logout)="auth.logout()">

      @if (voteMessage) {
        <div class="card" style="margin-bottom:16px;border-color:var(--success);">
          <div class="card-body" style="color:var(--success);font-size:13px;">{{ voteMessage }}</div>
        </div>
      }
      @if (voteError) {
        <div class="card" style="margin-bottom:16px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);font-size:13px;">{{ voteError }}</div>
        </div>
      }

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><i class="material-icons-outlined">how_to_vote</i></div><div class="stat-info"><div class="stat-value">{{ pendingResolutions }}</div><div class="stat-label">{{ 'council.pending' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="material-icons-outlined">groups</i></div><div class="stat-info"><div class="stat-value">{{ constituentIssues }}</div><div class="stat-label">{{ 'council.constituents' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="material-icons-outlined">thumb_up</i></div><div class="stat-info"><div class="stat-value">{{ resolutionRate }}%</div><div class="stat-label">{{ 'council.resolutionRate' | t }}</div></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="material-icons-outlined">event</i></div><div class="stat-info"><div class="stat-value">{{ meetings.length }}</div><div class="stat-label">{{ 'council.upcoming' | t }}</div></div></div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>{{ 'council.voteQueue' | t }}</h3></div>
          <div class="card-body">
            @for (res of resolutions; track res.id) {
              <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <strong>{{ res.title }}</strong>
                  <span class="badge" [class]="res.status === 'VOTING' ? 'badge-amber' : 'badge-green'">{{ i18n.tResolutionStatus(res.status) }}</span>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">{{ res.description }}</p>
                <div style="display:flex;gap:12px;align-items:center;">
                  <div style="display:flex;gap:8px;">
                    <button type="button" class="btn btn-success btn-sm" [disabled]="votingId === res.id" (click)="voteOnResolution(res, true)">{{ i18n.t('council.for', { n: res.votesFor }) }}</button>
                    <button type="button" class="btn btn-danger btn-sm" [disabled]="votingId === res.id" (click)="voteOnResolution(res, false)">{{ i18n.t('council.against', { n: res.votesAgainst }) }}</button>
                  </div>
                </div>
              </div>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'council.noResolutions' | t }}</div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>{{ 'council.upcomingTitle' | t }}</h3>
            <a routerLink="/council/calendar" class="btn btn-secondary btn-sm">{{ 'common.viewAll' | t }}</a>
          </div>
          <div class="card-body">
            @for (meeting of meetings; track meeting.title) {
              <a routerLink="/council/calendar" style="display:flex;gap:16px;padding:14px;border-bottom:1px solid var(--border-light);text-decoration:none;color:inherit;transition:background 0.2s;">
                <div style="text-align:center;min-width:48px;">
                  <div style="font-size:22px;font-weight:800;color:var(--primary);">{{ meeting.day }}</div>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">{{ meeting.month }}</div>
                </div>
                <div>
                  <div style="font-size:14px;font-weight:600;">{{ meeting.title }}</div>
                  <div style="font-size:12px;color:var(--text-muted);">{{ meeting.time }} · {{ meeting.location }} · {{ 'common.viewAll' | t }} →</div>
                </div>
              </a>
            } @empty {
              <div style="text-align:center;padding:32px;color:var(--text-muted);">{{ 'council.noMeetings' | t }}</div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>{{ 'council.overview' | t }}</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            <div style="text-align:center;padding:24px;background:#F0FDF4;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--success);">{{ sentimentPositive }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--success);">{{ 'council.resolved' | t }}</div>
            </div>
            <div style="text-align:center;padding:24px;background:#F1F5F9;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--secondary);">{{ sentimentNeutral }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--secondary);">{{ 'council.inProgress' | t }}</div>
            </div>
            <div style="text-align:center;padding:24px;background:#FEF2F2;border-radius:var(--radius-lg);">
              <div style="font-size:36px;font-weight:800;color:var(--danger);">{{ sentimentNegative }}%</div>
              <div style="font-size:13px;font-weight:600;color:var(--danger);">{{ 'council.rejected' | t }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- Municipal Legislation Chatbot (RAG-augmented /ai/chat)    -->
      <!-- ======================================================== -->
      <div class="card" style="margin-top:16px;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="display:flex;align-items:center;gap:8px;">
              <i class="material-icons-outlined" style="color:var(--primary);">menu_book</i>
              {{ 'council.chatTitle' | t }}
            </h3>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
              {{ 'council.chatSubtitle' | t }}
            </div>
          </div>
          @if (chatMessages.length > 0) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="clearChat()" [disabled]="chatThinking">
              {{ 'council.chatClear' | t }}
            </button>
          }
        </div>
        <div class="card-body" style="padding:0;">
          <!-- Messages list -->
          <div class="chat-messages" #chatScroll>
            @if (chatMessages.length === 0 && !chatThinking) {
              <div style="padding:48px 24px;text-align:center;color:var(--text-muted);">
                <i class="material-icons-outlined" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.5;">forum</i>
                <div style="font-size:14px;font-weight:600;margin-bottom:4px;">{{ 'council.chatEmpty' | t }}</div>
                <div style="font-size:12px;">{{ 'council.chatHint' | t }}</div>
              </div>
            }
            @for (msg of chatMessages; track $index) {
              <div class="chat-bubble" [class.chat-user]="msg.role === 'user'" [class.chat-assistant]="msg.role === 'assistant'">
                <div class="chat-bubble-role">
                  @if (msg.role === 'user') {
                    <i class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">person</i>
                    {{ 'council.chatYou' | t }}
                  } @else {
                    <i class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--primary);">smart_toy</i>
                    {{ 'council.chatAssistant' | t }}
                    @if (msg.ragUsed) {
                      <span style="margin-left:8px;font-size:10px;background:#D1FAE5;color:#065F46;padding:2px 6px;border-radius:4px;">
                        {{ 'council.chatRagUsed' | t }}
                      </span>
                    } @else if (msg.fallback) {
                      <span style="margin-left:8px;font-size:10px;background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:4px;">
                        {{ 'council.chatFallback' | t }}
                      </span>
                    }
                  }
                </div>
                <div class="chat-bubble-content" [class.error]="msg.error">{{ msg.content }}</div>

                <!-- Citations -->
                @if (msg.role === 'assistant' && msg.citations && msg.citations.length > 0) {
                  <div style="margin-top:10px;border-top:1px solid var(--border-light);padding-top:10px;">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">
                      📚 {{ 'council.chatCitations' | t }} ({{ msg.citations.length }})
                    </div>
                    @for (cit of msg.citations; track cit.documentId) {
                      <details style="margin-bottom:6px;background:#F8FAFC;border:1px solid var(--border-light);border-radius:6px;padding:8px 10px;">
                        <summary style="cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;list-style:none;">
                          <i class="material-icons-outlined" style="font-size:14px;color:var(--primary);">description</i>
                          <span style="flex:1;">{{ cit.title }}</span>
                          <span style="font-size:10px;background:var(--primary);color:white;padding:1px 6px;border-radius:3px;font-weight:600;">
                            {{ (cit.score * 100).toFixed(0) }}%
                          </span>
                          <span style="font-size:10px;background:#E0E7FF;color:#3730A3;padding:1px 6px;border-radius:3px;">
                            {{ cit.sourceType || cit.source || 'legislation' }}
                          </span>
                          <span style="font-size:10px;background:#F1F5F9;color:#475569;padding:1px 6px;border-radius:3px;">
                            {{ cit.type }}
                          </span>
                        </summary>
                        <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;line-height:1.5;white-space:pre-wrap;">
                          {{ cit.chunk }}
                        </div>
                        @if (cit.documentDate) {
                          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">📅 {{ cit.documentDate }}</div>
                        }
                      </details>
                    }
                  </div>
                }
              </div>
            }

            @if (chatThinking) {
              <div class="chat-bubble chat-assistant">
                <div class="chat-bubble-role">
                  <i class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--primary);">smart_toy</i>
                  {{ 'council.chatAssistant' | t }}
                </div>
                <div class="chat-thinking">
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  <span style="margin-left:8px;font-size:13px;color:var(--text-muted);">{{ 'council.chatThinking' | t }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Input row -->
          <div style="border-top:1px solid var(--border);padding:12px 16px;display:flex;gap:8px;align-items:flex-end;">
            <textarea
              class="form-input"
              [(ngModel)]="chatInput"
              (keydown.enter)="onChatEnter($event)"
              [disabled]="chatThinking"
              rows="2"
              [placeholder]="'council.chatPlaceholder' | t"
              style="flex:1;resize:vertical;min-height:42px;max-height:160px;font-family:inherit;font-size:14px;"
            ></textarea>
            <button
              type="button"
              class="btn btn-primary"
              (click)="sendChat()"
              [disabled]="chatThinking || !chatInput.trim()">
              @if (chatThinking) {
                <span>...</span>
              } @else {
                <i class="material-icons-outlined" style="font-size:18px;vertical-align:middle;">send</i>
                {{ 'council.chatSend' | t }}
              }
            </button>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    .chat-messages {
      max-height: 520px;
      overflow-y: auto;
      padding: 16px;
      background: #FAFAFA;
    }
    .chat-bubble {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      margin-bottom: 10px;
      font-size: 14px;
      line-height: 1.5;
    }
    .chat-user {
      background: var(--primary);
      color: white;
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }
    .chat-user .chat-bubble-role { color: rgba(255,255,255,0.85); }
    .chat-assistant {
      background: white;
      border: 1px solid var(--border);
      margin-right: auto;
      border-bottom-left-radius: 4px;
    }
    .chat-bubble-role {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chat-bubble-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .chat-bubble-content.error {
      color: var(--danger);
      font-style: italic;
    }
    .chat-thinking {
      display: flex;
      align-items: center;
    }
    .chat-thinking .dot {
      width: 7px;
      height: 7px;
      margin: 0 2px;
      background: var(--primary);
      border-radius: 50%;
      animation: chat-bounce 1.2s infinite ease-in-out;
    }
    .chat-thinking .dot:nth-child(2) { animation-delay: 0.15s; }
    .chat-thinking .dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes chat-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
  `],
})
export class CouncilDashboardComponent implements OnInit {
  resolutions: any[] = [];
  meetings: CouncilMeeting[] = [];
  constituentIssues = 0;
  resolutionRate = 0;
  sentimentPositive = 0;
  sentimentNeutral = 0;
  sentimentNegative = 0;
  votingId = '';
  voteMessage = '';
  voteError = '';

  // Chat panel state
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatThinking = false;

  navItems = [
    { icon: 'dashboard', label: 'nav.overview', route: '/council' },
    { icon: 'how_to_vote', label: 'nav.resolutions', route: '/council/resolutions' },
    { icon: 'groups', label: 'nav.constituents', route: '/council/constituents' },
    { icon: 'forum', label: 'nav.forums', route: '/council/forums' },
    { icon: 'event', label: 'nav.calendar', route: '/council/calendar' },
    { icon: 'library_books', label: 'nav.documents', route: '/admin/documents' },
  ] as any;

  private readonly locale = 'en-US';

  auth = inject(AuthService);
  api = inject(ApiService);
  i18n = inject(TranslationService);

  get pendingResolutions(): number {
    return this.resolutions.filter(r => r.status === 'VOTING' || r.status === 'PROPOSED').length;
  }

  ngOnInit() {
    this.loadResolutions();

    const wardId = this.auth.user()?.wardId;
    const issueParams: Record<string, string> = { pageSize: '1' };
    if (wardId) issueParams['wardId'] = wardId;
    this.api.getIssues(issueParams).subscribe((res: any) => {
      this.constituentIssues = res.total || 0;
    });

    this.api.getIssueStats(wardId ? { wardId } : undefined).subscribe(res => {
      if (!res.success) return;
      const { totalIssues, resolvedIssues, issuesByStatus } = res.data;
      this.resolutionRate = totalIssues ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
      const status = issuesByStatus as Record<string, number>;
      const positive = (status['RESOLVED'] || 0) + (status['VERIFIED'] || 0);
      const neutral = (status['SUBMITTED'] || 0) + (status['ACKNOWLEDGED'] || 0) + (status['IN_PROGRESS'] || 0) + (status['PENDING_REVIEW'] || 0) + (status['REOPENED'] || 0);
      const negative = status['REJECTED'] || 0;
      const total = positive + neutral + negative || 1;
      this.sentimentPositive = Math.round((positive / total) * 100);
      this.sentimentNeutral = Math.round((neutral / total) * 100);
      this.sentimentNegative = Math.round((negative / total) * 100);
    });

    this.api.getEvents({ upcoming: 'true', pageSize: '10' }).subscribe((res: any) => {
      const evts: Event[] = (res.data || []).filter((e: Event) =>
        e.type === 'COUNCIL_MEETING' || e.type === 'PUBLIC_HEARING' || e.type === 'TOWN_HALL'
      );
      this.meetings = evts.slice(0, 5).map(e => this.mapMeeting(e));
    });
  }

  loadResolutions() {
    this.api.getResolutions().subscribe({
      next: (res: any) => { if (res.success) this.resolutions = res.data || []; },
      error: () => { this.resolutions = []; },
    });
  }

  voteOnResolution(resolution: any, voteFor: boolean) {
    this.votingId = resolution.id;
    this.voteMessage = '';
    this.voteError = '';
    this.api.voteResolution(resolution.id, voteFor).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.loadResolutions();
          this.voteMessage = this.i18n.t('council.voteRecorded', { title: resolution.title });
          setTimeout(() => { this.voteMessage = ''; }, 4000);
        }
        this.votingId = '';
      },
      error: (err) => {
        this.voteError = err.error?.error || this.i18n.t('council.voteFailed');
        this.votingId = '';
      },
    });
  }

  // ========================================================
  // Chat panel methods
  // ========================================================

  onChatEnter(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.sendChat();
    }
  }

  sendChat() {
    const text = this.chatInput.trim();
    if (!text || this.chatThinking) return;

    // Append user message.
    this.chatMessages = [...this.chatMessages, { role: 'user', content: text }];
    this.chatInput = '';
    this.chatThinking = true;
    this.scrollChatToBottom();

    // Build the messages payload for the API (strip UI-only fields).
    const apiMessages = this.chatMessages
      .filter(m => !m.error)
      .slice(-20) // keep the last 20 turns to limit context bloat
      .map(m => ({ role: m.role, content: m.content }));

    // Append an empty assistant message that we will populate chunk-by-chunk.
    const assistantIndex = this.chatMessages.length;
    this.chatMessages = [
      ...this.chatMessages,
      {
        role: 'assistant',
        content: '',
        citations: [],
        ragUsed: false,
        fallback: false,
      }
    ];

    this.api.aiChatStream(
      apiMessages,
      true,
      (chunk) => {
        this.chatMessages = this.chatMessages.map((m, idx) => {
          if (idx === assistantIndex) {
            return { ...m, content: m.content + chunk };
          }
          return m;
        });
        this.scrollChatToBottom();
      },
      (meta) => {
        this.chatMessages = this.chatMessages.map((m, idx) => {
          if (idx === assistantIndex) {
            return { ...m, citations: meta.citations || [], ragUsed: !!meta.ragUsed };
          }
          return m;
        });
      }
    ).then(() => {
      this.chatThinking = false;
      this.scrollChatToBottom();
    }).catch((err) => {
      this.chatThinking = false;
      const msg = err?.message || this.i18n.t('council.chatError');
      this.chatMessages = this.chatMessages.map((m, idx) => {
        if (idx === assistantIndex) {
          return { ...m, content: msg, error: true };
        }
        return m;
      });
      this.scrollChatToBottom();
    });
  }

  clearChat() {
    this.chatMessages = [];
    this.chatInput = '';
    this.chatThinking = false;
  }

  private scrollChatToBottom() {
    // Defer to next macrotask so the DOM has the new message.
    setTimeout(() => {
      const el = document.querySelector('.chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private mapMeeting(event: Event): CouncilMeeting {
    const start = new Date(event.startTime);
    return {
      title: event.title,
      day: formatDate(start, 'd', this.locale),
      month: formatDate(start, 'MMM', this.locale),
      time: formatDate(start, 'shortTime', this.locale),
      location: event.location || 'TBD',
    };
  }
}
