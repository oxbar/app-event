import {HttpErrorResponse} from '@angular/common/http';
import {ApiError} from './models';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const payload = error.error as Partial<ApiError> | string | null;
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
    return payload.message;
  }
  if (error.status === 0) return 'Não foi possível conectar ao servidor.';
  if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (error.status === 403) return 'Você não possui permissão para acessar este recurso.';
  return fallback;
}
