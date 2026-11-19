/**
 * Servicio de pedidos para "App Shoper".
 *
 * Gestiona el estado reactivo de las órdenes, su persistencia en la tabla
 * `orders` de `ShopperDatabaseService` y la máquina de estados logísticos de
 * 4 pasos. El checkout descuenta stock vía `CatalogService` y vacía el
 * carrito vía `CartService`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { Injectable, inject, signal } from '@angular/core';

import type {
  CartLineItem,
  OrderRecord,
  OrderStatus,
  OrderStatusEntry,
} from '../models/shoper.model';
import { ORDER_STATUS_FLOW } from '../models/shoper.model';
import { CatalogService } from './catalog.service';
import { CartService } from './cart.service';
import { ShopperDatabaseService } from './database.service';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly catalogService = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly database = inject(ShopperDatabaseService);

  /**
   * Señal reactiva canónica con el listado de pedidos.
   */
  readonly ordersSignal = signal<OrderRecord[]>([]);

  /**
   * Hidrata las órdenes desde `shopper_db`. Si no existe un estado previo,
   * crea las dos órdenes semilla `#ORD-1001` y `#ORD-1002`.
   */
  async loadOrders(): Promise<void> {
    const initialized = await this.database.hasOrdersBeenInitialized();
    if (initialized) {
      const persistedOrders = await this.database.getAllOrders();
      this.ordersSignal.set(persistedOrders);
      return;
    }

    const seedOrders = this.createSeedOrders();
    this.ordersSignal.set(seedOrders);
    await this.database.replaceAllOrders(seedOrders);
  }

  /**
   * Convierte el carrito actual en una orden pagada y actualiza la BD.
   */
  async checkoutCart(cart?: CartLineItem[]): Promise<string> {
    const itemsToCheckout = cart && cart.length > 0 ? cart : this.cartService.cartItemsSignal();

    if (itemsToCheckout.length === 0) {
      throw new Error('El carrito está vacío; no se puede crear una orden.');
    }

    for (const item of itemsToCheckout) {
      await this.catalogService.decrementStock(item.productId, item.quantity);
    }

    const now = new Date().toISOString();
    const newOrderId = this.generateNextOrderId();

    const initialStatusEntry: OrderStatusEntry = {
      status: 'Pagado',
      timestamp: now,
      updatedBy: 'seller',
    };

    const newOrder: OrderRecord = {
      id: newOrderId,
      items: itemsToCheckout.map(item => ({ ...item })),
      totalAmount: itemsToCheckout.reduce((sum, item) => sum + item.price * item.quantity, 0),
      totalUnits: itemsToCheckout.reduce((sum, item) => sum + item.quantity, 0),
      currentStatus: 'Pagado',
      statusHistory: [initialStatusEntry],
      createdAt: now,
      paidAt: now,
    };

    this.ordersSignal.update(orders => [newOrder, ...orders]);
    await this.database.upsertOrder(newOrder);

    await this.cartService.clearCart();

    return newOrderId;
  }

  /**
   * Avanza el estado de una orden al siguiente paso del flujo logístico.
   */
  async advanceOrderStatus(orderId: string): Promise<void> {
    const order = this.ordersSignal().find(o => o.id === orderId);
    if (!order) {
      throw new Error(`No se encontró la orden ${orderId}.`);
    }

    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.currentStatus);
    const nextIndex = currentIndex + 1;

    if (currentIndex === -1 || nextIndex >= ORDER_STATUS_FLOW.length) {
      throw new Error(
        `No es posible avanzar la orden ${orderId} desde el estado "${order.currentStatus}".`
      );
    }

    const nextStatus: OrderStatus = ORDER_STATUS_FLOW[nextIndex];

    const newStatusEntry: OrderStatusEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      updatedBy: 'seller',
    };

    const updatedOrder: OrderRecord = {
      ...order,
      currentStatus: nextStatus,
      statusHistory: [...order.statusHistory, newStatusEntry],
    };

    this.ordersSignal.update(orders =>
      orders.map(o => (o.id === orderId ? updatedOrder : o))
    );

    await this.database.upsertOrder(updatedOrder);
  }

  /**
   * Elimina las órdenes persistidas y regenera las órdenes semilla.
   */
  async resetOrdersToSeed(): Promise<void> {
    await this.database.clearOrders();
    await this.loadOrders();
  }

  private createSeedOrders(): OrderRecord[] {
    const now = new Date().toISOString();

    const order1001: OrderRecord = {
      id: '#ORD-1001',
      items: [
        {
          productId: 101,
          title: 'Smartphone Demo X1',
          price: 299.99,
          quantity: 1,
          thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/iPhone%2013%20Pro/1.png',
        },
      ],
      totalAmount: 299.99,
      totalUnits: 1,
      currentStatus: 'En preparación',
      statusHistory: [
        {
          status: 'Pagado',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          updatedBy: 'seller',
        },
        {
          status: 'En preparación',
          timestamp: now,
          updatedBy: 'seller',
        },
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    };

    const order1002: OrderRecord = {
      id: '#ORD-1002',
      items: [
        {
          productId: 102,
          title: 'Auriculares Inalámbricos Pro',
          price: 89.5,
          quantity: 2,
          thumbnail:
            'https://cdn.dummyjson.com/products/images/mobile-accessories/Apple%20AirPods%20Max%20Silver/1.png',
        },
      ],
      totalAmount: 179,
      totalUnits: 2,
      currentStatus: 'En camino',
      statusHistory: [
        {
          status: 'Pagado',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          updatedBy: 'seller',
        },
        {
          status: 'En preparación',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
          updatedBy: 'seller',
        },
        {
          status: 'En camino',
          timestamp: now,
          updatedBy: 'seller',
        },
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    };

    return [order1001, order1002];
  }

  private generateNextOrderId(): string {
    const existingOrders = this.ordersSignal();
    if (existingOrders.length === 0) {
      return '#ORD-1003';
    }

    const numericIds = existingOrders
      .map(order => {
        const match = order.id.match(/\d+/);
        return match ? Number(match[0]) : 0;
      })
      .filter(number => !Number.isNaN(number));

    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 1002;
    return `#ORD-${maxId + 1}`;
  }
}
