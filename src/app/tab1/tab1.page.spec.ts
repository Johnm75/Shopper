/**
 * Pruebas unitarias de `Tab1Page` (Fase 6 SDD — TASK-021).
 *
 * Verifica renderizado sin errores, conmutación reactiva entre vistas de
 * Cliente y Vendedor, atributos de accesibilidad y delegación a servicios.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de Angular Testing para instanciar el componente.
import { ComponentFixture, TestBed } from '@angular/core/testing';
// Señal y esquema para simular estado reactivo y tolerar web components de Ionic.
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
// Proveedor de router requerido por enlaces internos de la plantilla.
import { provideRouter } from '@angular/router';
// (No se requiere un módulo global adicional: Tab1PageModule declara los componentes Ionic.)

// Módulo y componente bajo prueba.
import { Tab1PageModule } from './tab1.module';
import { Tab1Page } from './tab1.page';
// Servicios que la página consume y que deben simularse.
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Tipos de dominio para construir datos deterministas.
import type { ProductItem, UserRole } from '../models/shoper.model';

// Suite de pruebas de la pestaña de catálogo/inventario.
describe('Tab1Page', () => {
  // Componente instanciado en cada prueba.
  let component: Tab1Page;
  // Fixture para inspeccionar el DOM renderizado.
  let fixture: ComponentFixture<Tab1Page>;
  // Señal simulada del rol activo.
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;
  // Señal simulada del catálogo de productos.
  let productsSignal: ReturnType<typeof signal<ProductItem[]>>;
  // Espías de servicios para verificar interacciones.
  let loadCatalogSpy: ReturnType<typeof vi.fn>;
  let addProductToCartSpy: ReturnType<typeof vi.fn>;

  // Producto de ejemplo para renderizar la cuadrícula.
  const sampleProduct: ProductItem = {
    id: 1,
    title: 'Producto Demo',
    price: 99.5,
    stock: 4,
    category: 'demo',
    thumbnail: 'https://img/demo.png',
  };

  // Configura módulos y dobles antes de cada caso.
  beforeEach(async () => {
    // Restablece el TestBed para aislar el escenario.
    TestBed.resetTestingModule();
    // Inicializa señales y espías con valores controlados.
    activeRoleSignal = signal<UserRole>('customer');
    productsSignal = signal<ProductItem[]>([sampleProduct]);
    loadCatalogSpy = vi.fn().mockResolvedValue(undefined);
    addProductToCartSpy = vi.fn().mockResolvedValue(undefined);

    // Compila el módulo con proveedores simulados.
    await TestBed.configureTestingModule({
      imports: [Tab1PageModule],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: { productsSignal, loadCatalog: loadCatalogSpy } },
        { provide: CartService, useValue: { addProductToCart: addProductToCartSpy } },
        { provide: JwtAuthenticationService, useValue: { activeRole: activeRoleSignal } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    // Crea y renderiza el componente.
    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Restaura los mocks y el entorno tras cada prueba.
  afterEach(() => {
    // Restablece el módulo de pruebas.
    TestBed.resetTestingModule();
    // Limpia los espías de Vitest.
    vi.restoreAllMocks();
  });

  // Debe renderizar sin errores y cargar el catálogo en la entrada a la vista.
  it('debe renderizar Tab1Page sin errores y solicitar la carga del catálogo', () => {
    // Verifica la creación del componente.
    expect(component).toBeTruthy();
    // Dispara el ciclo de vida de entrada para comprobar la carga.
    component.ionViewWillEnter();
    expect(loadCatalogSpy).toHaveBeenCalled();
  });

  // Debe exponer una región aria-live para anuncios accesibles.
  it('debe incluir una región aria-live="polite" para retroalimentación accesible', () => {
    // Busca la región viva en el DOM renderizado.
    const liveRegion = (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  // Debe conmutar reactivamente entre cuadrícula 2×2 de Cliente y CRUD de Tienda.
  it('debe conmutar reactivamente entre las vistas de customer y seller', () => {
    const host = fixture.nativeElement as HTMLElement;
    activeRoleSignal.set('customer');
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Nuevo producto');
    expect(host.querySelector('.catalog-grid--customer')).toBeTruthy();
    expect(host.querySelector('.shoper-product-card--compact')).toBeTruthy();

    activeRoleSignal.set('seller');
    fixture.detectChanges();
    expect(host.textContent).toContain('Nuevo producto');
    expect(host.querySelector('.catalog-grid--customer')).toBeNull();
  });
});
