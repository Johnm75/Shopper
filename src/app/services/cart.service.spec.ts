/**
 * Pruebas unitarias de `CartService` (Fase 6 SDD — TASK-020).
 *
 * Valida agregación, incremento/decremento, borrado, vaciado en checkout,
 * persistencia en `shoper.cart.v1` y cálculo exacto de `totalUnits`/`totalAmount`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de pruebas de Angular para configurar el inyector de dependencias.
import { TestBed } from '@angular/core/testing';
// Señal mutable usada para simular el catálogo disponible en las validaciones de stock.
import { signal } from '@angular/core';
// API de almacenamiento nativa simulable empleada por el servicio para persistir el carrito.
import { Preferences } from '@capacitor/preferences';

// Servicio bajo prueba que gestiona el carrito reactivo.
import { CartService } from './cart.service';
// Servicio de catálogo del que depende para consultar el stock disponible.
import { CatalogService } from './catalog.service';
// Entorno con la clave de almacenamiento `shoper.cart.v1`.
import { environment } from '../../environments/environment';
// Contratos de dominio para construir productos y líneas de carrito deterministas.
import type { PersistedCartState, ProductItem } from '../models/shoper.model';

// Suite de pruebas del servicio de carrito de compras.
describe('CartService', () => {
  // Instancia real del servicio creada por el `TestBed` en cada escenario.
  let cartService: CartService;
  // Señal de productos simulada que representa el stock expuesto por `CatalogService`.
  let catalogProductsSignal: ReturnType<typeof signal<ProductItem[]>>;

  // Productos de prueba con stock suficiente para los casos de uso.
  const demoProduct: ProductItem = {
    id: 1,
    title: 'Producto Demo',
    price: 10,
    stock: 10,
    category: 'demo',
    thumbnail: 'https://img/demo.png',
  };
  // Segundo producto para validar agregaciones múltiples e importes combinados.
  const secondProduct: ProductItem = {
    id: 2,
    title: 'Producto Secundario',
    price: 5,
    stock: 10,
    category: 'demo',
    thumbnail: 'https://img/demo2.png',
  };

  // Configura un entorno limpio y un catálogo simulado antes de cada prueba.
  beforeEach(async () => {
    // Limpia el almacenamiento web para evitar fugas de estado entre pruebas.
    window.localStorage.clear();
    // Reinicia Preferences para partir de un carrito vacío.
    await Preferences.clear();
    // Inicializa la señal del catálogo con stock suficiente por defecto.
    catalogProductsSignal = signal<ProductItem[]>([demoProduct, secondProduct]);

    // Registra el servicio bajo prueba y un doble del catálogo basado en señales.
    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: CatalogService, useValue: { productsSignal: catalogProductsSignal } },
      ],
    });

    // Obtiene la instancia del carrito desde el inyector de pruebas.
    cartService = TestBed.inject(CartService);
  });

  // Restaura el entorno tras cada prueba para mantener el aislamiento.
  afterEach(() => {
    // Limpia el almacenamiento local del navegador.
    window.localStorage.clear();
    // Revierte cualquier espía o mock creado durante la prueba.
    vi.restoreAllMocks();
  });

  // Debe agregar productos, acumular cantidades y calcular totales exactos.
  it('debe agregar productos al carrito y calcular totalUnits y totalAmount exactos', async () => {
    // Agrega el primer producto una vez.
    await cartService.addProductToCart(demoProduct);
    // Agrega el segundo producto una vez.
    await cartService.addProductToCart(secondProduct);
    // Agrega nuevamente el primero para incrementar su cantidad a 2.
    await cartService.addProductToCart(demoProduct);

    // Verifica que existan dos líneas distintas en el carrito.
    expect(cartService.cartItemsSignal().length).toBe(2);
    // Comprueba el total de unidades: 2 (demo) + 1 (secundario) = 3.
    expect(cartService.totalUnits()).toBe(3);
    // Comprueba el importe total: (10 * 2) + (5 * 1) = 25.
    expect(cartService.totalAmount()).toBe(25);
  });

  // Debe incrementar, decrementar y eliminar la línea al llegar a cantidad mínima.
  it('debe incrementar y decrementar cantidades, eliminando la línea al bajar de 1', async () => {
    // Parte de una línea con cantidad inicial 1.
    await cartService.addProductToCart(demoProduct);

    // Incrementa la cantidad a 2 unidades.
    await cartService.incrementQuantity(demoProduct.id);
    expect(cartService.cartItemsSignal()[0]?.quantity).toBe(2);

    // Decrementa a 1 unidad sin eliminar la línea.
    await cartService.decrementQuantity(demoProduct.id);
    expect(cartService.cartItemsSignal()[0]?.quantity).toBe(1);

    // Decrementa nuevamente: al llegar a 0 la línea debe desaparecer.
    await cartService.decrementQuantity(demoProduct.id);
    expect(cartService.cartItemsSignal().length).toBe(0);
  });

  // Debe eliminar una línea específica y persistir el cambio.
  it('debe eliminar un ítem del carrito y persistir el estado en Preferences', async () => {
    // Agrega dos productos distintos para luego eliminar uno.
    await cartService.addProductToCart(demoProduct);
    await cartService.addProductToCart(secondProduct);

    // Elimina únicamente la línea del primer producto.
    await cartService.removeItemFromCart(demoProduct.id);

    // Verifica que solo permanezca el producto secundario.
    expect(cartService.cartItemsSignal().length).toBe(1);
    expect(cartService.cartItemsSignal()[0]?.productId).toBe(secondProduct.id);

    // Comprueba que el nuevo estado se haya persistido en la clave canónica.
    const storedValue = await Preferences.get({ key: environment.storageKeys.cart });
    expect(storedValue.value).toContain(String(secondProduct.id));
  });

  // Debe vaciar el carrito por completo (comportamiento usado tras checkout).
  it('debe vaciar el carrito al invocar clearCart', async () => {
    // Siembra una línea en el carrito.
    await cartService.addProductToCart(demoProduct);
    expect(cartService.totalUnits()).toBe(1);

    // Ejecuta el vaciado completo.
    await cartService.clearCart();

    // Verifica que no queden líneas ni totales acumulados.
    expect(cartService.cartItemsSignal().length).toBe(0);
    expect(cartService.totalUnits()).toBe(0);
    expect(cartService.totalAmount()).toBe(0);
  });

  // Debe hidratar el carrito desde el almacenamiento persistido.
  it('debe cargar el carrito persistido desde Preferences', async () => {
    // Construye un estado persistido con una línea para simular una sesión previa.
    const persistedState: PersistedCartState = {
      schemaVersion: 1,
      items: [{ productId: 2, title: 'Persistido', price: 7, quantity: 3, thumbnail: 'https://img/p.png' }],
    };
    // Guarda el estado en la clave canónica del carrito.
    await Preferences.set({ key: environment.storageKeys.cart, value: JSON.stringify(persistedState) });

    // Hidrata el carrito desde el almacenamiento.
    await cartService.loadCart();

    // Comprueba que la señal y los totales reflejen el estado persistido.
    expect(cartService.cartItemsSignal().length).toBe(1);
    expect(cartService.totalUnits()).toBe(3);
    expect(cartService.totalAmount()).toBe(21);
  });
});
