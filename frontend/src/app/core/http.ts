import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {
  catchError,
  finalize,
  Observable,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import {AuthTokens} from './models';
import {AuthService} from './auth.service';

let refreshRequest: Observable<AuthTokens> | null = null;

const PUBLIC_AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

function isPublicRequest(url: string): boolean {
  return PUBLIC_AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint))
    || url.includes('/api/public/')
    || url.includes('/api/webhooks/');
}

function redirectToLogin(auth: AuthService, router: Router): void {
  auth.clearSession();
  if (!router.url.startsWith('/login')) {
    void router.navigate(['/login'], {queryParams: {sessionExpired: true}});
  }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const publicRequest = isPublicRequest(request.url);
  const token = auth.token();
  const authenticatedRequest = token && !publicRequest
    ? request.clone({setHeaders: {Authorization: `Bearer ${token}`}})
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && !publicRequest) {
        if (!router.url.startsWith('/forbidden')) {
          void router.navigateByUrl('/forbidden');
        }
        return throwError(() => error);
      }

      if (error.status !== 401 || publicRequest) {
        return throwError(() => error);
      }

      const refreshToken = auth.refreshToken();
      if (!refreshToken) {
        redirectToLogin(auth, router);
        return throwError(() => error);
      }

      refreshRequest ??= auth.refresh().pipe(
        shareReplay({bufferSize: 1, refCount: false}),
        finalize(() => refreshRequest = null),
      );

      return refreshRequest.pipe(
        switchMap(tokens => next(request.clone({
          setHeaders: {Authorization: `Bearer ${tokens.accessToken}`},
        }))),
        catchError(refreshError => {
          redirectToLogin(auth, router);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
