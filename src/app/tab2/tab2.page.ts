/**
 * ===========================================================================
 * APP SHOPER — Pestaña 2: Carrito de compras y checkout demostrativo
 * ===========================================================================
 * Propósito : Listar las líneas del carrito con controles de cantidad
 *             (+ / − / eliminar), resumir `totalUnits` y `totalAmount` en una
 *             barra inferior adhesiva y ejecutar el checkout demostrativo que
 *             descuenta stock, crea la orden en estado "Pagado" y navega a
 *             `/tabs/tab3` para seguir el envío.
 *             ⚠️ SEC-002: el pago es simulado; la app NO solicita ni almacena
 *             PII financiera (tarjetas, cuentas bancarias, etc.).
 * Fase SDD  : Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-019).
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-12
 * ===========================================================================
 */

import { Component, inject, signal } from '@angular/core';
// Router de Angular para saltar a la pestaña de pedidos tras el pago.
import { Router } from '@angular/router';
// Contratos de ciclo de vida de Ionic (refresco y anuncio accesible).
import type { ViewDidEnter, ViewWillEnter } from '@ionic/angular';
// Controlador de toasts: confirmación persistente tras navegar a tab3.
import { ToastController } from '@ionic/angular';
// Registro explícito de iconos de la vista del carrito.
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  cardOutline,
  cartOutline,
  checkmarkCircleOutline,
  lockClosedOutline,
  removeOutline,
  trashOutline,
} from 'ionicons/icons';

// Servicio reactivo del carrito: líneas, totales y mutaciones validadas.
import { CartService } from '../services/cart.service';
// Servicio de pedidos: ejecuta el checkout y crea la orden en estado Pagado.
import { OrderService } from '../services/order.service';
// Servicio del catálogo: necesario para hidratar el stock ANTES de que el
// carrito valide incrementos (las mutaciones consultan `productsSignal`).
import { CatalogService } from '../services/catalog.service';
// Línea de carrito del dominio Shoper.
import type { CartLineItem } from '../models/shoper.model';
// Utilidad de anuncio accesible de navegación entre vistas.
import { announcePageNavigation } from '../utils/a11y-announce.util';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  // Página declarada por `Tab2PageModule` (arquitectura NgModule del proyecto).
  standalone: false,
})
export class Tab2Page implements ViewWillEnter, ViewDidEnter {
  // Motor reactivo del carrito persistido en `shoper.cart.v1`.
  private readonly cartService = inject(CartService);
  // Motor de pedidos que materializa el checkout demostrativo.
  private readonly orderService = inject(OrderService);
  // Motor del catálogo: garantiza stock hidratado para las validaciones.
  private readonly catalogService = inject(CatalogService);
  // Router para la navegación post-pago hacia la pestaña de seguimiento.
  private readonly router = inject(Router);
  // Controlador de toasts para la confirmación del pedido creado.
  private readonly toastController = inject(ToastController);

  /** Líneas del carrito enlazadas directamente a la señal del servicio. */
  readonly cartItems = this.cartService.cartItemsSignal;

  /** Unidades totales acumuladas (señal calculada del servicio). */
  readonly totalUnits = this.cartService.totalUnits;

  /** Importe total del carrito (señal calculada del servicio). */
  readonly totalAmount = this.cartService.totalAmount;

  /** Bloquea los controles mientras se hidrata el carrito persistido. */
  readonly isLoadingCart = signal<boolean>(false);

  /** Bloquea el botón "Pagar ahora" durante la creación de la orden. */
  readonly isCheckingOut = signal<boolean>(false);

  /** Mensaje de retroalimentación publicado en la región `aria-live`. */
  readonly actionMessage = signal<string>('');

  /** Semántica del mensaje ('success' | 'error') para el color del aviso. */
  readonly actionMessageType = signal<'success' | 'error'>('success');

  /**
   * Registra los iconos utilizados por los controles del carrito.
   */
  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      cardOutline,
      cartOutline,
      checkmarkCircleOutline,
      lockClosedOutline,
      removeOutline,
      trashOutline,
    });
  }

  /**
   * Ciclo de vida Ionic: en cada entrada a la pestaña se rehidrata el carrito
   * desde `@capacitor/preferences`; también se hidrata el catálogo porque las
   * validaciones de stock de `CartService` consultan `productsSignal`.
   */
  ionViewWillEnter(): void {
    void this.refreshCartData();
  }

  /**
   * Ciclo de vida Ionic: anuncia la vista y traslada el foco al encabezado.
   */
  ionViewDidEnter(): void {
    announcePageNavigation('Carrito — App Shoper', 'tab2-title');
  }

  /**
   * Hidrata catálogo + carrito en paralelo con indicador de progreso.
   * El catálogo primero es imprescindible para que los incrementos de
   * cantidad puedan validar el stock disponible.
   */
  async refreshCartData(): Promise<void> {
    this.isLoadingCart.set(true);
    try {
      await Promise.all([
        this.catalogService.loadCatalog(),
        this.cartService.loadCart(),
      ]);
    } finally {
      // Libera el spinner incluso ante errores de lectura del almacenamiento.
      this.isLoadingCart.set(false);
    }
  }

  /**
   * Incrementa en uno la cantidad de una línea; el servicio valida stock.
   *
   * @param item Línea del carrito afectada.
   */
  async incrementQuantity(item: CartLineItem): Promise<void> {
    try {
      await this.cartService.incrementQuantity(item.productId);
      this.announceAction(`Cantidad de "${item.title}" aumentada a ${item.quantity + 1}.`, 'success');
    } catch (stockError) {
      this.announceAction(this.describeError(stockError), 'error');
    }
  }

  /**
   * Decrementa en uno la cantidad; si llegaría a cero, el servicio elimina
   * la línea completa del carrito.
   *
   * @param item Línea del carrito afectada.
   */
  async decrementQuantity(item: CartLineItem): Promise<void> {
    await this.cartService.decrementQuantity(item.productId);
    this.announceAction(
      item.quantity <= 1
        ? `"${item.title}" se eliminó del carrito (cantidad mínima alcanzada).`
        : `Cantidad de "${item.title}" reducida a ${item.quantity - 1}.`,
      'success'
    );
  }

  /**
   * Elimina por completo una línea del carrito.
   *
   * @param item Línea del carrito afectada.
   */
  async removeItem(item: CartLineItem): Promise<void> {
    await this.cartService.removeItemFromCart(item.productId);
    this.announceAction(`"${item.title}" eliminado del carrito.`, 'success');
  }

  /**
   * Checkout demostrativo (REQ-006): descuenta stock, crea la orden en estado
   * "Pagado", vacía el carrito y navega a `/tabs/tab3` para el seguimiento.
   * No se solicita ningún dato financiero real (SEC-002).
   */
  async checkout(): Promise<void> {
    // Protección contra doble pulsación del botón de pago.
    if (this.isCheckingOut() || this.cartItems().length === 0) {
      return;
    }

    this.isCheckingOut.set(true);
    try {
      // `checkoutCart()` devuelve el identificador de la orden recién creada.
      const newOrderId = await this.orderService.checkoutCart();

      // Confirmación persistente (sobrevive a la navegación entre pestañas).
      await this.presentCheckoutToast(newOrderId);

      // Salto a "Mis Compras / Pedidos" donde la orden ya aparece en "Pagado".
      await this.router.navigateByUrl('/tabs/tab3');
    } catch (checkoutError) {
      // Error típico: stock insuficiente tras vaciado del catálogo.
      this.announceAction(this.describeError(checkoutError), 'error');
    } finally {
      this.isCheckingOut.set(false);
    }
  }

  /**
   * Presenta el toast de confirmación con el identificador de la orden.
   *
   * @param orderId Identificador generado (p. ej. `#ORD-1003`).
   */
  private async presentCheckoutToast(orderId: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `Pedido ${orderId} creado y pagado (simulación). Síguelo en "Pedidos".`,
      duration: 3500,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle-outline',
      htmlAttributes: { 'aria-label': 'Confirmación de pedido creado' },
    });
    await toast.present();
  }

  /**
   * Publica un mensaje en la región accesible `aria-live="polite"`.
   *
   * @param message Texto anunciado al usuario.
   * @param type Semántica del mensaje ('success' | 'error').
   */
  private announceAction(message: string, type: 'success' | 'error'): void {
    this.actionMessageType.set(type);
    this.actionMessage.set(message);
  }

  /**
   * Normaliza errores desconocidos a texto legible para la región live.
   *
   * @param error Error capturado en las operaciones del carrito.
   */
  private describeError(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Ocurrió un error inesperado al modificar el carrito.';
  }
}
