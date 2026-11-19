/**
 * Proveedores raíz de Angular para "App Shoper".
 *
 * Centraliza la configuración de Ionic, la estrategia de reutilización de rutas,
 * el enrutador, el cliente HTTP con el interceptor JWT y la hidratación inicial
 * de la sesión desde almacenamiento nativo.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
// Proveedores de enrutamiento y estrategia de reutilización de vistas.
import { RouteReuseStrategy, provideRouter } from '@angular/router';
// Cliente HTTP con registro funcional de interceptores.
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// Estrategia de Ionic para conservar vistas en caché y proveedor Angular de Ionic.
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

// Definición de rutas de la aplicación.
import { appRoutes } from './app.routes';
// Servicio de sesión JWT, necesario para la hidratación temprana.
import { JwtAuthenticationService } from './services/auth-jwt.service';
// Interceptor funcional que adjunta el token Bearer en peticiones a la API.
import { jwtAuthInterceptor } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Agrupa eventos del DOM en un mismo ciclo de detección de cambios en móvil.
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Conserva las vistas de pestañas en caché al navegar hacia atrás.
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Configura el enrutador con las rutas canónicas de la aplicación.
    provideRouter(appRoutes),
    // Inicializa Ionic con configuración por defecto.
    provideIonicAngular({}),
    // Cliente HTTP con el interceptor JWT para autorización Bearer.
    provideHttpClient(withInterceptors([jwtAuthInterceptor])),
    // Hidrata la sesión persistida antes de que Angular resuelva la ruta inicial.
    provideAppInitializer(() => inject(JwtAuthenticationService).restorePersistedSession()),
  ],
};
