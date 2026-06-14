import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast.component';
import { AiChatWidgetComponent } from './shared/ai-chat.component';
import { InstallPromptComponent } from './shared/install-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, AiChatWidgetComponent, InstallPromptComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-ai-chat-widget />
    <app-install-prompt />
  `,
})
export class AppComponent {}
