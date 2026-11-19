/**
 * Pruebas unitarias de `Tab2Page` (Fase 6 SDD — TASK-021).
 *
 * Valida el renderizado sin errores, la presencia de controles accesibles en el
 * carrito, la actualización de cantidades y el flujo de checkout simulado.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para crear el componente.
import { ComponentFixture, TestBed } from '@angular/core/testing';
// Señales y esquema para simular estado reactivo y tolerar web components de Ionic.
import { CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
// Proveedor de router para espiar la navegación posterior al checkout.
import { Router, provideRouter } from '@angular/router';
// (No se requiere un módulo global adicional: Tab2PageModule declara los componentes Ionic.)
// Controlador de toasts de Ionic inyectado por la página.
import { ToastController } from '@ionic/angular';

// Módulo y componente bajo prueba.
import { Tab2PageModule } from './tab2.module';
import { Tab2Page } from './tab2.page';
// Servicios que la página coordina durante el flujo de compra.
import { CartService } from '../services/cart.service';
import { OrderService } from '../services/order.service';
import { CatalogService } from '../services/catalog.service';
// Contrato de línea de carrito para construir datos de prueba.
import type { CartLineItem } from '../models/shoper.model';

// Suite de pruebas de la pestaña de carrito.
describe('Tab2Page', () => {
  // Instancia del componente bajo prueba.
  let component: Tab2Page;
  // Fixture para acceder al DOM renderizado.
  let fixture: ComponentFixture<Tab2Page>;
  // Señal simulada con las líneas del carrito.
  let cartItemsSignal: ReturnType<typeof signal<CartLineItem[]>>;
  // Espías de operaciones del carrito y checkout.
  let incrementSpy: ReturnType<typeof vi.fn>;
  let decrementSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;
  let checkoutSpy: ReturnType<typeof vi.fn>;
  // Router para verificar la redirección tras el pago simulado.
  let router: Router;

  // Línea de carrito de ejemplo para poblar la vista.
  const sampleItem: CartLineItem = {
    productId: 1,
    title: 'Producto Demo',
    price: 10,
    quantity: 2,
    thumbnail: 'https://img/demo.png',
  };

  // Configura el entorno de pruebas con servicios simulados.
  beforeEach(async () => {
    // Restablece el TestBed para aislar el escenario.
    TestBed.resetTestingModule();
    // Inicializa la señal del carrito con un ítem de ejemplo.
    cartItemsSignal = signal<CartLineItem[]>([sampleItem]);
    // Crea espías para las mutaciones del carrito.
    incrementSpy = vi.fn().mockResolvedValue(undefined);
    decrementSpy = vi.fn().mockResolvedValue(undefined);
    removeSpy = vi.fn().mockResolvedValue(undefined);
    // Simula un checkout exitoso que devuelve un identificador de orden.
    checkoutSpy = vi.fn().mockResolvedValue('#ORD-2000');

    // Compila el módulo con dobles de las dependencias.
    await TestBed.configureTestingModule({
      imports: [Tab2PageModule],
      providers: [
        provideRouter([]),
        {
          provide: CartService,
          useValue: {
            cartItemsSignal,
            totalUnits: computed(() => cartItemsSignal().reduce((sum, item) => sum + item.quantity, 0)),
            totalAmount: computed(() => cartItemsSignal().reduce((sum, item) => sum + item.price * item.quantity, 0)),
            loadCart: vi.fn().mockResolvedValue(undefined),
            incrementQuantity: incrementSpy,
            decrementQuantity: decrementSpy,
            removeItemFromCart: removeSpy,
          },
        },
        { provide: OrderService, useValue: { checkoutCart: checkoutSpy } },
        { provide: CatalogService, useValue: { loadCatalog: vi.fn().mockResolvedValue(undefined) } },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    // Obtiene el router y crea el componente.
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Limpia los espías y el entorno después de cada prueba.
  afterEach(() => {
    // Restablece el módulo de pruebas.
    TestBed.resetTestingModule();
    // Restaura los mocks de Vitest.
    vi.restoreAllMocks();
  });

  // Debe renderizar la página sin errores.
  it('debe renderizar Tab2Page sin errores', () => {
    // Comprueba que la instancia sea válida.
    expect(component).toBeTruthy();
  });

  // Debe exponer atributos de accesibilidad en la vista del carrito.
  it('debe incluir región aria-live="polite" y controles accesibles', () => {
    // Obtiene el elemento raíz de la vista.
    const host = fixture.nativeElement as HTMLElement;
    // Verifica la existencia de la región de anuncios accesibles.
    expect(host.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  // Debe delegar el incremento de cantidad al servicio de carrito.
  it('debe delegar el incremento de cantidad al CartService', async () => {
    // Invoca el manejador de incremento con el ítem de ejemplo.
    await component.incrementQuantity(sampleItem);
    // Verifica que el servicio reciba el identificador correcto.
    expect(incrementSpy).toHaveBeenCalledWith(sampleItem.productId);
  });

  // Debe ejecutar el checkout y navegar a la pestaña de pedidos.
  it('debe ejecutar checkout y navegar a /tabs/tab3', async () => {
    // Espía la navegación para confirmar el destino posterior al pago.
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    // Ejecuta el flujo de checkout simulado.
    await component.checkout();

    // Comprueba que se haya creado la orden y redirigido al seguimiento.
    expect(checkoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/tab3');
  });
});
