import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast.component';
import { AiChatWidgetComponent } from './shared/ai-chat.component';
import { InstallPromptComponent } from './shared/install-prompt.component';
import { ScrollProgressComponent } from './shared/scroll-progress.component';
import { ScrollTopComponent } from './shared/scroll-top.component';
import { CommandPaletteComponent } from './shared/command-palette.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    ToastContainerComponent,
    AiChatWidgetComponent,
    InstallPromptComponent,
    ScrollProgressComponent,
    ScrollTopComponent,
    CommandPaletteComponent,
  ],
  template: `
    <app-scroll-progress />
    <router-outlet />
    <app-toast-container />
    <app-ai-chat-widget />
    <app-install-prompt />
    <app-scroll-top />
    <app-command-palette />
  `,
})
export class AppComponent {}
