/**
 * Pruebas unitarias de `LoginPage` (Fase 6 SDD — TASK-021).
 *
 * Valida el renderizado sin errores, la conmutación de rol en el formulario,
 * la presencia de atributos de accesibilidad y la delegación al servicio de
 * autenticación con manejo de retorno seguro.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para crear y controlar el componente.
import { ComponentFixture, TestBed } from '@angular/core/testing';
// Esquema que permite a Angular ignorar elementos personalizados de Ionic en pruebas.
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// Señal usada para simular el rol activo expuesto por el servicio de sesión.
import { signal } from '@angular/core';
// Proveedor de router y utilidades para simular parámetros de consulta.
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
// Controlador de toasts de Ionic inyectado por la página.
import { ToastController } from '@ionic/angular';

// Módulo y componente bajo prueba.
import { LoginPageModule } from './login.module';
import { LoginPage } from './login.page';
// Servicio de autenticación que la página delega para iniciar sesión.
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Tipo de rol para tipar el doble de prueba.
import type { UserRole } from '../models/shoper.model';

// Suite de pruebas del componente de inicio de sesión.
describe('LoginPage', () => {
  // Referencia al componente instanciado.
  let component: LoginPage;
  // Fixture que permite acceder al DOM renderizado.
  let fixture: ComponentFixture<LoginPage>;
  // Espía/método simulado de login del servicio.
  let loginSpy: ReturnType<typeof vi.fn>;
  // Señal simulada del rol activo para observar conmutaciones.
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;
  // Instancia del router para espiar la navegación.
  let router: Router;

  // Configura el módulo de pruebas con dobles controlados antes de cada caso.
  beforeEach(async () => {
    // Restablece el TestBed para aislar cada escenario de pruebas.
    TestBed.resetTestingModule();
    // Inicializa el rol simulado en cliente por defecto.
    activeRoleSignal = signal<UserRole>('customer');
    // Crea un espía de login que resuelve una sesión remota exitosa.
    loginSpy = vi.fn().mockResolvedValue({
      accessToken: 'jwt',
      refreshToken: 'r',
      username: 'emilys',
      firstName: 'Emily',
      lastName: 'Stone',
      role: 'customer',
      source: 'remote-api',
      schemaVersion: 1,
    });

    // Compila el módulo de la página con proveedores y esquemas simulados.
    await TestBed.configureTestingModule({
      imports: [LoginPageModule],
      providers: [
        provideRouter([]),
        { provide: JwtAuthenticationService, useValue: { login: loginSpy, activeRole: activeRoleSignal } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '//malicioso.example' }) } },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    // Crea la instancia del componente y dispara la detección de cambios inicial.
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Restaura los espías y el entorno después de cada prueba.
  afterEach(() => {
    // Restablece el módulo de pruebas para evitar fugas de estado.
    TestBed.resetTestingModule();
    // Revierte mocks para evitar interferencias entre casos.
    vi.restoreAllMocks();
  });

  // Debe renderizar el componente sin errores.
  it('debe renderizar el componente LoginPage sin errores', () => {
    // Verifica que la instancia del componente sea válida.
    expect(component).toBeTruthy();
  });

  // Debe exponer atributos de accesibilidad clave en la plantilla.
  it('debe incluir atributos de accesibilidad aria-label y controles accesibles', () => {
    // Obtiene el elemento raíz renderizado.
    const host = fixture.nativeElement as HTMLElement;
    // Comprueba que el selector de rol tenga un aria-label descriptivo.
    const roleSegment = host.querySelector('ion-segment[aria-label]');
    expect(roleSegment).toBeTruthy();
  });

  // Debe conmutar el rol del formulario mediante el autocompletado de credenciales.
  it('debe conmutar reactivamente el rol del formulario al usar el autocompletado rápido', () => {
    // Aplica el autocompletado para el rol vendedor.
    component.fillDemoCredentials('seller');
    // Verifica que el control reactivo refleje el rol vendedor.
    expect(component.credentialsForm.controls.role.value).toBe('seller');

    // Cambia nuevamente al rol cliente.
    component.fillDemoCredentials('customer');
    // Confirma que el formulario vuelve al rol cliente.
    expect(component.credentialsForm.controls.role.value).toBe('customer');
  });

  // Debe delegar el login y navegar a una ruta segura descartando returnUrl malicioso.
  it('debe autenticar y redirigir a /tabs/tab1 descartando un returnUrl malicioso', async () => {
    // Espía la navegación para verificar la ruta sanitizada.
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    // Completa el formulario con credenciales válidas.
    component.credentialsForm.setValue({ username: 'emilys', password: 'emilyspass', role: 'customer' });
    // Envía el formulario.
    await component.submitLoginForm();

    // Comprueba que se haya invocado el servicio de autenticación.
    expect(loginSpy).toHaveBeenCalledTimes(1);
    // Verifica que la navegación caiga en la ruta segura por defecto.
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/tab1', { replaceUrl: true });
  });
});
