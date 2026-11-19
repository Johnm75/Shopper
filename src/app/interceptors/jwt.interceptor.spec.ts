/**
 * Pruebas unitarias de `jwtAuthInterceptor` (Fase 6 SDD — TASK-020).
 *
 * Verifica la inyección de `Authorization: Bearer` únicamente hacia
 * `environment.apiBaseUrl` y la exclusión explícita del endpoint `/auth/login`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para configurar un cliente HTTP con interceptores.
import { TestBed } from '@angular/core/testing';
// Cliente HTTP real que atravesará el interceptor bajo prueba.
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
// Backend de pruebas que captura las peticiones emitidas por HttpClient.
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
// Señal usada para simular el estado reactivo de la sesión autenticada.
import { signal } from '@angular/core';
// Utilidad RxJS para convertir la primera emisión del observable en una promesa.
import { firstValueFrom } from 'rxjs';

// Interceptor funcional que debe adjuntar el token Bearer según las reglas de seguridad.
import { jwtAuthInterceptor } from './jwt.interceptor';
// Servicio de autenticación del que el interceptor lee la sesión actual.
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Entorno con el origen base autorizado de la API.
import { environment } from '../../environments/environment';
// Contrato de sesión persistida para tipar el doble de prueba.
import type { PersistedSessionRecord } from '../models/shoper.model';

// Suite de pruebas del interceptor JWT.
describe('jwtAuthInterceptor', () => {
  // Cliente HTTP configurado con el interceptor a evaluar.
  let httpClient: HttpClient;
  // Controlador que permite inspeccionar las cabeceras de las peticiones.
  let httpController: HttpTestingController;
  // Señal simulada que representa la sesión activa expuesta por el servicio.
  let sessionSignal: ReturnType<typeof signal<PersistedSessionRecord | null>>;

  // Sesión de ejemplo con token válido para los escenarios que requieren autorización.
  const activeSession: PersistedSessionRecord = {
    accessToken: 'jwt-token-demo',
    refreshToken: 'refresh-token-demo',
    username: 'emilys',
    firstName: 'Emily',
    lastName: 'Stone',
    role: 'customer',
    source: 'remote-api',
    schemaVersion: 1,
  };

  // Configura el entorno de pruebas con un servicio de sesión simulado.
  beforeEach(() => {
    // Inicializa la señal con una sesión autenticada por defecto.
    sessionSignal = signal<PersistedSessionRecord | null>(activeSession);

    // Registra el cliente HTTP con el interceptor y el doble del servicio de sesión.
    TestBed.configureTestingModule({
      providers: [
        { provide: JwtAuthenticationService, useValue: { sessionSignal } },
        provideHttpClient(withInterceptors([jwtAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    // Obtiene las instancias necesarias para ejecutar y observar las peticiones.
    httpClient = TestBed.inject(HttpClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  // Verifica que no queden peticiones pendientes y limpia los espías.
  afterEach(() => {
    // Garantiza que todas las solicitudes hayan sido atendidas.
    httpController.verify();
    // Restaura los mocks de Vitest al estado inicial.
    vi.restoreAllMocks();
  });

  // Debe adjuntar Authorization Bearer en peticiones al origen autorizado distinto de /auth/login.
  it('debe adjuntar Authorization: Bearer en peticiones dirigidas a environment.apiBaseUrl', async () => {
    // Emite una petición GET protegida hacia el origen autorizado.
    const requestPromise = firstValueFrom(httpClient.get(`${environment.apiBaseUrl}/products?limit=20`));
    // Cede el ciclo para que HttpClient emita la solicitud interceptada.
    await Promise.resolve();

    // Captura la petición y comprueba la cabecera de autorización.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/products?limit=20`);
    expect(pendingRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token-demo');
    // Responde con un cuerpo vacío para completar el observable.
    pendingRequest.flush({});

    // Espera la resolución final de la promesa.
    await requestPromise;
  });

  // No debe adjuntar el token al endpoint de login aunque pertenezca al origen autorizado.
  it('no debe adjuntar Authorization al endpoint /auth/login', async () => {
    // Emite una petición POST al endpoint de autenticación.
    const requestPromise = firstValueFrom(
      httpClient.post(`${environment.apiBaseUrl}/auth/login`, { username: 'u', password: 'p' })
    );
    // Permite que la solicitud sea registrada por el controlador.
    await Promise.resolve();

    // Captura la petición de login y verifica que no incluya la cabecera Bearer.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(pendingRequest.request.headers.has('Authorization')).toBe(false);
    // Responde para completar la petición.
    pendingRequest.flush({});

    // Espera la finalización del flujo.
    await requestPromise;
  });

  // No debe adjuntar el token a orígenes externos distintos de apiBaseUrl.
  it('no debe adjuntar Authorization a orígenes externos o no autorizados', async () => {
    // Define un origen externo que no debe recibir credenciales.
    const externalUrl = 'https://fakestoreapi.com/products';

    // Emite la petición hacia el dominio externo.
    const requestPromise = firstValueFrom(httpClient.get(externalUrl));
    await Promise.resolve();

    // Comprueba que la cabecera Authorization esté ausente.
    const pendingRequest = httpController.expectOne(externalUrl);
    expect(pendingRequest.request.headers.has('Authorization')).toBe(false);
    pendingRequest.flush([]);

    // Finaliza la promesa asociada.
    await requestPromise;
  });
});
