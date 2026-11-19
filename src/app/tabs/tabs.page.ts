/**
 * ===========================================================================
 * APP SHOPER — Contenedor de pestañas bloqueado al rol de ingreso
 * ===========================================================================
 * Propósito : Alojar la navegación inferior correspondiente ÚNICAMENTE al rol
 *             con el que el usuario inició sesión:
 *             - Cliente (`customer`): Catálogo, Carrito (con badge) y Mis compras.
 *             - Tienda (`seller`): Inventario y Pedidos (sin Carrito ni
 *               conmutador simultáneo entre vistas).
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-18
 * ===========================================================================
 */

import { Component, computed, inject } from '@angular/core';
import type { ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  briefcaseOutline,
  cartOutline,
  personOutline,
  receiptOutline,
  storefrontOutline,
} from 'ionicons/icons';

import { JwtAuthenticationService } from '../services/auth-jwt.service';
import { CartService } from '../services/cart.service';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements ViewWillEnter {
  private readonly authenticationService = inject(JwtAuthenticationService);
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly catalogService = inject(CatalogService);

  /** Rol activo fijo para la sesión ingresada ('customer' | 'seller'). */
  readonly activeRole = this.authenticationService.activeRole;

  /** Nombre visible del usuario autenticado para el saludo del encabezado. */
  readonly displayName = computed(
    () => this.authenticationService.sessionSignal()?.firstName ?? ''
  );

  /** Etiqueta de solo lectura del modo activo según la cuenta ingresada. */
  readonly activeRoleLabel = computed(() =>
    this.activeRole() === 'customer' ? 'Cliente' : 'Tienda'
  );

  /** Insignia de tab2: unidades totales del carrito (`totalUnits`). */
  readonly cartUnits = this.cartService.totalUnits;

  /** Insignia de tab3: número de pedidos activos (no entregados). */
  readonly activeOrdersCount = computed(
    () =>
      this.orderService.ordersSignal().filter(order => order.currentStatus !== 'Entregado')
        .length
  );

  constructor() {
    addIcons({
      briefcaseOutline,
      cartOutline,
      personOutline,
      receiptOutline,
      storefrontOutline,
    });
  }

  /**
   * Hidrata catálogo, pedidos y carrito (solo en modo Cliente) desde
   * `shopper_db` en cada entrada al contenedor de pestañas.
   */
  ionViewWillEnter(): void {
    void this.catalogService.loadCatalog();
    void this.orderService.loadOrders();
    if (this.activeRole() === 'customer') {
      void this.cartService.loadCart();
    }
  }
}
