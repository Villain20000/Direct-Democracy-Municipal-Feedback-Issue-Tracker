import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast.component';
import { AiChatWidgetComponent } from './shared/ai-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, AiChatWidgetComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-ai-chat-widget />
  `,
})
export class AppComponent {}
