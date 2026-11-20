/**
 * Variables de entorno de producción para "App Shoper".
 *
 * Se empaqueta con `npm run build` y se sincroniza hacia los proyectos nativos Android e iOS.
 */

/** Configuración de entorno en modo producción. */
export const environment = {
  production: true,
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
