/**
 * Pruebas unitarias de `JwtAuthenticationService` (Fase 6 SDD — TASK-020).
 *
 * Verifica autenticación remota contra DummyJSON, activación automática del
 * modo `offline-fallback` ante fallo de red, persistencia en `shoper.session.v1`,
 * cambio reactivo de rol y cierre de sesión.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para crear un módulo aislado por escenario.
import { TestBed } from '@angular/core/testing';
// Proveedor del cliente HTTP que el servicio usa para autenticar.
import { provideHttpClient } from '@angular/common/http';
// Backend de pruebas HTTP para interceptar y controlar respuestas.
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
// Router vacío requerido por el constructor del servicio.
import { provideRouter } from '@angular/router';
// Almacenamiento nativo simulado donde se persiste la sesión.
import { Preferences } from '@capacitor/preferences';

// Servicio bajo prueba con la lógica de sesión JWT y fallback offline.
import { JwtAuthenticationService } from './auth-jwt.service';
// Variables de entorno con origen API y clave canónica de sesión.
import { environment } from '../../environments/environment';
// Contrato de credenciales tipadas que espera el método `login`.
import type { ShoperLoginCredentials } from '../models/shoper.model';

// Suite principal de pruebas del servicio de autenticación.
describe('JwtAuthenticationService', () => {
  // Instancia del servicio creada en cada prueba.
  let authenticationService: JwtAuthenticationService;
  // Controlador HTTP para afirmar y resolver peticiones.
  let httpController: HttpTestingController;

  // Credenciales demostrativas válidas usadas en los escenarios remotos y offline.
  const validCredentials: ShoperLoginCredentials = {
    username: 'emilys',
    password: 'emilyspass',
    role: 'customer',
  };

  // Prepara un entorno limpio antes de cada caso.
  beforeEach(async () => {
    // Limpia el almacenamiento web para evitar sesiones residuales.
    window.localStorage.clear();
    // Reinicia Preferences para que no exista sesión persistida previa.
    await Preferences.clear();

    // Configura proveedores mínimos: HttpClient, testing backend y router.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    // Resuelve las dependencias necesarias desde el inyector de pruebas.
    authenticationService = TestBed.inject(JwtAuthenticationService);
    httpController = TestBed.inject(HttpTestingController);
  });

  // Garantiza que no queden peticiones pendientes y limpia efectos secundarios.
  afterEach(() => {
    // Falla si existe alguna solicitud HTTP sin atender.
    httpController.verify();
    // Limpia el almacenamiento local del navegador.
    window.localStorage.clear();
    // Restaura los espías/mocks de Vitest.
    vi.restoreAllMocks();
  });

  // Debe autenticar contra DummyJSON y persistir la sesión en `shoper.session.v1`.
  it('debe autenticar exitosamente contra DummyJSON y persistir la sesión en shoper.session.v1', async () => {
    // Dispara el login remoto sin esperar aún la respuesta HTTP.
    const loginPromise = authenticationService.login(validCredentials);

    // Intercepta la petición POST esperada al endpoint de autenticación.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    // Verifica el método HTTP utilizado.
    expect(pendingRequest.request.method).toBe('POST');
    // Responde con un token simulado en el formato de DummyJSON.
    pendingRequest.flush({
      id: 1,
      username: 'emilys',
      email: 'emily@example.com',
      firstName: 'Emily',
      lastName: 'Stone',
      gender: 'female',
      image: 'https://img/u.png',
      token: 'remote.jwt.token',
      refreshToken: 'remote.refresh.token',
    });

    // Espera el resultado del login y la persistencia asociada.
    const session = await loginPromise;

    // Comprueba que la sesión activa provenga de la API remota.
    expect(session.source).toBe('remote-api');
    expect(authenticationService.isAuthenticated()).toBe(true);
    expect(authenticationService.activeRole()).toBe('customer');

    // Verifica que la sesión se haya guardado bajo la clave canónica.
    const storedValue = await Preferences.get({ key: environment.storageKeys.session });
    expect(storedValue.value).toContain('remote.jwt.token');
  });

  // Debe activar el fallback offline cuando ocurre un error de red (status 0).
  it('debe activar automáticamente el modo offline-fallback ante un error HTTP de red', async () => {
    // Inicia el intento de login remoto.
    const loginPromise = authenticationService.login({ ...validCredentials, role: 'seller' });

    // Intercepta la petición y simula una falla de red con status 0.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    pendingRequest.error(new ProgressEvent('error'), { status: 0, statusText: 'Network Error' });

    // Espera a que el servicio resuelva el flujo de contingencia.
    const session = await loginPromise;
    // Cede el control para permitir que la persistencia diferida (`void`) se complete.
    await Promise.resolve();

    // Valida que la sesión creada sea offline y conserve el rol solicitado.
    expect(session.source).toBe('offline-fallback');
    expect(authenticationService.isAuthenticated()).toBe(true);
    expect(authenticationService.activeRole()).toBe('seller');
    expect(session.accessToken).toContain('offline-jwt-emilys');
  });

  // Debe cambiar el rol activo de forma reactiva y persistirlo.
  it('debe cambiar el rol activo con switchActiveRole y persistir el cambio', async () => {
    // Crea una sesión inicial autenticando contra la API simulada.
    const loginPromise = authenticationService.login(validCredentials);
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    pendingRequest.flush({
      id: 1,
      username: 'emilys',
      email: 'emily@example.com',
      firstName: 'Emily',
      lastName: 'Stone',
      gender: 'female',
      image: 'https://img/u.png',
      token: 'remote.jwt.token',
      refreshToken: 'remote.refresh.token',
    });
    await loginPromise;

    // Cambia el rol activo de customer a seller.
    await authenticationService.switchActiveRole('seller');

    // Verifica que la señal reactiva y el almacenamiento reflejen el nuevo rol.
    expect(authenticationService.activeRole()).toBe('seller');
    const storedValue = await Preferences.get({ key: environment.storageKeys.session });
    expect(storedValue.value).toContain('"role":"seller"');
  });

  // Debe cerrar sesión limpiando la señal y el almacenamiento persistido.
  it('debe cerrar la sesión limpiando la señal reactiva y el almacenamiento', async () => {
    // Autentica para disponer de una sesión activa que pueda cerrarse.
    const loginPromise = authenticationService.login(validCredentials);
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    pendingRequest.flush({
      id: 1,
      username: 'emilys',
      email: 'emily@example.com',
      firstName: 'Emily',
      lastName: 'Stone',
      gender: 'female',
      image: 'https://img/u.png',
      token: 'remote.jwt.token',
      refreshToken: 'remote.refresh.token',
    });
    await loginPromise;
    expect(authenticationService.isAuthenticated()).toBe(true);

    // Ejecuta el cierre de sesión.
    await authenticationService.logout();

    // Comprueba que no quede sesión en memoria ni en Preferences.
    expect(authenticationService.isAuthenticated()).toBe(false);
    expect(authenticationService.sessionSignal()).toBeNull();
    const storedValue = await Preferences.get({ key: environment.storageKeys.session });
    expect(storedValue.value).toBeNull();
  });

  // Debe soportar el campo `accessToken` devuelto por DummyJSON actual.
  it('debe mapear el campo accessToken de DummyJSON y extraer la expiración del JWT', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payloadB64 = btoa(JSON.stringify({ exp: futureExp }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const realJwt = `header.${payloadB64}.signature`;

    const loginPromise = authenticationService.login(validCredentials);
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    pendingRequest.flush({
      id: 1,
      username: 'emilys',
      email: 'emily@example.com',
      firstName: 'Emily',
      lastName: 'Johnson',
      gender: 'female',
      image: 'https://img/u.png',
      accessToken: realJwt,
      refreshToken: 'remote.refresh.token',
    });

    const session = await loginPromise;
    expect(session.accessToken).toBe(realJwt);
    expect(await authenticationService.hasActiveSession()).toBe(true);
    expect(await authenticationService.getValidAccessToken()).toBe(realJwt);
  });

  // Debe invalidar sesiones vencidas o sin token al restaurar/verificar sesión.
  it('debe descartar sesiones expiradas o sin accessToken en hasActiveSession()', async () => {
    await Preferences.set({
      key: environment.storageKeys.session,
      value: JSON.stringify({
        accessToken: 'expired.jwt.token',
        refreshToken: 'ref',
        username: 'emilys',
        firstName: 'Emily',
        lastName: 'Johnson',
        role: 'customer',
        source: 'remote-api',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        schemaVersion: 1,
      }),
    });

    await authenticationService.restorePersistedSession();
    expect(await authenticationService.hasActiveSession()).toBe(false);
    expect(authenticationService.sessionSignal()).toBeNull();
  });
});
