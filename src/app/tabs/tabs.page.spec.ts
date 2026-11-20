/**
 * Pruebas unitarias de `TabsPage`.
 *
 * Verifica la separación estricta de pestañas por rol (4 para Cliente, 3 para Tienda),
 * la ausencia del encabezado global y del conmutador de rol simultáneo.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TabsPageModule } from './tabs.module';
import { TabsPage } from './tabs.page';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
import { CartService } from '../services/cart.service';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
import type { UserRole } from '../models/shoper.model';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    activeRoleSignal = signal<UserRole>('customer');

    await TestBed.configureTestingModule({
      imports: [TabsPageModule],
      providers: [
        provideRouter([]),
        {
          provide: JwtAuthenticationService,
          useValue: {
            activeRole: activeRoleSignal,
            sessionSignal: signal({ firstName: 'Demo', username: 'demo' }),
          },
        },
        {
          provide: CartService,
          useValue: { totalUnits: signal(2), loadCart: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: OrderService,
          useValue: {
            ordersSignal: signal([{ currentStatus: 'Pagado' }, { currentStatus: 'Entregado' }]),
            loadOrders: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CatalogService,
          useValue: { loadCatalog: vi.fn().mockResolvedValue(undefined) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('debe mostrar 4 pestañas sin encabezado global cuando ingresa como Cliente', () => {
    expect(component).toBeTruthy();
    const host = fixture.nativeElement as HTMLElement;
    const tabButtons = host.querySelectorAll('ion-tab-button');
    expect(tabButtons.length).toBe(4);
    expect(host.querySelector('ion-header')).toBeNull();
    expect(host.querySelector('ion-segment')).toBeNull();
    expect(host.textContent).toContain('Catálogo');
    expect(host.textContent).toContain('Carrito');
    expect(host.textContent).toContain('Mis compras');
    expect(host.textContent).toContain('Usuario');
  });

  it('debe ocultar Carrito y mostrar Inventario, Pedidos y Usuario cuando ingresa como Tienda', () => {
    activeRoleSignal.set('seller');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const tabButtons = host.querySelectorAll('ion-tab-button');
    expect(tabButtons.length).toBe(3);
    expect(host.textContent).toContain('Inventario');
    expect(host.textContent).toContain('Pedidos');
    expect(host.textContent).toContain('Usuario');
    expect(host.textContent).not.toContain('Carrito');
  });

  it('debe exponer aria-label en la barra de pestañas', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('ion-tab-bar[aria-label]')).toBeTruthy();
  });
});
