/**
 * Fachada de almacenamiento local sobre `ShopperDatabaseService` (IndexedDB +
 * respaldo `@capacitor/preferences`) para la sesión de "App Shoper".
 *
 * Expone una API canónica (`getSession`, `setSession`, `clearSession`) y
 * mantiene métodos heredados para compatibilidad con componentes y specs de la
 * galería de fotos.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { PersistedSessionRecord } from '../models/shoper.model';
import type { AuthenticatedUserProfile } from '../models/auth.model';
import { environment } from '../../environments/environment';
import { ShopperDatabaseService } from './database.service';

@Injectable({
  providedIn: 'root',
})
export class TokenStorageService {
  private readonly database = inject(ShopperDatabaseService);

  /**
   * Recupera la sesión persistida o `null` si no existe o está corrupta.
   */
  async getSession(): Promise<PersistedSessionRecord | null> {
    return this.database.getSession();
  }

  /**
   * Serializa y guarda el registro de sesión completo en la base de datos.
   */
  async setSession(record: PersistedSessionRecord): Promise<void> {
    await this.database.saveSession(record);
  }

  /**
   * Elimina el registro de sesión de la base de datos local.
   */
  async clearSession(): Promise<void> {
    await this.database.clearSession();
  }

  // --- Métodos heredados de compatibilidad con la galería de fotos ---

  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.accessToken ?? null;
  }

  async saveAccessToken(accessToken: string): Promise<void> {
    const session = (await this.getSession()) ?? this.createEmptySession(accessToken);
    session.accessToken = accessToken;
    await this.setSession(session);
  }

  async getExpirationTimestamp(): Promise<number | null> {
    const session = await this.getSession();
    if (!session?.expiresAt) {
      return null;
    }
    const parsed = Date.parse(session.expiresAt);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async saveExpirationTimestamp(expirationTimestampMs: number): Promise<void> {
    const session = (await this.getSession()) ?? this.createEmptySession('legacy-token');
    session.expiresAt = new Date(expirationTimestampMs).toISOString();
    await this.setSession(session);
  }

  async getAuthenticatedUserProfile(): Promise<AuthenticatedUserProfile | null> {
    const session = await this.getSession();
    if (!session) {
      return null;
    }
    return {
      id: session.username,
      fullName: `${session.firstName} ${session.lastName}`.trim(),
      email: `${session.username}@example.com`,
      role: 'student',
    };
  }

  async saveAuthenticatedUserProfile(userProfile: AuthenticatedUserProfile): Promise<void> {
    const session = (await this.getSession()) ?? this.createEmptySession('legacy-token');
    const nameParts = userProfile.fullName.split(' ');
    session.firstName = nameParts[0] ?? 'Usuario';
    session.lastName = nameParts.slice(1).join(' ').trim() || 'Demo';
    session.username = userProfile.id;
    await this.setSession(session);
  }

  async clearStoredSession(): Promise<void> {
    await Promise.all([
      this.clearSession(),
      Preferences.remove({ key: environment.jwtSession.accessTokenKey }),
      Preferences.remove({ key: environment.jwtSession.expirationKey }),
      Preferences.remove({ key: environment.jwtSession.userProfileKey }),
    ]);
  }

  private createEmptySession(accessToken: string): PersistedSessionRecord {
    return {
      accessToken,
      refreshToken: '',
      username: 'legacy',
      firstName: 'Legacy',
      lastName: 'User',
      role: 'customer',
      source: 'offline-fallback',
      schemaVersion: 1,
    };
  }
}

export { TokenStorageService as JwtSessionStorageService };
