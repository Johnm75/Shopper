/**
 * Proveedores raíz de Angular para "App Shoper".
 *
 * Registra el enrutador, Ionic, el cliente HTTP con `jwtAuthInterceptor` y el
 * inicializador de arranque obligatorio en `/login`.
 */

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { appRoutes } from './app.routes';
import { JwtAuthenticationService } from './services/auth-jwt.service';
import { jwtAuthInterceptor } from './interceptors/jwt.interceptor';

/** Configuración global de inyección de dependencias de la aplicación. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(appRoutes),
    provideIonicAngular({}),
    provideHttpClient(withInterceptors([jwtAuthInterceptor])),
    provideAppInitializer(() => inject(JwtAuthenticationService).initializeStartupAtLogin()),
  ],
};
