/**
 * Configuración del puente nativo Capacitor para "App Shoper".
 *
 * Define la identidad del paquete, el directorio web sincronizado, el esquema
 * HTTPS del WebView en Android y la política de la barra de estado nativa.
 */

import type { CapacitorConfig } from '@capacitor/cli';

/** Configuración canónica leída por la CLI de Capacitor. */
const capacitorConfig: CapacitorConfig = {
  appId: 'com.abp.appshoper',
  appName: 'App Shoper',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#eef2f9',
    },
  },
};

export default capacitorConfig;
