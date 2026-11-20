/**
 * Controlador de la pestaña 4: Perfil de usuario, inspección del token JWT y cierre de sesión.
 */

import { Component, computed, inject, signal } from '@angular/core';
import type { AlertButton, ViewDidEnter, ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  briefcaseOutline,
  cartOutline,
  checkmarkCircleOutline,
  copyOutline,
  eyeOffOutline,
  eyeOutline,
  keyOutline,
  logOutOutline,
  personOutline,
  receiptOutline,
  serverOutline,
  shieldCheckmarkOutline,
  storefrontOutline,
  timeOutline,
} from 'ionicons/icons';

import { JwtAuthenticationService } from '../services/auth-jwt.service';
import { CartService } from '../services/cart.service';
import { CatalogService } from '../services/catalog.service';
import {
  ShopperDatabaseService,
  type ShopperDatabaseStats,
} from '../services/database.service';
import { OrderService } from '../services/order.service';
import { announcePageNavigation } from '../utils/a11y-announce.util';

/**
 * Presenta la identidad de la cuenta activa (Cliente o Tienda), estado de `shopper_db` y salida de sesión.
 */
@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page implements ViewWillEnter, ViewDidEnter {
  private readonly authenticationService = inject(JwtAuthenticationService);
  private readonly catalogService = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly databaseService = inject(ShopperDatabaseService);

  /** Sesión JWT activa (`customer` o `seller`). */
  readonly sessionSignal = this.authenticationService.sessionSignal;

  /** Rol activo fijo de la sesión actual. */
  readonly activeRole = this.authenticationService.activeRole;

  /** Vista enmascarada del token JWT activo. */
  readonly maskedTokenPreview = this.authenticationService.maskedTokenPreview;

  /** Minutos restantes hasta la expiración del token. */
  readonly remainingSessionMinutes = this.authenticationService.remainingSessionMinutes;

  /** Controla si se muestra el token JWT completo en pantalla. */
  readonly isTokenVisible = signal<boolean>(false);

  /** Mensaje de estado para la región `aria-live`. */
  readonly statusMessage = signal<string>('');

  /** Estadísticas en vivo de las tablas en `shopper_db`. */
  readonly databaseStats = signal<ShopperDatabaseStats | null>(null);

  /** Nombre completo del usuario autenticado. */
  readonly fullName = computed(() => {
    const session = this.sessionSignal();
    if (!session) {
      return 'Usuario sin sesión';
    }
    const combined = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim();
    return combined || session.username;
  });

  /** Etiqueta legible del rol activo. */
  readonly activeRoleLabel = computed(() =>
    this.activeRole() === 'customer' ? 'Cliente' : 'Tienda'
  );

  /** Descripción de capacidades según el rol autenticado. */
  readonly roleDescription = computed(() =>
    this.activeRole() === 'customer'
      ? 'Cuenta compradora: acceso al catálogo, carrito de compras y seguimiento de tus pedidos.'
      : 'Cuenta vendedora: acceso a gestión de inventario, avance de pedidos y control de la tienda.'
  );

  /** Etiqueta legible del origen del token activo. */
  readonly tokenSourceLabel = computed(() => {
    const source = this.sessionSignal()?.source;
    if (source === 'remote-api') {
      return 'API remota (DummyJSON)';
    }
    if (source === 'offline-fallback') {
      return 'Token local offline';
    }
    return 'Sin sesión activa';
  });

  /** Unidades actuales en carrito para el resumen de Cliente. */
  readonly cartUnits = this.cartService.totalUnits;

  /** Total de productos en catálogo o inventario. */
  readonly catalogCount = computed(() => this.catalogService.productsSignal().length);

  /** Total de pedidos registrados en la cuenta. */
  readonly totalOrdersCount = computed(() => this.orderService.ordersSignal().length);

  /** Cantidad de pedidos aún no entregados. */
  readonly activeOrdersCount = computed(
    () =>
      this.orderService.ordersSignal().filter(order => order.currentStatus !== 'Entregado')
        .length
  );

  /** Botones del diálogo de confirmación previo al cierre de sesión. */
  readonly signOutConfirmationButtons: AlertButton[] = [
    { text: 'Cancelar', role: 'cancel' },
    {
      text: 'Cerrar sesión',
      role: 'destructive',
      handler: () => {
        this.confirmSignOut();
      },
    },
  ];

  /**
   * Registra los iconos utilizados en la vista de cuenta y diagnóstico.
   */
  constructor() {
    addIcons({
      briefcaseOutline,
      cartOutline,
      checkmarkCircleOutline,
      copyOutline,
      eyeOffOutline,
      eyeOutline,
      keyOutline,
      logOutOutline,
      personOutline,
      receiptOutline,
      serverOutline,
      shieldCheckmarkOutline,
      storefrontOutline,
      timeOutline,
    });
  }

  /**
   * Oculta el token completo, limpia mensajes y refresca estadísticas de `shopper_db`.
   */
  ionViewWillEnter(): void {
    this.isTokenVisible.set(false);
    this.statusMessage.set('');
    void this.refreshDatabaseStats();
  }

  /**
   * Anuncia la vista al lector de pantalla y ubica el foco en el encabezado principal.
   */
  ionViewDidEnter(): void {
    announcePageNavigation('Usuario — App Shoper', 'tab4-title');
  }

  /**
   * Alterna la visibilidad completa del token JWT en pantalla.
   */
  toggleTokenVisibility(): void {
    this.isTokenVisible.update(visible => !visible);
  }

  /**
   * Copia el token JWT activo al portapapeles o lo muestra en pantalla si el entorno lo restringe.
   */
  async copyAccessToken(): Promise<void> {
    const token = this.sessionSignal()?.accessToken;
    if (!token) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
        this.statusMessage.set('Token JWT copiado al portapapeles.');
        return;
      }
    } catch {
      // Si el portapapeles falla, expone el token en pantalla para copia manual.
    }

    this.isTokenVisible.set(true);
    this.statusMessage.set('Mostrando el token completo para copiarlo manualmente.');
  }

  /**
   * Formatea la fecha de expiración ISO-8601 a formato local legible.
   *
   * @param isoTimestamp Marca temporal ISO-8601 de expiración.
   * @returns Fecha formateada o texto descriptivo si falta o es inválida.
   */
  formatExpirationDate(isoTimestamp?: string): string {
    if (!isoTimestamp) {
      return 'Sin expiración definida';
    }
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      return isoTimestamp;
    }
    return parsed.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Ejecuta el cierre de sesión limpiando storage, estado reactivo y navegando a `/login`.
   */
  confirmSignOut(): void {
    void this.authenticationService.signOutSession();
  }

  /**
   * Consulta las métricas actuales de tablas en `ShopperDatabaseService`.
   */
  private async refreshDatabaseStats(): Promise<void> {
    if (typeof this.databaseService?.getDatabaseStats === 'function') {
      const stats = await this.databaseService.getDatabaseStats();
      this.databaseStats.set(stats);
    }
  }
}
