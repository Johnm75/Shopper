/**
 * Pruebas unitarias de `OrderService` (Fase 6 SDD — TASK-020).
 *
 * Verifica hidratación de órdenes semilla, checkout que crea órdenes en estado
 * `Pagado`, avance secuencial de la máquina de estados con timestamps ISO-8601
 * y rechazo de transiciones inválidas.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de pruebas de Angular para construir el entorno de inyección.
import { TestBed } from '@angular/core/testing';
// Señal mutable para exponer líneas de carrito controladas en los escenarios de checkout.
import { signal } from '@angular/core';
// API de almacenamiento nativa simulable utilizada para persistir las órdenes.
import { Preferences } from '@capacitor/preferences';

// Servicio bajo prueba responsable de las órdenes y su máquina de estados.
import { OrderService } from './order.service';
// Dependencia inyectada: se simula para controlar el descuento de stock.
import { CatalogService } from './catalog.service';
// Dependencia inyectada: se simula para proveer el carrito y su vaciado.
import { CartService } from './cart.service';
// Entorno con la clave de almacenamiento `shoper.orders.v1`.
import { environment } from '../../environments/environment';
// Contrato de línea de carrito usado para construir pedidos deterministas.
import type { CartLineItem } from '../models/shoper.model';

// Suite de pruebas del servicio de pedidos.
describe('OrderService', () => {
  // Instancia real del servicio bajo prueba.
  let orderService: OrderService;
  // Espía que registra los descuentos de stock solicitados durante el checkout.
  let decrementStockSpy: ReturnType<typeof vi.fn>;
  // Espía que registra el vaciado del carrito tras crear la orden.
  let clearCartSpy: ReturnType<typeof vi.fn>;
  // Señal de carrito simulada para controlar los ítems a comprar.
  let cartItemsSignal: ReturnType<typeof signal<CartLineItem[]>>;

  // Línea de carrito de ejemplo utilizada en los escenarios de checkout.
  const checkoutItems: CartLineItem[] = [
    { productId: 101, title: 'Demo', price: 50, quantity: 2, thumbnail: 'https://img/d.png' },
  ];

  // Configura un entorno limpio y dobles de dependencias antes de cada prueba.
  beforeEach(async () => {
    // Limpia el almacenamiento web para evitar órdenes residuales.
    window.localStorage.clear();
    // Reinicia Preferences para forzar la ruta de hidratación de semillas.
    await Preferences.clear();

    // Inicializa los espías y la señal del carrito simulado.
    decrementStockSpy = vi.fn().mockResolvedValue(undefined);
    clearCartSpy = vi.fn().mockResolvedValue(undefined);
    cartItemsSignal = signal<CartLineItem[]>([]);

    // Registra el servicio real junto con dobles controlados de sus dependencias.
    TestBed.configureTestingModule({
      providers: [
        OrderService,
        { provide: CatalogService, useValue: { decrementStock: decrementStockSpy } },
        { provide: CartService, useValue: { cartItemsSignal, clearCart: clearCartSpy } },
      ],
    });

    // Resuelve la instancia del servicio desde el inyector de pruebas.
    orderService = TestBed.inject(OrderService);
  });

  // Restaura el entorno tras cada prueba para garantizar independencia.
  afterEach(() => {
    // Limpia el almacenamiento del navegador.
    window.localStorage.clear();
    // Revierte los espías y mocks registrados por Vitest.
    vi.restoreAllMocks();
  });

  // Debe crear automáticamente las dos órdenes semilla cuando no hay estado previo.
  it('debe crear las órdenes semilla #ORD-1001 y #ORD-1002 cuando el almacenamiento está vacío', async () => {
    // Ejecuta la carga inicial sin datos persistidos.
    await orderService.loadOrders();

    // Obtiene el listado resultante desde la señal reactiva.
    const orders = orderService.ordersSignal();
    // Localiza cada orden semilla por su identificador canónico.
    const order1001 = orders.find(order => order.id === '#ORD-1001');
    const order1002 = orders.find(order => order.id === '#ORD-1002');

    // Verifica que ambas órdenes existan con los estados definidos en el dominio.
    expect(order1001?.currentStatus).toBe('En preparación');
    expect(order1002?.currentStatus).toBe('En camino');
  });

  // Debe generar una orden en estado Pagado al ejecutar checkout y vaciar el carrito.
  it('debe crear una orden en estado "Pagado" al hacer checkout y vaciar el carrito', async () => {
    // Carga las órdenes semilla para tener un estado base consistente.
    await orderService.loadOrders();

    // Ejecuta el checkout con líneas explícitas para evitar depender del estado del carrito simulado.
    const newOrderId = await orderService.checkoutCart(checkoutItems);

    // Verifica que se haya descontado stock y vaciado el carrito.
    expect(decrementStockSpy).toHaveBeenCalledWith(101, 2);
    expect(clearCartSpy).toHaveBeenCalledTimes(1);

    // Comprueba que la nueva orden quede registrada en estado Pagado con historial inicial.
    const createdOrder = orderService.ordersSignal().find(order => order.id === newOrderId);
    expect(createdOrder).toBeDefined();
    expect(createdOrder?.currentStatus).toBe('Pagado');
    expect(createdOrder?.statusHistory[0]?.status).toBe('Pagado');
  });

  // Debe avanzar secuencialmente y registrar timestamps ISO-8601 en cada transición.
  it('debe avanzar secuencialmente Pagado → En preparación → En camino → Entregado con timestamps ISO-8601', async () => {
    // Parte de las órdenes semilla y crea una nueva orden en estado Pagado.
    await orderService.loadOrders();
    const newOrderId = await orderService.checkoutCart(checkoutItems);

    // Avanza la orden tres veces hasta el estado final permitido.
    await orderService.advanceOrderStatus(newOrderId); // Pagado -> En preparación
    await orderService.advanceOrderStatus(newOrderId); // En preparación -> En camino
    await orderService.advanceOrderStatus(newOrderId); // En camino -> Entregado

    // Recupera la orden actualizada desde la señal reactiva.
    const updatedOrder = orderService.ordersSignal().find(order => order.id === newOrderId);
    expect(updatedOrder?.currentStatus).toBe('Entregado');

    // Valida que el historial tenga al menos 4 entradas (creación + 3 avances).
    expect((updatedOrder?.statusHistory.length ?? 0)).toBeGreaterThanOrEqual(4);
    // Comprueba que cada timestamp del historial sea una fecha ISO-8601 válida.
    for (const historyEntry of updatedOrder?.statusHistory ?? []) {
      expect(Number.isNaN(Date.parse(historyEntry.timestamp))).toBe(false);
      expect(historyEntry.updatedBy).toBe('seller');
    }
  });

  // Debe rechazar transiciones inválidas cuando la orden ya está en estado final.
  it('debe rechazar transiciones inválidas cuando la orden ya está en "Entregado"', async () => {
    // Carga las órdenes semilla; #ORD-1002 parte en "En camino".
    await orderService.loadOrders();

    // Avanza #ORD-1002 hasta el estado final Entregado.
    await orderService.advanceOrderStatus('#ORD-1002');
    const deliveredOrder = orderService.ordersSignal().find(order => order.id === '#ORD-1002');
    expect(deliveredOrder?.currentStatus).toBe('Entregado');

    // Intentar avanzar nuevamente debe lanzar un error de transición inválida.
    await expect(orderService.advanceOrderStatus('#ORD-1002')).rejects.toThrow();
  });
});
