/**
 * Utilidades de validación de origen URL para el interceptor JWT.
 *
 * Impide que el token Bearer se envíe a dominios ajenos a la API autorizada.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

import type { HttpRequest } from '@angular/common/http';
// Variables de entorno con el origen base autorizado.
import { environment } from '../../environments/environment';

/**
 * Comprueba si una petición HTTP pertenece exactamente al origen configurado
 * como `environment.apiBaseUrl`.
 *
 * @param request Petición HTTP saliente.
 * @returns `true` si el origen de la URL coincide con la API autorizada.
 */
export function isApiBaseUrl(request: HttpRequest<unknown>): boolean {
  const requestOrigin = extractUrlOrigin(request.url);
  const apiBaseOrigin = extractUrlOrigin(environment.apiBaseUrl);
  return requestOrigin === apiBaseOrigin;
}

/**
 * Extrae el origen (`protocol://host:port`) de una URL de forma segura.
 * Si la URL no es válida devuelve una cadena vacía.
 *
 * @param url URL de la cual se quiere obtener el origen.
 * @returns Origen de la URL o cadena vacía si es inválida.
 */
function extractUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// --- Funciones heredadas de compatibilidad ---

/**
 * Verifica que la URL destino esté bajo el mismo origen y prefijo de la API.
 * Mantiene firma anterior para `mock-api.interceptor.ts` y componentes legados.
 *
 * @param requestUrl URL de la petición saliente.
 * @param configuredApiBaseUrl Origen base configurado de la API.
 * @returns `true` si la petición pertenece a la API confiable.
 */
export function isTrustedApiEndpoint(requestUrl: string, configuredApiBaseUrl: string): boolean {
  let apiBase: URL;
  let targetUrl: URL;

  try {
    apiBase = new URL(configuredApiBaseUrl);
    targetUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  if (targetUrl.origin !== apiBase.origin || targetUrl.username || targetUrl.password) {
    return false;
  }

  const normalizedApiPath = apiBase.pathname.replace(/\/+$/, '') || '/';
  const normalizedTargetPath = targetUrl.pathname.replace(/\/+$/, '') || '/';

  return (
    normalizedTargetPath === normalizedApiPath ||
    normalizedTargetPath.startsWith(`${normalizedApiPath}/`)
  );
}

/**
 * Identifica el endpoint de autenticación inicial.
 *
 * @param requestUrl URL de la petición saliente.
 * @param configuredApiBaseUrl Origen base configurado de la API.
 * @returns `true` si la ruta termina en `/auth/login`.
 */
export function isAuthenticationLoginEndpoint(
  requestUrl: string,
  configuredApiBaseUrl: string
): boolean {
  if (!isTrustedApiEndpoint(requestUrl, configuredApiBaseUrl)) {
    return false;
  }

  try {
    return new URL(requestUrl).pathname.endsWith('/auth/login');
  } catch {
    return false;
  }
}
