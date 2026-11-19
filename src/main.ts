/**
 * Punto de entrada de la aplicación Ionic/Angular "App Shoper".
 *
 * Registra los elementos personalizados de `@ionic/pwa-elements` para que la
 * cámara funcione en navegador de escritorio y arranca la aplicación con la
 * configuración centralizada de `app.config.ts`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

// Función de Angular para arrancar una aplicación standalone.
import { bootstrapApplication } from '@angular/platform-browser';
// Loader de elementos personalizados de Ionic para modales web (cámara, etc.).
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Componente raíz de la aplicación.
import { AppComponent } from './app/app.component';
// Configuración global de proveedores (Ionic, rutas, interceptores HTTP).
import { appConfig } from './app/app.config';

// Registra los custom elements de PWA Elements en el objeto window del navegador.
defineCustomElements(window);

// Inicia la aplicación inyectando la configuración canónica de proveedores.
bootstrapApplication(AppComponent, appConfig).catch(bootstrapError =>
  console.error(bootstrapError)
);
