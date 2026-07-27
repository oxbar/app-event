import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, finalize, Observable, shareReplay, switchMap, throwError} from 'rxjs';
import {AuthTokens} from './models';
import {AuthService} from './auth.service';

let refreshRequest: Observable<AuthTokens> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authenticatedRequest = token
    ? request.clone({setHeaders: {Authorization: `Bearer ${token}`}})
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = request.url.includes('/api/auth/');
      if (error.status !== 401 || isAuthEndpoint || !auth.refreshToken()) {
        return throwError(() => error);
      }

      refreshRequest ??= auth.refresh().pipe(
        shareReplay(1),
        finalize(() => refreshRequest = null),
      );

      return refreshRequest.pipe(
        switchMap(tokens => next(request.clone({
          setHeaders: {Authorization: `Bearer ${tokens.accessToken}`},
        }))),
        catchError(refreshError => {
          auth.clearSession();
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
