/**
 * Pruebas unitarias de `ShopperDatabaseService`.
 *
 * Valida operaciones CRUD en tablas de productos, carrito, órdenes, sesión
 * y estadísticas de la base de datos local `shopper_db`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { ShopperDatabaseService } from './database.service';
import type { OrderRecord, PersistedSessionRecord, ProductItem } from '../models/shoper.model';

describe('ShopperDatabaseService', () => {
  let databaseService: ShopperDatabaseService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
    await Preferences.clear();

    TestBed.configureTestingModule({
      providers: [ShopperDatabaseService],
    });
    databaseService = TestBed.inject(ShopperDatabaseService);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('debe persistir y recuperar productos, carrito, órdenes y sesión con estadísticas reales', async () => {
    const product: ProductItem = {
      id: 500,
      title: 'Teclado Mecánico',
      price: 79.99,
      stock: 15,
      category: 'peripherals',
      thumbnail: 'https://img/kb.png',
    };
    const session: PersistedSessionRecord = {
      accessToken: 'jwt-123456',
      refreshToken: 'ref-123456',
      username: 'michaelw',
      firstName: 'Michael',
      lastName: 'W',
      role: 'seller',
      source: 'remote-api',
      schemaVersion: 1,
    };
    const order: OrderRecord = {
      id: '#ORD-9001',
      items: [{ productId: 500, title: 'Teclado Mecánico', price: 79.99, quantity: 1, thumbnail: 'https://img/kb.png' }],
      totalAmount: 79.99,
      totalUnits: 1,
      currentStatus: 'Pagado',
      statusHistory: [{ status: 'Pagado', timestamp: '2026-11-18T00:00:00.000Z', updatedBy: 'seller' }],
      createdAt: '2026-11-18T00:00:00.000Z',
    };

    await databaseService.replaceAllProducts([product]);
    await databaseService.replaceCartItems([{ productId: 500, title: 'Teclado Mecánico', price: 79.99, quantity: 2, thumbnail: 'https://img/kb.png' }]);
    await databaseService.replaceAllOrders([order]);
    await databaseService.saveSession(session);

    await databaseService.upsertUser({
      username: 'michaelw',
      firstName: 'Michael',
      lastName: 'Williams',
      role: 'seller',
      source: 'remote-api',
      lastLoginAt: '2026-11-18T00:00:00.000Z',
    });

    const stats = await databaseService.getDatabaseStats();
    expect(stats.dbName).toBe('shopper_db');
    expect(stats.usersCount).toBeGreaterThanOrEqual(1);
    expect(stats.productsCount).toBe(1);
    expect(stats.cartItemsCount).toBe(1);
    expect(stats.ordersCount).toBe(1);
    expect(stats.hasActiveSession).toBe(true);

    const savedUser = await databaseService.getUserByUsername('michaelw');
    expect(savedUser?.role).toBe('seller');

    await databaseService.deleteProduct(500);
    expect((await databaseService.getAllProducts()).length).toBe(0);
  });
});
