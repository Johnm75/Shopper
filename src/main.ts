/**
 * Punto de entrada de la aplicación híbrida Ionic/Angular "App Shoper".
 *
 * Inicia el componente raíz `AppComponent` con los proveedores globales de `appConfig`.
 */

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(bootstrapError =>
  console.error(bootstrapError)
);
