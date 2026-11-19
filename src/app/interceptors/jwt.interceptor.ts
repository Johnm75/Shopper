/**
 * Interceptor funcional HTTP que inyecta `Authorization: Bearer <token>`
 * en las peticiones dirigidas a `environment.apiBaseUrl`, excluyendo el
 * endpoint de autenticación `/auth/login`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

// Servicio de sesión JWT; se lee de forma síncrona mediante señales.
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Utilidad para determinar si la petición va hacia la API autorizada.
import { isApiBaseUrl } from '../utils/api-url.util';

/**
 * Interceptor que adjunta el token Bearer cuando corresponde.
 */
export const jwtAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const authenticationService = inject(JwtAuthenticationService);

  // Solo intercepta peticiones al origen base de la API.
  if (!isApiBaseUrl(request)) {
    return next(request);
  }

  // No adjunta token al endpoint de login para evitar enviar credenciales con Bearer.
  const requestPath = new URL(request.url).pathname;
  if (requestPath === '/auth/login') {
    return next(request);
  }

  // Lee el token actual de la señal reactiva de sesión.
  const accessToken = authenticationService.sessionSignal()?.accessToken;
  if (!accessToken) {
    return next(request);
  }

  // Clona la petición agregando la cabecera de autorización estándar.
  const authenticatedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authenticatedRequest);
};
