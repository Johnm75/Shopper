/**
 * Configuración del puente nativo Capacitor para la aplicación "App Shoper".
 *
 * Define la identidad del paquete, el directorio de compilación web que se
 * sincroniza hacia Android/iOS y el esquema HTTPS local del WebView.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

// Importa el tipo de configuración que espera la CLI de Capacitor.
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Objeto de configuración canónico del puente nativo.
 *
 * - `appId` identifica de forma única la aplicación en Google Play y App Store.
 * - `appName` es el nombre visible para el usuario.
 * - `webDir` apunta a la carpeta `www` generada por `ionic build`.
 * - `server.androidScheme` fuerza HTTPS en el WebView de Android para evitar
 *   bloqueos de contenido mixto al consumir APIs REST y archivos locales.
 */
const capacitorConfig: CapacitorConfig = {
  appId: 'com.abp.appshoper',
  appName: 'App Shoper',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

// Exporta la configuración como valor por defecto para que la CLI la descubra.
export default capacitorConfig;
