/**
 * Variables de entorno de desarrollo para "App Shoper".
 *
 * Define el origen HTTP autorizado para tokens Bearer, credenciales públicas
 * de demostración y las claves heredadas empleadas en la migración hacia `shopper_db`.
 */

/** Configuración de entorno en modo desarrollo. */
export const environment = {
  production: false,
  apiBaseUrl: 'https://dummyjson.com',
  fallbackApiBaseUrl: 'https://fakestoreapi.com',
  requestTimeoutMs: 8_000,
  demoCredentials: {
    customer: { username: 'emilys', password: 'emilyspass' },
    seller: { username: 'michaelw', password: 'michaelwpass' },
  },
  storageKeys: {
    session: 'shoper.session.v1',
    catalog: 'shoper.catalog.v1',
    cart: 'shoper.cart.v1',
    orders: 'shoper.orders.v1',
  },
  jwtSession: {
    accessTokenKey: 'auth.jwt.token',
    expirationKey: 'auth.jwt.expiresAt',
    userProfileKey: 'auth.user.profile',
    clockSkewSeconds: 30,
    defaultTimeToLiveSeconds: 3_600,
  },
};
