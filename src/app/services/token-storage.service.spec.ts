/**
 * Pruebas unitarias de `TokenStorageService` (compatibilidad y API canónica).
 *
 * Verifica el almacenamiento canónico de sesión en `shoper.session.v1` y el
 * comportamiento de los métodos heredados ante datos corruptos.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para obtener instancias en un entorno aislado.
import { TestBed } from '@angular/core/testing';
// Almacenamiento nativo simulado utilizado por el servicio.
import { Preferences } from '@capacitor/preferences';

// Servicio bajo prueba que abstrae la persistencia de la sesión.
import { TokenStorageService } from './token-storage.service';
// Entorno con las claves de almacenamiento canónicas y heredadas.
import { environment } from '../../environments/environment';
// Contrato de sesión persistida para construir registros deterministas.
import type { PersistedSessionRecord } from '../models/shoper.model';

// Suite de pruebas del almacenamiento de sesión.
describe('TokenStorageService', () => {
  // Instancia del servicio creada en cada caso.
  let tokenStorageService: TokenStorageService;

  // Prepara un entorno limpio antes de cada prueba.
  beforeEach(async () => {
    // Restablece el TestBed para evitar fugas entre pruebas.
    TestBed.resetTestingModule();
    // Limpia el almacenamiento web.
    window.localStorage.clear();
    // Reinicia Preferences para partir sin sesión persistida.
    await Preferences.clear();

    // Configura un módulo vacío ya que el servicio es `providedIn: 'root'`.
    TestBed.configureTestingModule({});
    // Resuelve la instancia del servicio desde el inyector.
    tokenStorageService = TestBed.inject(TokenStorageService);
  });

  // Limpia el estado tras cada prueba.
  afterEach(async () => {
    // Elimina cualquier dato residual en Preferences.
    await Preferences.clear();
    // Restablece el TestBed.
    TestBed.resetTestingModule();
    // Restaura los espías de Vitest.
    vi.restoreAllMocks();
  });

  // Debe persistir y recuperar el registro canónico de sesión.
  it('debe persistir y recuperar el registro de sesión canónico', async () => {
    // Construye un registro de sesión válido con la versión de esquema actual.
    const sessionRecord: PersistedSessionRecord = {
      accessToken: 'token-demo',
      refreshToken: 'refresh-demo',
      username: 'emilys',
      firstName: 'Emily',
      lastName: 'Stone',
      role: 'customer',
      source: 'remote-api',
      schemaVersion: 1,
      expiresAt: '2026-11-13T00:00:00.000Z',
    };

    // Guarda el registro completo en el almacenamiento.
    await tokenStorageService.setSession(sessionRecord);
    // Recupera el registro para verificar la ronda de lectura/escritura.
    const restoredSession = await tokenStorageService.getSession();

    // Comprueba que el token y el rol se conserven intactos.
    expect(restoredSession?.accessToken).toBe('token-demo');
    expect(restoredSession?.role).toBe('customer');
  });

  // Debe limpiar la sesión canónica y las claves heredadas.
  it('debe limpiar la sesión canónica y las claves heredadas al invocar clearStoredSession', async () => {
    // Siembra una sesión canónica y una clave heredada para simular datos previos.
    await tokenStorageService.setSession({
      accessToken: 'legacy-token',
      refreshToken: '',
      username: 'legacy',
      firstName: 'Legacy',
      lastName: 'User',
      role: 'customer',
      source: 'offline-fallback',
      schemaVersion: 1,
    });
    await Preferences.set({ key: environment.jwtSession.accessTokenKey, value: 'old-token' });

    // Ejecuta la limpieza completa.
    await tokenStorageService.clearStoredSession();

    // Verifica que tanto la sesión canónica como la clave heredada queden vacías.
    const canonical = await Preferences.get({ key: environment.storageKeys.session });
    const legacyToken = await Preferences.get({ key: environment.jwtSession.accessTokenKey });
    expect(canonical.value).toBeNull();
    expect(legacyToken.value).toBeNull();
  });

  // Debe devolver null y limpiar la clave canónica si el JSON almacenado está dañado.
  it('debe devolver null y limpiar la sesión si el JSON canónico está dañado', async () => {
    // Escribe un valor inválido directamente en la clave de sesión.
    await Preferences.set({ key: environment.storageKeys.session, value: '{corrupt-json' });

    // Intenta leer la sesión; el servicio debe tolerar el error y sanear el estado.
    const restoredSession = await tokenStorageService.getSession();
    // Comprueba que el resultado sea nulo.
    expect(restoredSession).toBeNull();

    // Verifica que la clave corrupta haya sido eliminada.
    const rawStoredSession = await Preferences.get({ key: environment.storageKeys.session });
    expect(rawStoredSession.value).toBeNull();
  });
});
