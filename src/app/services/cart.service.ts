/**
 * Servicio de carrito de compras para "App Shoper".
 *
 * Gestiona el estado reactivo del carrito, sus totales y su persistencia
 * transaccional en la tabla `cart_items` de `ShopperDatabaseService`.
 * Valida el stock disponible contra `CatalogService` antes de cada mutación.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import type { CartLineItem, ProductItem } from '../models/shoper.model';
import { CatalogService } from './catalog.service';
import { ShopperDatabaseService } from './database.service';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly catalogService = inject(CatalogService);
  private readonly database = inject(ShopperDatabaseService);

  /**
   * Señal reactiva canónica con las líneas del carrito.
   */
  readonly cartItemsSignal = signal<CartLineItem[]>([]);

  /**
   * Total de unidades acumuladas en el carrito.
   */
  readonly totalUnits = computed(() =>
    this.cartItemsSignal().reduce((sum, item) => sum + item.quantity, 0)
  );

  /**
   * Importe total calculado del carrito.
   */
  readonly totalAmount = computed(() =>
    this.cartItemsSignal().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  /**
   * Hidrata el carrito desde `shopper_db` (`cart_items`).
   */
  async loadCart(): Promise<void> {
    const items = await this.database.getAllCartItems();
    this.cartItemsSignal.set(items);
  }

  /**
   * Agrega un producto al carrito. Si ya existe, incrementa su cantidad.
   */
  async addProductToCart(product: ProductItem): Promise<void> {
    const existingItem = this.cartItemsSignal().find(item => item.productId === product.id);

    if (existingItem) {
      await this.incrementQuantity(product.id);
      return;
    }

    this.assertStockAvailable(product.id, 1);

    const newItem: CartLineItem = {
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: 1,
      thumbnail: product.thumbnail,
    };

    this.cartItemsSignal.update(items => [...items, newItem]);
    await this.database.replaceCartItems(this.cartItemsSignal());
  }

  /**
   * Incrementa en uno la cantidad de una línea del carrito.
   */
  async incrementQuantity(productId: number): Promise<void> {
    const item = this.cartItemsSignal().find(cartItem => cartItem.productId === productId);
    if (!item) {
      throw new Error(`El producto con id ${productId} no está en el carrito.`);
    }

    this.assertStockAvailable(productId, item.quantity + 1);

    this.cartItemsSignal.update(items =>
      items.map(cartItem =>
        cartItem.productId === productId
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      )
    );
    await this.database.replaceCartItems(this.cartItemsSignal());
  }

  /**
   * Decrementa en uno la cantidad de una línea del carrito.
   * Si el resultado es menor a 1, elimina la línea completa.
   */
  async decrementQuantity(productId: number): Promise<void> {
    const item = this.cartItemsSignal().find(cartItem => cartItem.productId === productId);
    if (!item) {
      return;
    }

    if (item.quantity <= 1) {
      await this.removeItemFromCart(productId);
      return;
    }

    this.cartItemsSignal.update(items =>
      items.map(cartItem =>
        cartItem.productId === productId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      )
    );
    await this.database.replaceCartItems(this.cartItemsSignal());
  }

  /**
   * Establece directamente la cantidad de una línea del carrito.
   */
  async updateItemQuantity(productId: number, quantity: number): Promise<void> {
    if (quantity < 1) {
      throw new Error('La cantidad debe ser al menos 1.');
    }

    const item = this.cartItemsSignal().find(cartItem => cartItem.productId === productId);
    if (!item) {
      throw new Error(`El producto con id ${productId} no está en el carrito.`);
    }

    this.assertStockAvailable(productId, quantity);

    this.cartItemsSignal.update(items =>
      items.map(cartItem =>
        cartItem.productId === productId ? { ...cartItem, quantity } : cartItem
      )
    );
    await this.database.replaceCartItems(this.cartItemsSignal());
  }

  /**
   * Elimina una línea completa del carrito.
   */
  async removeItemFromCart(productId: number): Promise<void> {
    this.cartItemsSignal.update(items =>
      items.filter(cartItem => cartItem.productId !== productId)
    );
    await this.database.replaceCartItems(this.cartItemsSignal());
  }

  /**
   * Vacía el carrito y limpia la tabla `cart_items` en la base de datos.
   */
  async clearCart(): Promise<void> {
    this.cartItemsSignal.set([]);
    await this.database.clearCartItems();
  }

  private assertStockAvailable(productId: number, desiredQuantity: number): void {
    const product = this.catalogService.productsSignal().find(p => p.id === productId);
    if (!product) {
      throw new Error(`El producto con id ${productId} no existe en el catálogo.`);
    }

    if (product.stock < desiredQuantity) {
      throw new Error(`Stock insuficiente para "${product.title}". Disponible: ${product.stock}.`);
    }
  }
}
