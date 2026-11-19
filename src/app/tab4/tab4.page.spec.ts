/**
 * Pruebas unitarias de `Tab4Page` (Pantalla dedicada de Usuario, Token y Sesión).
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { Tab4PageModule } from './tab4.module';
import { Tab4Page } from './tab4.page';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
import { CartService } from '../services/cart.service';
import { CatalogService } from '../services/catalog.service';
import { OrderService } from '../services/order.service';
import { ShopperDatabaseService } from '../services/database.service';
import type { PersistedSessionRecord, UserRole } from '../models/shoper.model';

describe('Tab4Page', () => {
  let component: Tab4Page;
  let fixture: ComponentFixture<Tab4Page>;
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;
  let sessionSignal: ReturnType<typeof signal<PersistedSessionRecord | null>>;
  let signOutSessionSpy: ReturnType<typeof vi.fn>;

  const customerSession: PersistedSessionRecord = {
    accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlbWlseXMifQ.signature123456',
    refreshToken: 'refresh-token',
    username: 'emilys',
    firstName: 'Emily',
    lastName: 'Johnson',
    role: 'customer',
    source: 'remote-api',
    expiresAt: '2026-11-19T23:00:00.000Z',
    schemaVersion: 1,
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    activeRoleSignal = signal<UserRole>('customer');
    sessionSignal = signal<PersistedSessionRecord | null>(customerSession);
    signOutSessionSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [Tab4PageModule],
      providers: [
        provideRouter([]),
        {
          provide: JwtAuthenticationService,
          useValue: {
            activeRole: activeRoleSignal,
            sessionSignal,
            maskedTokenPreview: computed(() => 'eyJhbGciOi…3456'),
            remainingSessionMinutes: computed(() => 45),
            signOutSession: signOutSessionSpy,
          },
        },
        { provide: CartService, useValue: { totalUnits: signal(3) } },
        { provide: CatalogService, useValue: { productsSignal: signal([{ id: 1 }, { id: 2 }]) } },
        { provide: OrderService, useValue: { ordersSignal: signal([{ currentStatus: 'Pagado' }]) } },
        {
          provide: ShopperDatabaseService,
          useValue: {
            getDatabaseStats: vi.fn().mockResolvedValue({
              engine: 'indexeddb',
              dbName: 'shopper_db',
              dbVersion: 2,
              usersCount: 2,
              productsCount: 2,
              cartItemsCount: 1,
              ordersCount: 1,
              hasActiveSession: true,
            }),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab4Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('debe renderizar la información del usuario autenticado y el token enmascarado', () => {
    expect(component).toBeTruthy();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Emily Johnson');
    expect(host.textContent).toContain('@emilys');
    expect(host.textContent).toContain('Cuenta Cliente');
    expect(host.textContent).toContain('eyJhbGciOi…3456');
    expect(host.textContent).not.toContain(customerSession.accessToken);
  });

  it('debe adaptar el perfil y resumen cuando el usuario tiene rol Tienda (seller)', () => {
    activeRoleSignal.set('seller');
    sessionSignal.set({
      ...customerSession,
      username: 'michaelw',
      firstName: 'Michael',
      lastName: 'Williams',
      role: 'seller',
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Michael Williams');
    expect(host.textContent).toContain('Cuenta Tienda');
    expect(host.textContent).toContain('Productos');
    expect(host.textContent).toContain('Pedidos activos');
  });

  it('debe permitir mostrar y ocultar el token JWT completo bajo demanda', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(component.isTokenVisible()).toBe(false);
    expect(host.textContent).not.toContain(customerSession.accessToken);

    component.toggleTokenVisibility();
    fixture.detectChanges();

    expect(component.isTokenVisible()).toBe(true);
    expect(host.textContent).toContain(customerSession.accessToken);

    component.toggleTokenVisibility();
    fixture.detectChanges();

    expect(component.isTokenVisible()).toBe(false);
  });

  it('debe delegar el cierre de sesión a JwtAuthenticationService.signOutSession', () => {
    component.confirmSignOut();
    expect(signOutSessionSpy).toHaveBeenCalledTimes(1);
  });
});
