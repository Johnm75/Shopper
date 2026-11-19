/**
 * ===========================================================================
 * APP SHOPER — Pestaña 3: Mis Compras (Cliente) / Pedidos Activos y Cuenta
 * ===========================================================================
 * Propósito : Vista dual condicionada por el rol activo (`activeRole`):
 *             - Cliente: historial completo de compras con la línea de tiempo
 *               logística de 4 pasos (Pagado → En preparación → En camino →
 *               Entregado) y el detalle de `statusHistory` con timestamps
 *               ISO-8601 tal como los persiste `OrderService`.
 *             - Vendedor: cola de pedidos ACTIVOS (estado !== "Entregado") con
 *               botón para avanzar al siguiente estado válido de la máquina
 *               finita (`OrderService.advanceOrderStatus`), panel de sesión
 *               JWT enmascarada (solo los últimos 6 caracteres del token,
 *               SEC-002) y botón "Restablecer datos de demostración" que
 *               regenera órdenes semilla, catálogo base y carrito vacío.
 *             Los datos se refrescan en `ionViewWillEnter()` porque el
 *             `ion-router-outlet` de Ionic cachea las páginas en el DOM.
 * Fase SDD  : Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-019).
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-12
 * ===========================================================================
 */

import { Component, computed, inject, signal } from '@angular/core';
// Contrato de los botones del diálogo `ion-alert` (cerrar sesión / restablecer).
import type { AlertButton } from '@ionic/angular';
// Contratos de ciclo de vida de Ionic (refresco y anuncio accesible).
import type { ViewDidEnter, ViewWillEnter } from '@ionic/angular';
// Controlador de toasts: confirmación tras restablecer los datos demo.
import { ToastController } from '@ionic/angular';
// Registro explícito de los iconos usados en tarjetas, historial y paneles.
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowForwardCircleOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  receiptOutline,
  refreshOutline,
  timeOutline,
} from 'ionicons/icons';

import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
import type { OrderRecord, OrderStatus } from '../models/shoper.model';
import { ORDER_STATUS_FLOW } from '../models/shoper.model';
import { announcePageNavigation } from '../utils/a11y-announce.util';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements ViewWillEnter, ViewDidEnter {
  private readonly orderService = inject(OrderService);
  private readonly catalogService = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly authenticationService = inject(JwtAuthenticationService);
  private readonly toastController = inject(ToastController);

  /** Rol activo que decide qué vista se renderiza (señal del servicio). */
  readonly activeRole = this.authenticationService.activeRole;

  /** Listado reactivo completo de pedidos consumido por la vista Cliente. */
  readonly orders = this.orderService.ordersSignal;

  /**
   * Flujo canónico de los 4 estados logísticos (REQ-008). Se expone a la
   * plantilla para pintar la línea de tiempo en el orden correcto.
   */
  readonly orderStatusFlow: OrderStatus[] = ORDER_STATUS_FLOW;

  /** Cola del Vendedor: pedidos cuyo estado aún no es el final "Entregado". */
  readonly activeSellerOrders = computed(() =>
    this.orders().filter(order => order.currentStatus !== 'Entregado')
  );

  /** Archivo del Vendedor: pedidos ya entregados (ciclo logístico cerrado). */
  readonly deliveredSellerOrders = computed(() =>
    this.orders().filter(order => order.currentStatus === 'Entregado')
  );

  /** Bloquea la lista mientras se hidratan los pedidos desde storage. */
  readonly isLoadingOrders = signal<boolean>(false);

  /** Bloquea el botón de restablecimiento mientras se regenera la demo. */
  readonly isResettingDemoData = signal<boolean>(false);

  /** Mensaje de retroalimentación publicado en la región `aria-live`. */
  readonly actionMessage = signal<string>('');

  /** Semántica del mensaje ('success' | 'error') para el color del aviso. */
  readonly actionMessageType = signal<'success' | 'error'>('success');

  /**
   * Botones del diálogo de confirmación del restablecimiento demo: acción
   * destructiva porque sobrescribe órdenes, catálogo y carrito locales.
   */
  readonly resetConfirmationButtons: AlertButton[] = [
    { text: 'Cancelar', role: 'cancel' },
    {
      text: 'Restablecer',
      role: 'destructive',
      handler: () => {
        void this.resetDemoData();
      },
    },
  ];

  /**
   * Registra únicamente los iconos empleados por esta vista (tree-shaking).
   */
  constructor() {
    addIcons({
      alertCircleOutline,
      arrowForwardCircleOutline,
      checkmarkCircleOutline,
      checkmarkOutline,
      receiptOutline,
      refreshOutline,
      timeOutline,
    });
  }

  /**
   * Ciclo de vida Ionic: en CADA entrada a la pestaña se rehidratan las
   * órdenes desde `@capacitor/preferences` (o se generan las dos semillas
   * `#ORD-1001` y `#ORD-1002` en el primer arranque) para que el seguimiento
   * refleje el estado persistido más reciente (PAT-001).
   */
  ionViewWillEnter(): void {
    void this.refreshOrders();
  }

  /**
   * Ciclo de vida Ionic: anuncia la vista al lector de pantalla y traslada
   * el foco accesible al encabezado de la sección principal.
   */
  ionViewDidEnter(): void {
    announcePageNavigation('Pedidos — App Shoper', 'tab3-title');
  }

  /**
   * Hidrata los pedidos con indicador de progreso y tolerancia a fallos.
   */
  async refreshOrders(): Promise<void> {
    this.isLoadingOrders.set(true);
    try {
      await this.orderService.loadOrders();
    } finally {
      // Libera el spinner incluso si la lectura del almacenamiento falla.
      this.isLoadingOrders.set(false);
    }
  }

  /**
   * Índice (0-3) del estado actual del pedido dentro del flujo canónico;
   * sirve para marcar los pasos completados/activo de la línea de tiempo.
   *
   * @param order Pedido consultado.
   */
  currentStepIndex(order: OrderRecord): number {
    return ORDER_STATUS_FLOW.indexOf(order.currentStatus);
  }

  /**
   * Mapa de clases CSS de un paso de la línea de tiempo (estructura definida
   * en `global.scss` §10): `--completed` para los pasos ya superados,
   * `--active` para el estado presente y la insignia del estado (`badge-*`)
   * combinada con `--active` para teñir el punto con el color semántico.
   *
   * @param order Pedido dueño de la línea de tiempo.
   * @param stepIndex Índice del paso evaluado (0-3).
   */
  stepClasses(order: OrderRecord, stepIndex: number): Record<string, boolean> {
    const currentIndex = this.currentStepIndex(order);
    const isActive = stepIndex === currentIndex;
    return {
      'shoper-timeline-step--completed': stepIndex < currentIndex,
      'shoper-timeline-step--active': isActive,
      // La clase de estado solo se combina con el paso ACTIVO (ver global.scss).
      'badge-paid': isActive && order.currentStatus === 'Pagado',
      'badge-preparing': isActive && order.currentStatus === 'En preparación',
      'badge-shipping': isActive && order.currentStatus === 'En camino',
      'badge-delivered': isActive && order.currentStatus === 'Entregado',
    };
  }

  /**
   * Clase de insignia correspondiente a un estado logístico; se usa en la
   * cabecera de cada tarjeta de pedido (refuerzo textual del color).
   *
   * @param status Estado logístico del pedido.
   */
  badgeClassForStatus(status: OrderStatus): string {
    switch (status) {
      case 'Pagado':
        return 'badge-paid';
      case 'En preparación':
        return 'badge-preparing';
      case 'En camino':
        return 'badge-shipping';
      case 'Entregado':
        return 'badge-delivered';
    }
  }

  /**
   * Siguiente estado válido del pedido según la máquina finita de estados
   * (REQ-008); devuelve `null` cuando el pedido ya está "Entregado".
   *
   * @param order Pedido consultado.
   */
  nextStatusFor(order: OrderRecord): OrderStatus | null {
    const nextIndex = this.currentStepIndex(order) + 1;
    return nextIndex < ORDER_STATUS_FLOW.length ? ORDER_STATUS_FLOW[nextIndex] : null;
  }

  /**
   * Acción del Vendedor: avanza el pedido al siguiente estado válido.
   * `OrderService` vuelve a validar la transición y registra la entrada
   * `{ status, timestamp, updatedBy: 'seller' }` en `statusHistory`.
   *
   * @param order Pedido que se va a avanzar.
   */
  async advanceOrder(order: OrderRecord): Promise<void> {
    const nextStatus = this.nextStatusFor(order);
    if (nextStatus === null) {
      // Protección defensiva: el botón ya se oculta en pedidos entregados.
      this.announceAction(`El pedido ${order.id} ya está entregado.`, 'error');
      return;
    }

    try {
      await this.orderService.advanceOrderStatus(order.id);
      this.announceAction(
        `Pedido ${order.id} avanzado a "${nextStatus}". El cliente ya ve el cambio en Mis compras.`,
        'success'
      );
    } catch (transitionError) {
      // Error típico: transición inválida o pedido inexistente.
      this.announceAction(this.describeError(transitionError), 'error');
    }
  }

  /**
   * Acción del Vendedor: restablece TODOS los datos de demostración —
   * órdenes semilla (`#ORD-1001`/`#ORD-1002`), catálogo base de la API y
   * carrito vacío — para repetir la demo desde un estado conocido.
   */
  async resetDemoData(): Promise<void> {
    // Protección contra dobles pulsaciones del diálogo/botón.
    if (this.isResettingDemoData()) {
      return;
    }

    this.isResettingDemoData.set(true);
    try {
      // Orden deliberado: primero las órdenes (no dependen de nada), luego el
      // catálogo (recarga API/semilla) y por último el carrito (independiente).
      await this.orderService.resetOrdersToSeed();
      await this.catalogService.resetCatalogToDefault();
      await this.cartService.clearCart();

      this.announceAction(
        'Datos de demostración restablecidos: órdenes semilla, catálogo base y carrito vacío.',
        'success'
      );
      await this.presentResetToast();
    } catch (resetError) {
      this.announceAction(this.describeError(resetError), 'error');
    } finally {
      // Libera el bloqueo tanto en éxito como en error.
      this.isResettingDemoData.set(false);
    }
  }

  /**
   * Formatea una marca ISO-8601 a fecha/hora legible en español; el valor
   * ISO crudo también se muestra junto a este para evidencia académica.
   *
   * @param isoTimestamp Marca temporal ISO-8601 persistida por el servicio.
   */
  formatIsoDateTime(isoTimestamp: string): string {
    const parsedDate = new Date(isoTimestamp);
    // Si la marca no es parseable, devuelve el texto original sin transformar.
    if (Number.isNaN(parsedDate.getTime())) {
      return isoTimestamp;
    }
    return parsedDate.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Presenta el toast de confirmación del restablecimiento de la demo.
   */
  private async presentResetToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Demo restablecida: 2 órdenes semilla, catálogo base y carrito vacío.',
      duration: 3500,
      position: 'top',
      color: 'success',
      icon: 'refresh-outline',
      htmlAttributes: { 'aria-label': 'Confirmación de datos restablecidos' },
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
   * @param error Error capturado en las operaciones de pedidos.
   */
  private describeError(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Ocurrió un error inesperado al gestionar los pedidos.';
  }
}
