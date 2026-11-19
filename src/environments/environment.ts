/**
 * Variables de entorno de desarrollo para "App Shoper".
 *
 * Contiene los orígenes API autorizados, credenciales demostrativas,
 * claves de almacenamiento local y propiedades heredadas de la galería
 * de fotos que aún utiliza `PhotoService`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

/**
 * Objeto de entorno de desarrollo.
 *
 * ⚠️ ADVERTENCIA DE SEGURIDAD:
 * - Las credenciales `demoCredentials` son meramente demostrativas.
 * - El token JWT devuelto por DummyJSON NO debe considerarse seguro para
 *   producción porque no controlamos su firma ni su renovación.
 * - `@capacitor/preferences` almacena los valores en texto plano; no guarda
 *   datos sensibles reales (PII, tarjetas, contraseñas) en este almacén.
 */
export const environment = {
  production: false,
  // Origen base autorizado para peticiones REST con token Bearer.
  apiBaseUrl: 'https://dummyjson.com',
  // Origen de respaldo documental; el fallback real es offline determinista.
  fallbackApiBaseUrl: 'https://fakestoreapi.com',
  // Tiempo máximo de espera para peticiones HTTP críticas (ms).
  requestTimeoutMs: 8_000,
  // Credenciales demostrativas contra DummyJSON; nunca usar en producción.
  demoCredentials: {
    customer: { username: 'emilys', password: 'emilyspass' },
    seller: { username: 'michaelw', password: 'michaelwpass' },
  },
  // Claves de almacenamiento local en `@capacitor/preferences`.
  storageKeys: {
    session: 'shoper.session.v1',
    catalog: 'shoper.catalog.v1',
    cart: 'shoper.cart.v1',
    orders: 'shoper.orders.v1',
  },

  // --- Propiedades heredadas de la galería de fotos (compatibilidad transitoria) ---
  // Desactiva el interceptor mock porque el fallback real es offline determinista.
  useMockApi: false,
  // Retardo simulado de red para el modo mock heredado.
  mockNetworkDelayMs: 350,
  // Cuenta de prueba heredada con formato email (utilizada por LoginPage legado).
  demoAccountCredentials: {
    email: 'estudiante@example.com',
    password: 'Demo1234!',
  },
  // Configuración de sesión JWT heredada (utilizada por specs y componentes legados).
  jwtSession: {
    accessTokenKey: 'auth.jwt.token',
    expirationKey: 'auth.jwt.expiresAt',
    userProfileKey: 'auth.user.profile',
    clockSkewSeconds: 30,
    defaultTimeToLiveSeconds: 3_600,
  },
  // Configuración del índice de fotos locales (utilizada por PhotoService).
  galleryStorage: {
    indexKey: 'gallery.index.v1',
    maxPhotosLimit: 500,
  },
};
