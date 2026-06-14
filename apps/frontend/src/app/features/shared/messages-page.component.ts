import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent, NavItem } from '../../shared/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Message } from '@dd/shared-types';

interface Conversation {
  partnerId: string;
  lastMessage?: Message;
  unreadCount: number;
}

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, DatePipe],
  template: `
    <app-layout pageTitle="Messages" [navItems]="navItems" (logout)="auth.logout()">
      @if (error) {
        <div class="card" style="margin-bottom:24px;border-color:var(--danger);">
          <div class="card-body" style="color:var(--danger);">{{ error }}</div>
        </div>
      }

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><h3>💬 Conversations</h3></div>
          <div class="card-body" style="padding:0;">
            @if (loadingConversations) {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">Loading conversations...</div>
            } @else {
              @for (conv of conversations; track conv.partnerId) {
                <div style="display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-light);cursor:pointer;"
                  [style.background]="selectedUserId === conv.partnerId ? 'var(--bg-primary)' : 'transparent'"
                  (click)="selectConversation(conv.partnerId)">
                  <div class="user-avatar" style="width:36px;height:36px;font-size:13px;">{{ getPartnerInitials(conv) }}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <strong style="font-size:13px;">{{ getPartnerName(conv) }}</strong>
                      @if (conv.unreadCount > 0) { <span class="badge">{{ conv.unreadCount }}</span> }
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      {{ conv.lastMessage?.content || 'No messages yet' }}
                    </div>
                  </div>
                </div>
              } @empty {
                <div style="text-align:center;padding:48px;color:var(--text-muted);">No conversations yet.</div>
              }
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>{{ selectedUserId ? 'Conversation' : 'Select a conversation' }}</h3>
          </div>
          <div class="card-body">
            @if (!selectedUserId) {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">Select a conversation to view messages.</div>
            } @else if (loadingMessages) {
              <div style="text-align:center;padding:48px;color:var(--text-muted);">Loading messages...</div>
            } @else {
              <div style="max-height:400px;overflow-y:auto;margin-bottom:16px;">
                @for (msg of messages; track msg.id) {
                  <div style="margin-bottom:12px;" [style.text-align]="msg.senderId === currentUserId ? 'right' : 'left'">
                    <div style="display:inline-block;max-width:80%;padding:10px 14px;border-radius:var(--radius-lg);font-size:13px;"
                      [style.background]="msg.senderId === currentUserId ? 'var(--primary)' : 'var(--bg-primary)'"
                      [style.color]="msg.senderId === currentUserId ? 'white' : 'var(--text-primary)'">
                      {{ msg.content }}
                    </div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">{{ msg.createdAt | date:'short' }}</div>
                  </div>
                } @empty {
                  <div style="text-align:center;padding:32px;color:var(--text-muted);">No messages in this conversation.</div>
                }
              </div>
              <div style="display:flex;gap:8px;">
                <input type="text" [(ngModel)]="newMessage" placeholder="Type a message..." (keyup.enter)="sendMessage()"
                  style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;" />
                <button class="btn btn-primary" [disabled]="!newMessage.trim() || sending" (click)="sendMessage()">
                  <i class="material-icons-outlined" style="font-size:18px;">send</i>
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </app-layout>
  `,
})
export class MessagesPageComponent implements OnInit {
  conversations: Conversation[] = [];
  messages: Message[] = [];
  selectedUserId = '';
  newMessage = '';
  loadingConversations = true;
  loadingMessages = false;
  sending = false;
  error = '';
  navItems: NavItem[] = [];

  constructor(public auth: AuthService, private api: ApiService) {
    this.navItems = [{ icon: 'dashboard', label: 'Dashboard', route: auth.getDashboardRoute() }];
  }

  get currentUserId(): string {
    return this.auth.user()?.id || '';
  }

  ngOnInit() { this.loadConversations(); }

  loadConversations() {
    this.loadingConversations = true;
    this.error = '';
    this.api.getConversations().subscribe({
      next: (res: any) => {
        if (res.success) this.conversations = res.data || [];
        this.loadingConversations = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load conversations.';
        this.loadingConversations = false;
      },
    });
  }

  selectConversation(userId: string) {
    this.selectedUserId = userId;
    this.loadingMessages = true;
    this.messages = [];
    this.api.getConversation(userId).subscribe({
      next: (res: any) => {
        this.messages = res.data || [];
        this.loadingMessages = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load messages.';
        this.loadingMessages = false;
      },
    });
  }

  sendMessage() {
    const content = this.newMessage.trim();
    if (!content || !this.selectedUserId) return;
    this.sending = true;
    this.api.sendMessage(this.selectedUserId, content).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.messages = [...this.messages, res.data];
          this.newMessage = '';
        }
        this.sending = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to send message.';
        this.sending = false;
      },
    });
  }

  getPartnerName(conv: Conversation): string {
    const msg = conv.lastMessage;
    if (!msg?.sender) return conv.partnerId;
    if (msg.senderId === this.currentUserId && msg.receiver) {
      return `${msg.receiver.firstName} ${msg.receiver.lastName}`;
    }
    return `${msg.sender.firstName} ${msg.sender.lastName}`;
  }

  getPartnerInitials(conv: Conversation): string {
    const name = this.getPartnerName(conv);
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2).toUpperCase();
  }
}