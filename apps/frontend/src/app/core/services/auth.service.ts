import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '@dd/shared-types';
import { Observable, tap, catchError, of, firstValueFrom, map } from 'rxjs';

interface AuthData {
  accessToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUser = signal<User | null>(null);

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => !!this.currentUser());
  userRole = computed(() => this.currentUser()?.role);

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('accessToken');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        this.currentUser.set(JSON.parse(userJson));
      } catch {
        this.clearSession();
      }
    }
  }

  /** Validate stored token on app startup; clears stale sessions before routed API calls. */
  validateSession(): Promise<void> {
    if (!localStorage.getItem('accessToken')) {
      return Promise.resolve();
    }
    return firstValueFrom(
      this.getProfile().pipe(
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  private clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    this.currentUser.set(null);
  }

  get token(): string | null {
    return localStorage.getItem('accessToken');
  }

  login(email: string, password: string): Observable<{ success: boolean; data: AuthData }> {
    return this.http.post<{ success: boolean; data: AuthData }>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        if (res.success) {
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          this.currentUser.set(res.data.user);
        }
      })
    );
  }

  register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }): Observable<{ success: boolean; data: AuthData }> {
    return this.http.post<{ success: boolean; data: AuthData }>(`${this.apiUrl}/auth/register`, data).pipe(
      tap((res) => {
        if (res.success) {
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          this.currentUser.set(res.data.user);
        }
      })
    );
  }

  refresh(): Observable<{ success: boolean; data: AuthData }> {
    return this.http.post<{ success: boolean; data: AuthData }>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      tap((res) => {
        if (res.success) {
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          this.currentUser.set(res.data.user);
        }
      }),
      catchError(() => {
        this.logout();
        return of({ success: false, data: {} as AuthData });
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getProfile(): Observable<{ success: boolean; data: User }> {
    return this.http.get<{ success: boolean; data: User }>(`${this.apiUrl}/auth/profile`).pipe(
      tap((res) => {
        if (res.success) {
          localStorage.setItem('user', JSON.stringify(res.data));
          this.currentUser.set(res.data);
        }
      })
    );
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.currentUser();
    return !!user && roles.includes(user.role);
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  getDashboardRoute(): string {
    const role = this.currentUser()?.role;
    switch (role) {
      case UserRole.SUPER_ADMIN: return '/admin';
      case UserRole.MAYOR: return '/mayor';
      case UserRole.DEPARTMENT_HEAD: return '/department';
      case UserRole.COUNCIL_MEMBER: return '/council';
      case UserRole.STAFF: return '/staff';
      case UserRole.WARD_REP: return '/ward';
      case UserRole.CITIZEN: return '/citizen';
      case UserRole.VOLUNTEER: return '/volunteer';
      case UserRole.AUDITOR: return '/auditor';
      case UserRole.MEDIA: return '/media';
      default: return '/login';
    }
  }
}
