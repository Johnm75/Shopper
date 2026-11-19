/**
 * ===========================================================================
 * APP SHOPER — Pestaña 4: Usuario, Token JWT y Cierre de Sesión (`Tab4Page`)
 * ===========================================================================
 * Propósito : Pantalla dedicada exclusivamente a la cuenta autenticada (tanto
 *             para el rol Cliente como para el rol Tienda):
 *             - Datos de identidad del usuario y resumen contextual de su rol.
 *             - Inspección del token JWT (enmascarado por defecto, con opción
 *               para mostrar/ocultar o copiar), origen y vigencia restante.
 *             - Estado de la base de datos local `shopper_db`.
 *             - Cierre de sesión con diálogo de confirmación `ion-alert`.
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-18
 * ===========================================================================
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

  /** Sesión activa del usuario autenticado (`customer` o `seller`). */
  readonly sessionSignal = this.authenticationService.sessionSignal;

  /** Rol activo fijo de la sesión actual. */
  readonly activeRole = this.authenticationService.activeRole;

  /** Vista enmascarada del token (primeros 10 y últimos 4 caracteres). */
  readonly maskedTokenPreview = this.authenticationService.maskedTokenPreview;

  /** Minutos restantes hasta la expiración del token JWT. */
  readonly remainingSessionMinutes = this.authenticationService.remainingSessionMinutes;

  /** Controla si el usuario solicitó ver el token JWT completo en pantalla. */
  readonly isTokenVisible = signal<boolean>(false);

  /** Mensaje de estado para la región accesible (`aria-live`). */
  readonly statusMessage = signal<string>('');

  /** Estadísticas en vivo de la base de datos local `shopper_db`. */
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

  /** Descripción de capacidades vinculadas al rol del usuario. */
  readonly roleDescription = computed(() =>
    this.activeRole() === 'customer'
      ? 'Cuenta compradora: acceso al catálogo, carrito de compras y seguimiento de tus pedidos.'
      : 'Cuenta vendedora: acceso a gestión de inventario, avance de pedidos y control de la tienda.'
  );

  /** Etiqueta legible del origen del token JWT. */
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

  /** Unidades actuales en carrito (para resumen de rol Cliente). */
  readonly cartUnits = this.cartService.totalUnits;

  /** Total de productos en catálogo/inventario. */
  readonly catalogCount = computed(() => this.catalogService.productsSignal().length);

  /** Total de pedidos registrados. */
  readonly totalOrdersCount = computed(() => this.orderService.ordersSignal().length);

  /** Cantidad de pedidos activos (no entregados). */
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

  ionViewWillEnter(): void {
    this.isTokenVisible.set(false);
    this.statusMessage.set('');
    void this.refreshDatabaseStats();
  }

  ionViewDidEnter(): void {
    announcePageNavigation('Usuario — App Shoper', 'tab4-title');
  }

  /**
   * Alterna la visibilidad completa del token JWT para inspección manual.
   */
  toggleTokenVisibility(): void {
    this.isTokenVisible.update(visible => !visible);
  }

  /**
   * Copia el token JWT activo al portapapeles cuando el navegador/WebView lo soporta.
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
      // Si falla el acceso al portapapeles, informa al usuario que puede verlo manualmente.
    }

    this.isTokenVisible.set(true);
    this.statusMessage.set('Mostrando el token completo para copiarlo manualmente.');
  }

  /**
   * Formatea una fecha ISO-8601 de expiración en formato legible local.
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
   * Ejecuta el cierre de sesión limpiando storage, señal y navegando a `/login`.
   */
  confirmSignOut(): void {
    void this.authenticationService.signOutSession();
  }

  private async refreshDatabaseStats(): Promise<void> {
    if (typeof this.databaseService?.getDatabaseStats === 'function') {
      const stats = await this.databaseService.getDatabaseStats();
      this.databaseStats.set(stats);
    }
  }
}
