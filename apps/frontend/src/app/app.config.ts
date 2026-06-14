import { ApplicationConfig, APP_INITIALIZER, inject, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { AuthService } from './core/services/auth.service';
import { OfflineQueueService } from './core/services/offline-queue.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([credentialsInterceptor, authInterceptor])),
    provideAnimations(),
    // Service Worker — Angular's @angular/service-worker reads
    // `ngsw-config.json` from the project root. We enable it in
    // production builds and disable it in dev so HMR stays
    // snappy. The OFFLINE queue init runs once the SW is ready;
    // see OfflineQueueService for the IndexedDB contract.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    DatePipe,
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const auth = inject(AuthService);
        return () => auth.validateSession();
      },
    },
    {
      // Drain the IndexedDB offline queue once the service worker
      // boots. Posts any pending issues the citizen wrote while
      // offline, then clears the queue. Runs in BOTH dev and prod
      // (dev is harmless because the queue is empty unless the
      // user explicitly went offline). Multi-injector pattern
      // matches the AuthService initializer above.
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const queue = inject(OfflineQueueService);
        return () => queue.attach();
      },
    },
  ],
};
