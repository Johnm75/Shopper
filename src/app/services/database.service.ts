/**
 * Servicio centralizado de base de datos local para "App Shoper".
 *
 * Administra la base de datos estructurada `shopper_db` sobre IndexedDB
 * (motor transaccional nativo del WebView de Android/iOS y navegadores) con
 * respaldo automático sobre `@capacitor/preferences` para entornos sin IndexedDB
 * (p. ej. pruebas unitarias en jsdom) y migración transparente desde las claves
 * heredadas `shoper.*.v1`.
 *
 * Tablas (Object Stores) gestionadas:
 * - `session`    : sesión JWT activa y rol del usuario autenticado.
 * - `products`   : catálogo e inventario de productos (índice `by_category`).
 * - `cart_items` : líneas del carrito de compras del cliente.
 * - `orders`     : historial y cola de pedidos (índice `by_status`).
 * - `metadata`   : marcas de hidratación, semillas y versión de esquema.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { environment } from '../../environments/environment';
import type {
  CartLineItem,
  DatabaseUserRecord,
  OrderRecord,
  PersistedCatalogState,
  PersistedCartState,
  PersistedOrdersState,
  PersistedSessionRecord,
  ProductItem,
} from '../models/shoper.model';

/** Nombres canónicos de las tablas (object stores) en `shopper_db`. */
export type ShopperStoreName =
  | 'session'
  | 'users'
  | 'products'
  | 'cart_items'
  | 'orders'
  | 'metadata';

/** Registro almacenado en el object store `session`. */
interface SessionTableRow extends PersistedSessionRecord {
  id: 'current';
}

/** Registro almacenado en el object store `metadata`. */
interface MetadataTableRow<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

/** Diagnóstico resumido del estado actual de la base de datos. */
export interface ShopperDatabaseStats {
  engine: 'indexeddb' | 'preferences-fallback';
  dbName: string;
  dbVersion: number;
  usersCount: number;
  productsCount: number;
  cartItemsCount: number;
  ordersCount: number;
  hasActiveSession: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ShopperDatabaseService {
  readonly databaseName = 'shopper_db';
  readonly databaseVersion = 2;

  private dbPromise: Promise<IDBDatabase> | null = null;
  private migrationPromise: Promise<void> | null = null;

  /**
   * Indica si el entorno actual soporta IndexedDB nativo.
   */
  isIndexedDbSupported(): boolean {
    return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
  }

  /**
   * Garantiza que la base de datos esté abierta y que cualquier dato heredado
   * de `@capacitor/preferences` haya sido migrado una única vez.
   */
  async ensureReady(): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      return;
    }
    await this.openDatabase();
    if (!this.migrationPromise) {
      this.migrationPromise = this.initializeAndMigrate();
    }
    await this.migrationPromise;
  }

  // =========================================================================
  // TABLA: session
  // =========================================================================

  async getSession(): Promise<PersistedSessionRecord | null> {
    if (!this.isIndexedDbSupported()) {
      return this.readLegacySession();
    }

    await this.ensureReady();
    const row = await this.getByKey<SessionTableRow>('session', 'current');
    if (!row || row.schemaVersion !== 1 || !row.accessToken) {
      return null;
    }
    const { id: _rowId, ...sessionRecord } = row;
    return sessionRecord;
  }

  async saveSession(record: PersistedSessionRecord): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      await Preferences.set({
        key: environment.storageKeys.session,
        value: JSON.stringify(record),
      });
      return;
    }

    await this.ensureReady();
    const row: SessionTableRow = { ...record, id: 'current' };
    await this.putRecord('session', row);
  }

  async clearSession(): Promise<void> {
    await Preferences.remove({ key: environment.storageKeys.session });
    if (!this.isIndexedDbSupported()) {
      return;
    }
    await this.ensureReady();
    await this.deleteByKey('session', 'current');
  }

  // =========================================================================
  // TABLA: users
  // =========================================================================

  async getAllUsers(): Promise<DatabaseUserRecord[]> {
    if (!this.isIndexedDbSupported()) {
      const { value } = await Preferences.get({ key: 'shoper.users.v1' });
      if (!value) {
        return this.createDefaultDemoUsers();
      }
      try {
        const parsed = JSON.parse(value) as DatabaseUserRecord[];
        return Array.isArray(parsed) && parsed.length > 0
          ? parsed
          : this.createDefaultDemoUsers();
      } catch {
        return this.createDefaultDemoUsers();
      }
    }

    await this.ensureReady();
    return this.getAll<DatabaseUserRecord>('users');
  }

  async getUserByUsername(username: string): Promise<DatabaseUserRecord | null> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (!this.isIndexedDbSupported()) {
      const users = await this.getAllUsers();
      return users.find(u => u.username.toLowerCase() === normalized) ?? null;
    }

    await this.ensureReady();
    return this.getByKey<DatabaseUserRecord>('users', normalized);
  }

  async upsertUser(user: DatabaseUserRecord): Promise<void> {
    const normalizedUser: DatabaseUserRecord = {
      ...user,
      username: user.username.trim().toLowerCase(),
    };

    if (!this.isIndexedDbSupported()) {
      const users = await this.getAllUsers();
      const exists = users.some(item => item.username === normalizedUser.username);
      const updated = exists
        ? users.map(item => (item.username === normalizedUser.username ? normalizedUser : item))
        : [...users, normalizedUser];
      await Preferences.set({
        key: 'shoper.users.v1',
        value: JSON.stringify(updated),
      });
      return;
    }

    await this.ensureReady();
    await this.putRecord('users', normalizedUser);
  }

  // =========================================================================
  // TABLA: products
  // =========================================================================

  async hasCatalogBeenInitialized(): Promise<boolean> {
    if (!this.isIndexedDbSupported()) {
      const legacy = await this.readLegacyCatalog();
      return legacy !== null;
    }

    await this.ensureReady();
    const meta = await this.getByKey<MetadataTableRow<boolean>>('metadata', 'catalog_initialized');
    if (meta?.value === true) {
      return true;
    }
    const existing = await this.getAll<ProductItem>('products');
    return existing.length > 0;
  }

  async getAllProducts(): Promise<ProductItem[]> {
    if (!this.isIndexedDbSupported()) {
      const legacy = await this.readLegacyCatalog();
      return legacy?.products ?? [];
    }

    await this.ensureReady();
    const products = await this.getAll<ProductItem>('products');
    // Orden descendente por id o inserción reciente manteniendo consistencia.
    return products;
  }

  async replaceAllProducts(products: ProductItem[]): Promise<void> {
    const nowIso = new Date().toISOString();

    if (!this.isIndexedDbSupported()) {
      const state: PersistedCatalogState = {
        schemaVersion: 1,
        products,
        lastUpdatedAt: nowIso,
      };
      await Preferences.set({
        key: environment.storageKeys.catalog,
        value: JSON.stringify(state),
      });
      return;
    }

    await this.ensureReady();
    await this.replaceAllRecords('products', products);
    await this.putRecord<MetadataTableRow<boolean>>('metadata', {
      key: 'catalog_initialized',
      value: true,
      updatedAt: nowIso,
    });
  }

  async upsertProduct(product: ProductItem): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      const products = await this.getAllProducts();
      const exists = products.some(item => item.id === product.id);
      const updated = exists
        ? products.map(item => (item.id === product.id ? product : item))
        : [product, ...products];
      await this.replaceAllProducts(updated);
      return;
    }

    await this.ensureReady();
    await this.putRecord('products', product);
    await this.putRecord<MetadataTableRow<boolean>>('metadata', {
      key: 'catalog_initialized',
      value: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteProduct(productId: number): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      const products = await this.getAllProducts();
      await this.replaceAllProducts(products.filter(item => item.id !== productId));
      return;
    }

    await this.ensureReady();
    await this.deleteByKey('products', productId);
  }

  async clearProducts(): Promise<void> {
    await Preferences.remove({ key: environment.storageKeys.catalog });
    if (!this.isIndexedDbSupported()) {
      return;
    }
    await this.ensureReady();
    await this.clearStore('products');
    await this.deleteByKey('metadata', 'catalog_initialized');
  }

  // =========================================================================
  // TABLA: cart_items
  // =========================================================================

  async getAllCartItems(): Promise<CartLineItem[]> {
    if (!this.isIndexedDbSupported()) {
      const legacy = await this.readLegacyCart();
      return legacy?.items ?? [];
    }

    await this.ensureReady();
    return this.getAll<CartLineItem>('cart_items');
  }

  async replaceCartItems(items: CartLineItem[]): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      const state: PersistedCartState = {
        schemaVersion: 1,
        items,
      };
      await Preferences.set({
        key: environment.storageKeys.cart,
        value: JSON.stringify(state),
      });
      return;
    }

    await this.ensureReady();
    await this.replaceAllRecords('cart_items', items);
  }

  async clearCartItems(): Promise<void> {
    await Preferences.remove({ key: environment.storageKeys.cart });
    if (!this.isIndexedDbSupported()) {
      return;
    }
    await this.ensureReady();
    await this.clearStore('cart_items');
  }

  // =========================================================================
  // TABLA: orders
  // =========================================================================

  async hasOrdersBeenInitialized(): Promise<boolean> {
    if (!this.isIndexedDbSupported()) {
      const legacy = await this.readLegacyOrders();
      return legacy !== null;
    }

    await this.ensureReady();
    const meta = await this.getByKey<MetadataTableRow<boolean>>('metadata', 'orders_initialized');
    if (meta?.value === true) {
      return true;
    }
    const existing = await this.getAll<OrderRecord>('orders');
    return existing.length > 0;
  }

  async getAllOrders(): Promise<OrderRecord[]> {
    if (!this.isIndexedDbSupported()) {
      const legacy = await this.readLegacyOrders();
      return legacy?.orders ?? [];
    }

    await this.ensureReady();
    const orders = await this.getAll<OrderRecord>('orders');
    // Ordena las órdenes más recientes primero por `createdAt`.
    return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async replaceAllOrders(orders: OrderRecord[]): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      const state: PersistedOrdersState = {
        schemaVersion: 1,
        orders,
      };
      await Preferences.set({
        key: environment.storageKeys.orders,
        value: JSON.stringify(state),
      });
      return;
    }

    await this.ensureReady();
    await this.replaceAllRecords('orders', orders);
    await this.putRecord<MetadataTableRow<boolean>>('metadata', {
      key: 'orders_initialized',
      value: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async upsertOrder(order: OrderRecord): Promise<void> {
    if (!this.isIndexedDbSupported()) {
      const orders = await this.getAllOrders();
      const exists = orders.some(item => item.id === order.id);
      const updated = exists
        ? orders.map(item => (item.id === order.id ? order : item))
        : [order, ...orders];
      await this.replaceAllOrders(updated);
      return;
    }

    await this.ensureReady();
    await this.putRecord('orders', order);
    await this.putRecord<MetadataTableRow<boolean>>('metadata', {
      key: 'orders_initialized',
      value: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async clearOrders(): Promise<void> {
    await Preferences.remove({ key: environment.storageKeys.orders });
    if (!this.isIndexedDbSupported()) {
      return;
    }
    await this.ensureReady();
    await this.clearStore('orders');
    await this.deleteByKey('metadata', 'orders_initialized');
  }

  // =========================================================================
  // DIAGNÓSTICO DE BASE DE DATOS
  // =========================================================================

  async getDatabaseStats(): Promise<ShopperDatabaseStats> {
    const [users, products, cartItems, orders, session] = await Promise.all([
      this.getAllUsers(),
      this.getAllProducts(),
      this.getAllCartItems(),
      this.getAllOrders(),
      this.getSession(),
    ]);

    return {
      engine: this.isIndexedDbSupported() ? 'indexeddb' : 'preferences-fallback',
      dbName: this.databaseName,
      dbVersion: this.databaseVersion,
      usersCount: users.length,
      productsCount: products.length,
      cartItemsCount: cartItems.length,
      ordersCount: orders.length,
      hasActiveSession: session !== null,
    };
  }

  // =========================================================================
  // MOTOR INDEXEDDB DE BAJO NIVEL
  // =========================================================================

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.databaseName, this.databaseVersion);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }

        if (!db.objectStoreNames.contains('products')) {
          const productsStore = db.createObjectStore('products', { keyPath: 'id' });
          productsStore.createIndex('by_category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains('cart_items')) {
          db.createObjectStore('cart_items', { keyPath: 'productId' });
        }

        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
          ordersStore.createIndex('by_status', 'currentStatus', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error ?? new Error('No se pudo abrir la base de datos shopper_db.'));
      };
    });

    return this.dbPromise;
  }

  private async getAll<T>(storeName: ShopperStoreName): Promise<T[]> {
    const db = await this.openDatabase();
    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as T[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  private async getByKey<T>(storeName: ShopperStoreName, key: IDBValidKey): Promise<T | null> {
    const db = await this.openDatabase();
    return new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async putRecord<T>(storeName: ShopperStoreName, record: T): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async replaceAllRecords<T>(storeName: ShopperStoreName, records: T[]): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
      for (const record of records) {
        store.put(record);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async deleteByKey(storeName: ShopperStoreName, key: IDBValidKey): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async clearStore(storeName: ShopperStoreName): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // =========================================================================
  // INICIALIZACIÓN, SEMILLA DE USUARIOS Y MIGRACIÓN DESDE PREFERENCES LEGADO
  // =========================================================================

  private async initializeAndMigrate(): Promise<void> {
    await this.ensureDefaultUsersSeeded();

    const migratedFlag = await this.getByKey<MetadataTableRow<boolean>>(
      'metadata',
      'legacy_migrated'
    );
    if (migratedFlag?.value === true) {
      return;
    }

    const [legacySession, legacyCatalog, legacyCart, legacyOrders] = await Promise.all([
      this.readLegacySession(),
      this.readLegacyCatalog(),
      this.readLegacyCart(),
      this.readLegacyOrders(),
    ]);

    // Solo migra la sesión heredada si posee accessToken válido y no está vencida.
    if (legacySession && this.isLegacySessionUsable(legacySession)) {
      const existingSession = await this.getByKey<SessionTableRow>('session', 'current');
      if (!existingSession) {
        await this.putRecord<SessionTableRow>('session', { ...legacySession, id: 'current' });
      }
    }

    if (legacyCatalog && legacyCatalog.products.length > 0) {
      const existingProducts = await this.getAll<ProductItem>('products');
      if (existingProducts.length === 0) {
        await this.replaceAllRecords('products', legacyCatalog.products);
        await this.putRecord<MetadataTableRow<boolean>>('metadata', {
          key: 'catalog_initialized',
          value: true,
          updatedAt: legacyCatalog.lastUpdatedAt || new Date().toISOString(),
        });
      }
    }

    if (legacyCart && legacyCart.items.length > 0) {
      const existingCart = await this.getAll<CartLineItem>('cart_items');
      if (existingCart.length === 0) {
        await this.replaceAllRecords('cart_items', legacyCart.items);
      }
    }

    if (legacyOrders && legacyOrders.orders.length > 0) {
      const existingOrders = await this.getAll<OrderRecord>('orders');
      if (existingOrders.length === 0) {
        await this.replaceAllRecords('orders', legacyOrders.orders);
        await this.putRecord<MetadataTableRow<boolean>>('metadata', {
          key: 'orders_initialized',
          value: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Limpia claves heredadas de Preferences para que todo resida en shopper_db.
    await Promise.all([
      Preferences.remove({ key: environment.storageKeys.session }),
      Preferences.remove({ key: environment.storageKeys.catalog }),
      Preferences.remove({ key: environment.storageKeys.cart }),
      Preferences.remove({ key: environment.storageKeys.orders }),
    ]);

    await this.putRecord<MetadataTableRow<boolean>>('metadata', {
      key: 'legacy_migrated',
      value: true,
      updatedAt: new Date().toISOString(),
    });
  }

  private async ensureDefaultUsersSeeded(): Promise<void> {
    const existingUsers = await this.getAll<DatabaseUserRecord>('users');
    if (existingUsers.length > 0) {
      return;
    }

    for (const demoUser of this.createDefaultDemoUsers()) {
      await this.putRecord('users', demoUser);
    }
  }

  private createDefaultDemoUsers(): DatabaseUserRecord[] {
    const nowIso = new Date().toISOString();
    return [
      {
        username: environment.demoCredentials.customer.username,
        firstName: 'Emily',
        lastName: 'Johnson',
        role: 'customer',
        source: 'remote-api',
        lastLoginAt: nowIso,
      },
      {
        username: environment.demoCredentials.seller.username,
        firstName: 'Michael',
        lastName: 'Williams',
        role: 'seller',
        source: 'remote-api',
        lastLoginAt: nowIso,
      },
    ];
  }

  private isLegacySessionUsable(session: PersistedSessionRecord): boolean {
    if (!session.accessToken) {
      return false;
    }
    if (!session.expiresAt) {
      return true;
    }
    const expiresAtMs = Date.parse(session.expiresAt);
    return !Number.isNaN(expiresAtMs) && expiresAtMs > Date.now();
  }

  private async readLegacySession(): Promise<PersistedSessionRecord | null> {
    const { value } = await Preferences.get({ key: environment.storageKeys.session });
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as PersistedSessionRecord;
      return parsed.schemaVersion === 1 ? parsed : null;
    } catch {
      await Preferences.remove({ key: environment.storageKeys.session });
      return null;
    }
  }

  private async readLegacyCatalog(): Promise<PersistedCatalogState | null> {
    const { value } = await Preferences.get({ key: environment.storageKeys.catalog });
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as PersistedCatalogState;
      return parsed.schemaVersion === 1 && Array.isArray(parsed.products) ? parsed : null;
    } catch {
      await Preferences.remove({ key: environment.storageKeys.catalog });
      return null;
    }
  }

  private async readLegacyCart(): Promise<PersistedCartState | null> {
    const { value } = await Preferences.get({ key: environment.storageKeys.cart });
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as PersistedCartState;
      return parsed.schemaVersion === 1 && Array.isArray(parsed.items) ? parsed : null;
    } catch {
      await Preferences.remove({ key: environment.storageKeys.cart });
      return null;
    }
  }

  private async readLegacyOrders(): Promise<PersistedOrdersState | null> {
    const { value } = await Preferences.get({ key: environment.storageKeys.orders });
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as PersistedOrdersState;
      return parsed.schemaVersion === 1 && Array.isArray(parsed.orders) ? parsed : null;
    } catch {
      await Preferences.remove({ key: environment.storageKeys.orders });
      return null;
    }
  }
}
