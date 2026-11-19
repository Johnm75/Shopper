/**
 * Modelos tipados del dominio "App Shoper".
 *
 * Centraliza los contratos de sesión JWT, catálogo de productos, carrito de
 * compras y pedidos. Todas las entidades persistentes incluyen `schemaVersion`
 * para migraciones futuras.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 3 — Arquitectura Capacitor
 */

/**
 * Roles de usuario reconocidos por la aplicación.
 * - `customer`: comprador que navega el catálogo y genera pedidos.
 * - `seller`: vendedor que actualiza el estado de los pedidos.
 */
export type UserRole = 'customer' | 'seller';

/**
 * Origen del token de sesión.
 * - `remote-api`: emitido por DummyJSON tras autenticación exitosa.
 * - `offline-fallback`: generado localmente cuando falla la red.
 */
export type TokenSource = 'remote-api' | 'offline-fallback';

/**
 * Credenciales de inicio de sesión esperadas por `JwtAuthenticationService.login`.
 */
export interface ShoperLoginCredentials {
  /** Nombre de usuario contra DummyJSON. */
  username: string;
  /** Contraseña de la cuenta demostrativa. */
  password: string;
  /** Rol que adoptará el usuario tras autenticarse. */
  role: UserRole;
}

/**
 * Respuesta cruda devuelta por `POST https://dummyjson.com/auth/login`.
 * DummyJSON actual retorna `accessToken`; versiones previas/mocks usan `token`.
 */
export interface DummyJsonLoginResponse {
  /** Identificador numérico del usuario. */
  id: number;
  /** Nombre de usuario único. */
  username: string;
  /** Correo electrónico asociado a la cuenta. */
  email: string;
  /** Primer nombre del usuario. */
  firstName: string;
  /** Apellido del usuario. */
  lastName: string;
  /** Género registrado en DummyJSON. */
  gender: string;
  /** URL del avatar del usuario. */
  image: string;
  /** Token de acceso JWT actual devuelto por DummyJSON. */
  accessToken?: string;
  /** Alias heredado de token JWT usado por mocks/versiones previas. */
  token?: string;
  /** Token de refresco devuelto por la API. */
  refreshToken: string;
}

/**
 * Usuario registrado o cacheado en la tabla `users` de `shopper_db`.
 */
export interface DatabaseUserRecord {
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  source: TokenSource;
  lastLoginAt: string;
}

/**
 * Registro de sesión persistido en `shopper_db`.
 *
 * ⚠️ El token se almacena en texto plano; este esquema es válido solo para
 * la demostración académica y no para producción con datos reales.
 */
export interface PersistedSessionRecord {
  /** Token de acceso JWT (o token offline determinista). */
  accessToken: string;
  /** Token de refresco devuelto por la API remota. */
  refreshToken: string;
  /** Nombre de usuario autenticado. */
  username: string;
  /** Primer nombre del usuario. */
  firstName: string;
  /** Apellido del usuario. */
  lastName: string;
  /** Rol activo del usuario en la aplicación. */
  role: UserRole;
  /** Origen del token: API remota o fallback offline. */
  source: TokenSource;
  /** Fecha límite de vigencia del token en formato ISO 8601. */
  expiresAt?: string;
  /** Versión del esquema para futuras migraciones de datos. */
  schemaVersion: 1;
}

/**
 * Producto del catálogo.
 */
export interface ProductItem {
  /** Identificador numérico del producto. */
  id: number;
  /** Título o nombre del producto. */
  title: string;
  /** Precio unitario. */
  price: number;
  /** Unidades disponibles en inventario. */
  stock: number;
  /** Categoría comercial del producto. */
  category: string;
  /** URL de la miniatura del producto. */
  thumbnail: string;
  /** Descripción opcional del producto. */
  description?: string;
}

/**
 * Estado persistido del catálogo de productos.
 */
export interface PersistedCatalogState {
  /** Versión del esquema del catálogo. */
  schemaVersion: 1;
  /** Lista de productos disponibles. */
  products: ProductItem[];
  /** Marca temporal ISO de la última actualización. */
  lastUpdatedAt: string;
}

/**
 * Línea de carrito de compras.
 */
export interface CartLineItem {
  /** Identificador del producto asociado. */
  productId: number;
  /** Título del producto en el momento de agregarlo. */
  title: string;
  /** Precio unitario al momento de agregarlo. */
  price: number;
  /** Cantidad de unidades seleccionadas. */
  quantity: number;
  /** URL de la miniatura del producto. */
  thumbnail: string;
}

/**
 * Estado persistido del carrito de compras.
 */
export interface PersistedCartState {
  /** Versión del esquema del carrito. */
  schemaVersion: 1;
  /** Líneas de productos en el carrito. */
  items: CartLineItem[];
}

/**
 * Estados posibles de un pedido.
 */
export type OrderStatus = 'Pagado' | 'En preparación' | 'En camino' | 'Entregado';

/**
 * Flujo canónico de estados de un pedido.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'Pagado',
  'En preparación',
  'En camino',
  'Entregado',
];

/**
 * Entrada individual en el historial de estados de un pedido.
 */
export interface OrderStatusEntry {
  /** Estado alcanzado en este punto del historial. */
  status: OrderStatus;
  /** Marca temporal ISO de la actualización. */
  timestamp: string;
  /** Actor que actualizó el estado; en este dominio siempre es el vendedor. */
  updatedBy: 'seller';
}

/**
 * Registro de un pedido realizado por un cliente.
 */
export interface OrderRecord {
  /** Identificador único del pedido. */
  id: string;
  /** Líneas de productos incluidas en el pedido. */
  items: CartLineItem[];
  /** Importe total calculado del pedido. */
  totalAmount: number;
  /** Cantidad total de unidades del pedido. */
  totalUnits: number;
  /** Estado actual del pedido. */
  currentStatus: OrderStatus;
  /** Historial completo de cambios de estado. */
  statusHistory: OrderStatusEntry[];
  /** Marca temporal ISO de creación del pedido. */
  createdAt: string;
  /** Marca temporal ISO del pago, si aplica. */
  paidAt?: string;
}

/**
 * Estado persistido del listado de pedidos.
 */
export interface PersistedOrdersState {
  /** Versión del esquema de pedidos. */
  schemaVersion: 1;
  /** Listado de pedidos realizados. */
  orders: OrderRecord[];
}
