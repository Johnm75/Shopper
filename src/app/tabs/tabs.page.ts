/**
 * Controlador del contenedor de pestañas bloqueado al rol autenticado.
 *
 * Adapta la barra inferior al rol con el que se inició sesión:
 * - Cliente (`customer`): Catálogo, Carrito (con badge), Mis compras y Usuario.
 * - Tienda (`seller`): Inventario, Pedidos (con badge) y Usuario.
 */

import { Component, computed, inject } from '@angular/core';
import type { ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  personCircleOutline,
  receiptOutline,
  storefrontOutline,
} from 'ionicons/icons';

import { JwtAuthenticationService } from '../services/auth-jwt.service';
import { CartService } from '../services/cart.service';
import { CatalogService } from '../services/catalog.service';
import { OrderService } from '../services/order.service';

/**
 * Orquesta las insignias reactivas y la hidratación inicial al ingresar a `/tabs`.
 */
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

  /** Rol activo bloqueado para la sesión actual (`customer` o `seller`). */
  readonly activeRole = this.authenticationService.activeRole;

  /** Cantidad total de unidades en el carrito para la insignia de `tab2`. */
  readonly cartUnits = this.cartService.totalUnits;

  /** Cantidad de pedidos activos (no entregados) para la insignia de `tab3`. */
  readonly activeOrdersCount = computed(
    () =>
      this.orderService.ordersSignal().filter(order => order.currentStatus !== 'Entregado')
        .length
  );

  constructor() {
    addIcons({
      cartOutline,
      personCircleOutline,
      receiptOutline,
      storefrontOutline,
    });
  }

  /**
   * Hidrata catálogo, pedidos y carrito (solo en rol Cliente) desde `shopper_db`.
   */
  ionViewWillEnter(): void {
    void this.catalogService.loadCatalog();
    void this.orderService.loadOrders();
    if (this.activeRole() === 'customer') {
      void this.cartService.loadCart();
    }
  }
}
