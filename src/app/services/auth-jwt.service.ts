/**
 * Servicio central de autenticación JWT para "App Shoper".
 *
 * Gestiona login remoto contra DummyJSON, fallback offline determinista,
 * cambio de rol activo, cierre de sesión y señales reactivas para la UI.
 *
 * ⚠️ ADVERTENCIAS DE SEGURIDAD:
 * - Los tokens de DummyJSON son de demostración; no verificamos su firma.
 * - `@capacitor/preferences` almacena en texto plano; no contiene PII real.
 * - El checkout es simulado; no se procesan pagos ni datos bancarios reales.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

import { Injectable, computed, inject, signal } from '@angular/core';
// Cliente HTTP y modelo de error para detectar fallas de red.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
// Router para redirecciones opcionales al cerrar sesión.
import { Router } from '@angular/router';
// Utilidad para convertir observables en promesas.
import { firstValueFrom } from 'rxjs';

// Servicio de almacenamiento persistente de la sesión.
import { TokenStorageService } from './token-storage.service';
// Base de datos local centralizada (`shopper_db`).
import { ShopperDatabaseService } from './database.service';
// Modelos canónicos del dominio Shoper.
import type {
  DummyJsonLoginResponse,
  PersistedSessionRecord,
  ShoperLoginCredentials,
  UserRole,
} from '../models/shoper.model';
// Modelos heredados de la galería de fotos (compatibilidad transitoria).
import type {
  AuthenticatedSession,
  AuthenticationErrorCode,
  LoginCredentials,
} from '../models/auth.model';
// Variables de entorno: origen API y claves de almacenamiento.
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class JwtAuthenticationService {
  // Cliente HTTP para llamar a DummyJSON.
  private readonly httpClient = inject(HttpClient);
  // Router para redirecciones opcionales al cerrar sesión.
  private readonly router = inject(Router);
  // Almacenamiento persistente de la sesión.
  private readonly tokenStorage = inject(TokenStorageService);
  // Base de datos centralizada para registrar usuarios autenticados.
  private readonly database = inject(ShopperDatabaseService);

  // Promesa de hidratación para evitar ejecuciones concurrentes.
  private hydrationPromise: Promise<void> | null = null;

  /**
   * Señal reactiva canónica con el registro de sesión actual.
   */
  readonly sessionSignal = signal<PersistedSessionRecord | null>(null);

  /**
   * Indica si existe una sesión activa.
   */
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  /**
   * Rol activo de la sesión; devuelve `customer` cuando no hay sesión.
   */
  readonly activeRole = computed<UserRole>(() => this.sessionSignal()?.role ?? 'customer');

  /**
   * Origen del token actual (`remote-api` u `offline-fallback`).
   */
  readonly tokenSource = computed(() => this.sessionSignal()?.source ?? null);

  // --- Señales heredadas de compatibilidad con la galería de fotos ---

  /**
   * Vista heredada de la sesión en formato `AuthenticatedSession`.
   */
  readonly activeSession = computed<AuthenticatedSession | null>(() => {
    const session = this.sessionSignal();
    if (!session) {
      return null;
    }
    return {
      accessToken: session.accessToken,
      expiresAtTimestampMs: session.expiresAt ? Date.parse(session.expiresAt) : Date.now() + 3_600_000,
      userProfile: {
        id: session.username,
        fullName: `${session.firstName} ${session.lastName}`.trim(),
        email: `${session.username}@example.com`,
        role: 'student',
      },
    };
  });

  /**
   * Muestra los primeros y últimos caracteres del token para diagnóstico visual.
   */
  readonly maskedTokenPreview = computed(() => {
    const rawToken = this.sessionSignal()?.accessToken;
    if (!rawToken) {
      return '';
    }
    return `${rawToken.slice(0, 10)}…${rawToken.slice(-4)}`;
  });

  /**
   * Calcula los minutos restantes de vigencia del token activo.
   */
  readonly remainingSessionMinutes = computed(() => {
    const expiresAtIso = this.sessionSignal()?.expiresAt;
    if (!expiresAtIso) {
      return null;
    }
    const remainingMs = Date.parse(expiresAtIso) - Date.now();
    return remainingMs > 0 ? Math.floor(remainingMs / 60_000) : 0;
  });

  /**
   * Inicia el servicio hidratando la sesión persistida.
   */
  constructor() {
    // Arranca la hidratación inmediatamente; `restorePersistedSession` puede esperarla.
    this.hydrationPromise = this.hydrateSessionFromStorage();
  }

  /**
   * Hidrata la sesión desde `shopper_db` de forma idempotente.
   */
  async restorePersistedSession(): Promise<void> {
    if (!this.hydrationPromise) {
      this.hydrationPromise = this.hydrateSessionFromStorage();
    }
    await this.hydrationPromise;
  }

  /**
   * Inicializa el arranque en frío obligando a iniciar en `/login`.
   *
   * Garantiza la apertura de `shopper_db` y limpia únicamente la sesión JWT
   * activa, preservando intactos usuarios, productos, carrito y pedidos.
   */
  async initializeStartupAtLogin(): Promise<void> {
    try {
      await this.database.ensureReady();
      await this.tokenStorage.clearSession();
    } finally {
      this.sessionSignal.set(null);
      this.hydrationPromise = Promise.resolve();
    }
  }

  /**
   * Autentica contra DummyJSON con JWT; si falla la red, genera un token
   * offline y persiste sesión + usuario en `shopper_db`.
   */
  async login(credentials: ShoperLoginCredentials): Promise<PersistedSessionRecord> {
    const loginEndpointUrl = `${environment.apiBaseUrl}/auth/login`;

    try {
      // Envía solo username/password porque DummyJSON no espera role.
      const apiResponse = await firstValueFrom(
        this.httpClient.post<DummyJsonLoginResponse>(loginEndpointUrl, {
          username: credentials.username,
          password: credentials.password,
        })
      );

      const sessionRecord = this.mapDummyJsonResponseToSessionRecord(apiResponse, credentials.role);
      await this.tokenStorage.setSession(sessionRecord);
      await this.database.upsertUser({
        username: sessionRecord.username,
        firstName: sessionRecord.firstName,
        lastName: sessionRecord.lastName,
        role: sessionRecord.role,
        source: sessionRecord.source,
        lastLoginAt: new Date().toISOString(),
      });
      this.sessionSignal.set(sessionRecord);
      return sessionRecord;
    } catch (httpError) {
      // Cuando no hay conectividad, activa el fallback offline determinista.
      if (this.isNetworkError(httpError)) {
        return this.performOfflineFallbackLogin(credentials);
      }
      throw this.translateHttpAuthError(httpError);
    }
  }

  /**
   * Cambia el rol activo de la sesión y persiste el cambio.
   */
  async switchActiveRole(role: UserRole): Promise<void> {
    const currentSession = this.sessionSignal();
    if (!currentSession) {
      return;
    }

    const updatedSession: PersistedSessionRecord = { ...currentSession, role };
    await this.tokenStorage.setSession(updatedSession);
    this.sessionSignal.set(updatedSession);
  }

  /**
   * Cierra la sesión limpiando la señal y el almacenamiento.
   */
  async logout(): Promise<void> {
    await this.tokenStorage.clearSession();
    this.sessionSignal.set(null);
  }

  // --- Métodos heredados de compatibilidad con la galería de fotos ---

  /**
   * Envía credenciales heredadas (email/password) mapeándolas a username.
   */
  async authenticateWithCredentials(credentials: LoginCredentials): Promise<AuthenticatedSession> {
    const username = credentials.email.split('@')[0] ?? credentials.email;
    await this.login({
      username,
      password: credentials.password,
      role: 'customer',
    });

    const legacySession = this.activeSession();
    if (!legacySession) {
      throw 'unexpected_error';
    }
    return legacySession;
  }

  /**
   * Devuelve el token activo si existe y no ha expirado; de lo contrario limpia la sesión.
   */
  async getValidAccessToken(): Promise<string | null> {
    const currentSession = this.sessionSignal();
    if (!this.isSessionRecordValid(currentSession)) {
      if (currentSession) {
        await this.logout();
      }
      return null;
    }
    return currentSession!.accessToken;
  }

  /**
   * Indica si existe una sesión JWT autenticada, con token no vacío y vigente.
   */
  async hasActiveSession(): Promise<boolean> {
    const validToken = await this.getValidAccessToken();
    return validToken !== null;
  }

  /**
   * Limpia la sesión y redirige opcionalmente a `/login`.
   */
  async signOutSession(options: { navigateToLogin?: boolean } = {}): Promise<void> {
    await this.logout();
    if (options.navigateToLogin ?? true) {
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  /**
   * Lee la sesión persistida desde `shopper_db` y la valida antes de activarla.
   */
  private async hydrateSessionFromStorage(): Promise<void> {
    try {
      const session = await this.tokenStorage.getSession();
      if (!this.isSessionRecordValid(session)) {
        if (session) {
          await this.tokenStorage.clearSession();
        }
        this.sessionSignal.set(null);
        return;
      }
      this.sessionSignal.set(session);
    } catch {
      this.sessionSignal.set(null);
    }
  }

  /**
   * Convierte la respuesta de DummyJSON al registro canónico de sesión JWT.
   * Soporta tanto `accessToken` (API actual de DummyJSON) como `token`.
   */
  private mapDummyJsonResponseToSessionRecord(
    response: DummyJsonLoginResponse,
    role: UserRole
  ): PersistedSessionRecord {
    const accessToken = response.accessToken ?? response.token;
    if (!accessToken) {
      throw 'unexpected_error' as AuthenticationErrorCode;
    }

    const jwtExpSeconds = this.extractJwtExpirationClaim(accessToken);
    const expiresAt = jwtExpSeconds
      ? new Date(jwtExpSeconds * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      accessToken,
      refreshToken: response.refreshToken ?? '',
      username: response.username,
      firstName: response.firstName,
      lastName: response.lastName,
      role,
      source: 'remote-api',
      expiresAt,
      schemaVersion: 1,
    };
  }

  /**
   * Genera un token local determinista cuando la API remota no está disponible,
   * tomando el perfil almacenado en `shopper_db.users` si existe.
   */
  private async performOfflineFallbackLogin(
    credentials: ShoperLoginCredentials
  ): Promise<PersistedSessionRecord> {
    const dbUser = await this.database.getUserByUsername(credentials.username);
    const offlineToken = `offline-jwt-${credentials.username}-${Date.now()}`;
    const sessionRecord: PersistedSessionRecord = {
      accessToken: offlineToken,
      refreshToken: offlineToken,
      username: credentials.username,
      firstName: dbUser?.firstName ?? credentials.username,
      lastName: dbUser?.lastName ?? 'Offline',
      role: credentials.role,
      source: 'offline-fallback',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      schemaVersion: 1,
    };

    await this.tokenStorage.setSession(sessionRecord);
    await this.database.upsertUser({
      username: sessionRecord.username,
      firstName: sessionRecord.firstName,
      lastName: sessionRecord.lastName,
      role: sessionRecord.role,
      source: 'offline-fallback',
      lastLoginAt: new Date().toISOString(),
    });
    this.sessionSignal.set(sessionRecord);
    return sessionRecord;
  }

  /**
   * Valida que el registro posea un token no vacío y no haya caducado.
   */
  private isSessionRecordValid(session: PersistedSessionRecord | null): session is PersistedSessionRecord {
    if (!session || !session.accessToken) {
      return false;
    }
    if (!session.expiresAt) {
      return true;
    }
    const expiresAtMs = Date.parse(session.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      return false;
    }
    const skewMs = environment.jwtSession.clockSkewSeconds * 1000;
    return expiresAtMs - skewMs > Date.now();
  }

  /**
   * Decodifica el segmento Base64URL del payload JWT para leer el claim `exp`.
   */
  private extractJwtExpirationClaim(compactJwt: string): number | null {
    try {
      const payloadSegment = compactJwt.split('.')[1];
      if (!payloadSegment) {
        return null;
      }
      const standardBase64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = JSON.parse(atob(standardBase64)) as { exp?: number };
      return typeof decodedPayload.exp === 'number' ? decodedPayload.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Determina si un error HTTP corresponde a una falla de red.
   */
  private isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }

  /**
   * Traduce errores HTTP a códigos de dominio predecibles.
   */
  private translateHttpAuthError(error: unknown): AuthenticationErrorCode {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401 || error.status === 400) {
        return 'invalid_credentials';
      }
      if (error.status === 0) {
        return 'network_error';
      }
    }
    return 'unexpected_error';
  }
}
