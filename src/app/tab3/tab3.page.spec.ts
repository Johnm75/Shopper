/**
 * Pruebas unitarias de `Tab3Page` (Fase 6 SDD — TASK-021).
 *
 * Valida el renderizado sin errores, la conmutación reactiva entre vistas de
 * Cliente y Vendedor, la presencia de atributos de accesibilidad y la
 * delegación de acciones a los servicios inyectados.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para instanciar el componente.
import { ComponentFixture, TestBed } from '@angular/core/testing';
// Primitivas reactivas y esquema para simular estado y tolerar web components de Ionic.
import { CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
// Proveedor de router requerido por la plantilla.
import { provideRouter } from '@angular/router';
// (No se requiere un módulo global adicional: Tab3PageModule declara los componentes Ionic.)
// Controlador de toasts de Ionic inyectado por la página.
import { ToastController } from '@ionic/angular';

// Módulo y componente bajo prueba.
import { Tab3PageModule } from './tab3.module';
import { Tab3Page } from './tab3.page';
// Servicios que la página consume y que se simulan en las pruebas.
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Tipos de dominio necesarios para construir pedidos y sesión simulados.
import type { OrderRecord, PersistedSessionRecord, UserRole } from '../models/shoper.model';

// Suite de pruebas de la pestaña de pedidos/cuenta.
describe('Tab3Page', () => {
  // Instancia del componente bajo prueba.
  let component: Tab3Page;
  // Fixture para consultar el DOM renderizado.
  let fixture: ComponentFixture<Tab3Page>;
  // Señales simuladas de rol, órdenes y sesión.
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;
  let ordersSignal: ReturnType<typeof signal<OrderRecord[]>>;
  let sessionSignal: ReturnType<typeof signal<PersistedSessionRecord | null>>;
  // Espía para verificar el avance de estado de pedidos.
  let advanceOrderStatusSpy: ReturnType<typeof vi.fn>;

  // Pedido de ejemplo en estado intermedio para la vista de vendedor.
  const sampleOrder: OrderRecord = {
    id: '#ORD-2001',
    items: [{ productId: 1, title: 'Demo', price: 10, quantity: 1, thumbnail: 'https://img/d.png' }],
    totalAmount: 10,
    totalUnits: 1,
    currentStatus: 'Pagado',
    statusHistory: [{ status: 'Pagado', timestamp: '2026-11-12T10:00:00.000Z', updatedBy: 'seller' }],
    createdAt: '2026-11-12T10:00:00.000Z',
    paidAt: '2026-11-12T10:00:00.000Z',
  };

  // Sesión simulada con token para el panel JWT del vendedor.
  const demoSession: PersistedSessionRecord = {
    accessToken: 'header.payload.signature123',
    refreshToken: 'refresh',
    username: 'michaelw',
    firstName: 'Michael',
    lastName: 'W',
    role: 'seller',
    source: 'remote-api',
    schemaVersion: 1,
  };

  // Configura el entorno con dobles controlados antes de cada caso.
  beforeEach(async () => {
    // Restablece el TestBed para aislar el escenario.
    TestBed.resetTestingModule();
    // Inicializa señales con valores deterministas.
    activeRoleSignal = signal<UserRole>('customer');
    ordersSignal = signal<OrderRecord[]>([sampleOrder]);
    sessionSignal = signal<PersistedSessionRecord | null>(demoSession);
    // Crea el espía para el avance de estado.
    advanceOrderStatusSpy = vi.fn().mockResolvedValue(undefined);

    // Compila el módulo con servicios simulados.
    await TestBed.configureTestingModule({
      imports: [Tab3PageModule],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: { ordersSignal, loadOrders: vi.fn().mockResolvedValue(undefined), advanceOrderStatus: advanceOrderStatusSpy, resetOrdersToSeed: vi.fn().mockResolvedValue(undefined) } },
        { provide: CatalogService, useValue: { resetCatalogToDefault: vi.fn().mockResolvedValue(undefined) } },
        { provide: CartService, useValue: { clearCart: vi.fn().mockResolvedValue(undefined) } },
        {
          provide: JwtAuthenticationService,
          useValue: {
            activeRole: activeRoleSignal,
            sessionSignal,
            remainingSessionMinutes: computed(() => 30),
            signOutSession: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    // Crea y renderiza el componente.
    fixture = TestBed.createComponent(Tab3Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Restaura los espías y el entorno tras cada prueba.
  afterEach(() => {
    // Restablece el módulo de pruebas.
    TestBed.resetTestingModule();
    // Limpia los mocks de Vitest.
    vi.restoreAllMocks();
  });

  // Debe renderizar el componente sin errores.
  it('debe renderizar Tab3Page sin errores', () => {
    // Comprueba la existencia de la instancia.
    expect(component).toBeTruthy();
  });

  // Debe exponer una región aria-live para anunciar cambios de estado.
  it('debe incluir una región aria-live="polite" para accesibilidad', () => {
    // Busca la región viva en el DOM.
    const liveRegion = (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  // Debe conmutar reactivamente entre vistas de Cliente y Vendedor.
  it('debe conmutar reactivamente entre las vistas de customer y seller', () => {
    // En rol cliente se muestra el título de "Mis compras".
    activeRoleSignal.set('customer');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mis compras');

    // En rol vendedor se muestra la gestión de pedidos del vendedor.
    activeRoleSignal.set('seller');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pedidos del vendedor');
  });

  // Debe delegar el avance de estado de un pedido al servicio correspondiente.
  it('debe delegar el avance de estado del pedido al OrderService', async () => {
    // Invoca el avance sobre el pedido de ejemplo.
    await component.advanceOrder(sampleOrder);
    // Verifica que se solicite el avance del identificador correcto.
    expect(advanceOrderStatusSpy).toHaveBeenCalledWith(sampleOrder.id);
  });
});
