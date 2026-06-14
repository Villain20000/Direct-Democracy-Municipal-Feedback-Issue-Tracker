import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const isAuthEndpoint = (url: string): boolean =>
  url.includes('/auth/login') || url.includes('/auth/refresh');

const withAuthHeader = (request: Parameters<HttpInterceptorFn>[0], token: string | null) =>
  token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = localStorage.getItem('accessToken');
  const authReq = withAuthHeader(req, token);

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((res) => {
          if (!res.success) {
            return throwError(() => error);
          }
          const newToken = localStorage.getItem('accessToken');
          return next(withAuthHeader(req, newToken));
        }),
        catchError(() => throwError(() => error))
      );
    })
  );
};