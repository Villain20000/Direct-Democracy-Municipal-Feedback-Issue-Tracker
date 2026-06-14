import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
  pending?: boolean;
}

@Component({
  selector: 'app-ai-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    @if (auth.isAuthenticated()) {
      <div class="ai-chat-widget" [class.open]="open()">
        @if (!open()) {
          <button class="ai-chat-fab" (click)="toggle()" aria-label="Open CivicAssist">
            <span class="ai-fab-pulse"></span>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
              <path d="M12 2a2 2 0 0 1 2 2v1.06A8.002 8.002 0 0 1 19 13v3a3 3 0 0 1-3 3h-1v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2H3a3 3 0 0 1-3-3v-3a8.002 8.002 0 0 1 5-7.94V4a2 2 0 0 1 2-2h5zm-3 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
            </svg>
            @if (hasUnread()) { <span class="ai-fab-dot"></span> }
          </button>
        } @else {
          <div class="ai-chat-window" role="dialog" aria-label="CivicAssist Chat">
            <div class="ai-chat-header">
              <div class="ai-chat-header-info">
                <div class="ai-avatar">
                  <span>🤖</span>
                </div>
                <div>
                  <div class="ai-title">CivicAssist</div>
                  <div class="ai-status">
                    <span class="ai-status-dot"></span>
                    AI assistant
                  </div>
                </div>
              </div>
              <div class="ai-chat-header-actions">
                <button class="ai-icon-btn" (click)="resetChat()" title="New conversation" aria-label="Reset conversation">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                </button>
                <button class="ai-icon-btn" (click)="toggle()" title="Close" aria-label="Close chat">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            </div>
            <div class="ai-chat-messages" #scrollContainer>
              @for (msg of messages(); track $index) {
                <div class="ai-msg" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
                  @if (msg.role === 'assistant') {
                    <div class="ai-msg-avatar">🤖</div>
                  }
                  <div class="ai-msg-bubble">
                    <div class="ai-msg-content">{{ msg.content }}</div>
                    <div class="ai-msg-time">{{ msg.time | date:'shortTime' }}</div>
                  </div>
                  @if (msg.role === 'user') {
                    <div class="ai-msg-avatar user">👤</div>
                  }
                </div>
              }
              @if (sending()) {
                <div class="ai-msg assistant">
                  <div class="ai-msg-avatar">🤖</div>
                  <div class="ai-msg-bubble">
                    <div class="ai-typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              }
              @if (messages().length === 1) {
                <div class="ai-suggestions">
                  <div class="ai-suggestions-label">Try asking:</div>
                  @for (s of suggestions; track s) {
                    <button class="ai-suggestion" (click)="sendSuggestion(s)">{{ s }}</button>
                  }
                </div>
              }
            </div>
            <form class="ai-chat-input" (ngSubmit)="send()">
              <input
                type="text"
                [(ngModel)]="draft"
                name="chat-draft"
                placeholder="Ask CivicAssist anything..."
                autocomplete="off"
                [disabled]="sending()"
              />
              <button type="submit" class="ai-send-btn" [disabled]="!draft.trim() || sending()" aria-label="Send">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
              </button>
            </form>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .ai-chat-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1500;
      font-family: inherit;
    }

    .ai-chat-fab {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .ai-chat-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 30px -5px rgba(37, 99, 235, 0.5);
    }

    .ai-fab-pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      opacity: 0.5;
      animation: pulse 2s ease-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.5; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .ai-fab-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 12px;
      height: 12px;
      background: #DC2626;
      border: 2px solid white;
      border-radius: 50%;
    }

    .ai-chat-window {
      width: 380px;
      height: 560px;
      max-height: calc(100vh - 80px);
      background: var(--bg-card);
      border-radius: 18px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: chatOpen 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes chatOpen {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ai-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: linear-gradient(135deg, #2563EB, #4F46E5);
      color: white;
    }

    .ai-chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ai-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .ai-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.1;
    }

    .ai-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      opacity: 0.9;
      margin-top: 2px;
    }

    .ai-status-dot {
      width: 7px;
      height: 7px;
      background: #4ADE80;
      border-radius: 50%;
      box-shadow: 0 0 6px #4ADE80;
    }

    .ai-chat-header-actions {
      display: flex;
      gap: 4px;
    }

    .ai-icon-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: white;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .ai-icon-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .ai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg-primary);
    }

    .ai-msg {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      animation: msgIn 0.2s ease;
    }

    .ai-msg.user {
      flex-direction: row-reverse;
    }

    .ai-msg-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7C3AED, #4F46E5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .ai-msg-avatar.user {
      background: linear-gradient(135deg, #2563EB, #1D4ED8);
    }

    .ai-msg-bubble {
      max-width: 75%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      box-shadow: var(--shadow-sm);
    }

    .ai-msg.assistant .ai-msg-bubble {
      background: var(--bg-card);
      color: var(--text-primary);
      border-bottom-left-radius: 4px;
    }

    .ai-msg.user .ai-msg-bubble {
      background: var(--primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .ai-msg-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .ai-msg-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }

    .ai-msg.user .ai-msg-time {
      color: rgba(255, 255, 255, 0.8);
    }

    .ai-typing {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }

    .ai-typing span {
      width: 7px;
      height: 7px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typing 1.2s ease-in-out infinite;
    }

    .ai-typing span:nth-child(2) { animation-delay: 0.15s; }
    .ai-typing span:nth-child(3) { animation-delay: 0.3s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    .ai-suggestions {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ai-suggestions-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-left: 4px;
    }

    .ai-suggestion {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px 12px;
      text-align: left;
      font-size: 12px;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.2s;
    }

    .ai-suggestion:hover {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
      transform: translateX(2px);
    }

    .ai-chat-input {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
    }

    .ai-chat-input input {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .ai-chat-input input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .ai-send-btn {
      background: var(--primary);
      border: none;
      color: white;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
      flex-shrink: 0;
    }

    .ai-send-btn:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .ai-send-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .ai-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 600px) {
      .ai-chat-widget {
        bottom: 16px;
        right: 16px;
        left: 16px;
      }
      .ai-chat-window {
        width: auto;
        height: calc(100vh - 100px);
      }
    }
  `],
})
export class AiChatWidgetComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);

  open = signal(false);
  sending = signal(false);
  hasUnread = signal(false);
  draft = '';

  messages = signal<ChatMessage[]>([]);

  suggestions = [
    'How do I report a pothole?',
    'What departments handle water issues?',
    'How long does it take to resolve an issue?',
    'How do I track my reported issues?',
  ];

  ngOnInit() {
    this.resetChat();
  }

  toggle() {
    this.open.update((v) => !v);
    if (this.open()) {
      this.hasUnread.set(false);
    }
  }

  resetChat() {
    this.messages.set([
      {
        role: 'assistant',
        content: "Hello! I'm CivicAssist, your AI municipal assistant. I can help you report issues, find city services, track your requests, or answer questions about local government. How can I help you today?",
        time: new Date().toISOString(),
      },
    ]);
  }

  sendSuggestion(text: string) {
    this.draft = text;
    this.send();
  }

  send() {
    const text = this.draft.trim();
    if (!text || this.sending()) return;

    const userMsg: ChatMessage = { role: 'user', content: text, time: new Date().toISOString() };
    this.messages.update((list) => [...list, userMsg]);
    this.draft = '';
    this.sending.set(true);

    const apiMessages = this.messages().map((m) => ({ role: m.role, content: m.content }));
    this.api.aiChat(apiMessages).subscribe({
      next: (res: any) => {
        const reply = res?.data?.response || res?.data?.message || "I'm sorry, I couldn't generate a response. Please try again.";
        this.messages.update((list) => [
          ...list,
          { role: 'assistant', content: reply, time: new Date().toISOString() },
        ]);
        this.sending.set(false);
      },
      error: () => {
        this.messages.update((list) => [
          ...list,
          {
            role: 'assistant',
            content: "I'm having trouble connecting to my AI brain right now. Please try again in a moment, or contact city services directly for urgent matters.",
            time: new Date().toISOString(),
          },
        ]);
        this.sending.set(false);
      },
    });
  }
}
