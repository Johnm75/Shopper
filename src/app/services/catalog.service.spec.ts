/**
 * Pruebas unitarias de `CatalogService` (Fase 6 SDD — TASK-020).
 *
 * Verifica el patrón cache-aside/local-first: descarga inicial desde DummyJSON
 * cuando no existe caché, lectura prioritaria desde caché, persistencia inmediata
 * de las operaciones CRUD y restauración del catálogo semilla offline/base.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 6 — Calidad, Pruebas y Auditoría
 */

// Utilidades de pruebas de Angular para crear un entorno de inyección aislado.
import { TestBed } from '@angular/core/testing';
// Proveedor del cliente HTTP requerido por el servicio bajo prueba.
import { provideHttpClient } from '@angular/common/http';
// Controlador de pruebas HTTP para interceptar y responder peticiones salientes.
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
// API de almacenamiento nativa simulable que usa el servicio para persistir caché.
import { Preferences } from '@capacitor/preferences';

// Servicio bajo prueba que implementa el catálogo local-first.
import { CatalogService } from './catalog.service';
// Entorno con la clave `shoper.catalog.v1` y el origen de la API pública.
import { environment } from '../../environments/environment';
// Contrato del estado persistido para construir escenarios de caché deterministas.
import type { PersistedCatalogState } from '../models/shoper.model';

// Suite de pruebas del servicio de catálogo de productos.
describe('CatalogService', () => {
  // Instancia real del servicio creada por el `TestBed` en cada caso.
  let catalogService: CatalogService;
  // Controlador que permite afirmar y resolver las peticiones HTTP simuladas.
  let httpController: HttpTestingController;

  // Prepara un entorno limpio antes de cada prueba para evitar contaminación entre casos.
  beforeEach(async () => {
    // Restablece el TestBed para evitar fugas de configuración entre pruebas.
    TestBed.resetTestingModule();
    // Limpia el almacenamiento web para que no queden residuos de ejecuciones previas.
    window.localStorage.clear();
    // Reinicia el mock de Preferences para garantizar un caché vacío por defecto.
    await Preferences.clear();

    // Configura el módulo de pruebas con HttpClient y su backend de testing.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    // Resuelve la instancia del servicio y del controlador HTTP desde el inyector.
    catalogService = TestBed.inject(CatalogService);
    httpController = TestBed.inject(HttpTestingController);
  });

  // Verifica que no queden peticiones pendientes y restaura los espías tras cada prueba.
  afterEach(() => {
    // Falla la prueba si quedó alguna solicitud HTTP sin atender.
    httpController.verify();
    // Restablece el TestBed para aislar el siguiente caso.
    TestBed.resetTestingModule();
    // Limpia el almacenamiento para no afectar otras suites.
    window.localStorage.clear();
    // Restaura todos los mocks/espías de Vitest al estado original.
    vi.restoreAllMocks();
  });

  // Debe descargar desde la API cuando el caché está vacío y persistir el resultado.
  it('debe descargar el catálogo inicial desde DummyJSON cuando la caché está vacía y persistirlo', async () => {
    // Inicia la carga; al no haber caché debe disparar una petición remota.
    const loadPromise = catalogService.loadCatalog();
    // Espera a que las promesas de Preferences y la cola de macrotareas se resuelvan.
    await new Promise(resolve => setTimeout(resolve, 0));

    // Intercepta la petición GET esperada hacia el endpoint público de productos.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/products?limit=20`);
    // Comprueba que el verbo HTTP utilizado sea GET.
    expect(pendingRequest.request.method).toBe('GET');
    // Responde con un producto remoto para simular una descarga exitosa.
    pendingRequest.flush({
      products: [
        { id: 1, title: 'Remoto A', price: 10, stock: 5, category: 'tech', thumbnail: 'https://img/a.png' },
      ],
    });

    // Espera a que el servicio termine de procesar la respuesta y persistir.
    await loadPromise;

    // Verifica que la señal reactiva contenga el producto normalizado.
    expect(catalogService.productsSignal().length).toBe(1);
    expect(catalogService.productsSignal()[0]?.title).toBe('Remoto A');

    // Comprueba que el estado se haya guardado inmediatamente en Preferences.
    const storedValue = await Preferences.get({ key: environment.storageKeys.catalog });
    expect(storedValue.value).toBeTruthy();
  });

  // Debe leer prioritariamente desde caché y evitar llamadas HTTP innecesarias.
  it('debe leer prioritariamente desde la caché local sin consultar la API remota', async () => {
    // Construye un estado persistido válido con la versión de esquema actual.
    const cachedState: PersistedCatalogState = {
      schemaVersion: 1,
      lastUpdatedAt: '2026-11-12T00:00:00.000Z',
      products: [
        { id: 99, title: 'Cacheado', price: 20, stock: 3, category: 'demo', thumbnail: 'https://img/c.png' },
      ],
    };
    // Siembra el caché en Preferences para simular una apertura subsecuente.
    await Preferences.set({ key: environment.storageKeys.catalog, value: JSON.stringify(cachedState) });

    // Ejecuta la carga; no debe emitirse ninguna petición HTTP.
    await catalogService.loadCatalog();

    // Afirma que no hubo solicitudes salientes gracias al cache-hit.
    httpController.expectNone(`${environment.apiBaseUrl}/products?limit=20`);
    // Verifica que la señal se hidrató con el producto proveniente del caché.
    expect(catalogService.productsSignal()[0]?.id).toBe(99);
  });

  // Debe activar el catálogo semilla offline cuando la API falla y no hay caché.
  it('debe cargar el catálogo semilla offline cuando la descarga remota falla', async () => {
    // Inicia la carga sin caché para forzar el intento remoto.
    const loadPromise = catalogService.loadCatalog();
    // Espera a que las promesas de Preferences y la cola de macrotareas se resuelvan.
    await new Promise(resolve => setTimeout(resolve, 0));

    // Intercepta la petición y la rechaza simulando un fallo de red.
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/products?limit=20`);
    pendingRequest.error(new ProgressEvent('error'));

    // Espera a que el servicio aplique la ruta de contingencia.
    await loadPromise;

    // Comprueba que se haya cargado el catálogo semilla determinista (>= 4 productos).
    expect(catalogService.productsSignal().length).toBeGreaterThanOrEqual(4);
  });

  // Debe persistir inmediatamente las operaciones CRUD sobre el catálogo.
  it('debe persistir inmediatamente las operaciones create, update y delete', async () => {
    // Siembra un catálogo inicial en caché para operar sin llamadas HTTP.
    const initialState: PersistedCatalogState = {
      schemaVersion: 1,
      lastUpdatedAt: '2026-11-12T00:00:00.000Z',
      products: [
        { id: 1, title: 'Base', price: 10, stock: 5, category: 'demo', thumbnail: 'https://img/b.png' },
      ],
    };
    await Preferences.set({ key: environment.storageKeys.catalog, value: JSON.stringify(initialState) });
    await catalogService.loadCatalog();

    // Crea un producto nuevo y verifica que se persista en Preferences.
    await catalogService.createProduct({ title: 'Nuevo', price: 15, stock: 2, category: 'demo', thumbnail: 'https://img/n.png' });
    expect(catalogService.productsSignal().some(product => product.title === 'Nuevo')).toBe(true);

    // Actualiza el producto creado y comprueba la mutación persistida en memoria.
    const createdProduct = catalogService.productsSignal().find(product => product.title === 'Nuevo');
    expect(createdProduct).toBeDefined();
    await catalogService.updateProduct(createdProduct!.id, { price: 18 });
    expect(catalogService.productsSignal().find(product => product.id === createdProduct!.id)?.price).toBe(18);

    // Elimina el producto y valida que ya no exista en la señal reactiva.
    await catalogService.deleteProduct(createdProduct!.id);
    expect(catalogService.productsSignal().some(product => product.id === createdProduct!.id)).toBe(false);

    // Confirma que el último estado quedó guardado en el almacenamiento.
    const storedValue = await Preferences.get({ key: environment.storageKeys.catalog });
    expect(storedValue.value).toBeTruthy();
  });

  // Debe restaurar el catálogo base eliminando la caché y recargando desde la fuente.
  it('debe restaurar el catálogo base eliminando la caché local y recargando', async () => {
    // Siembra un caché con datos alterados para simular cambios del vendedor.
    const modifiedState: PersistedCatalogState = {
      schemaVersion: 1,
      lastUpdatedAt: '2026-11-12T00:00:00.000Z',
      products: [{ id: 77, title: 'Alterado', price: 1, stock: 1, category: 'x', thumbnail: 'https://img/x.png' }],
    };
    await Preferences.set({ key: environment.storageKeys.catalog, value: JSON.stringify(modifiedState) });
    await catalogService.loadCatalog();
    // Confirma que el estado alterado está cargado antes del reseteo.
    expect(catalogService.productsSignal()[0]?.id).toBe(77);

    // Solicita el reseteo; debe borrar la clave y volver a consultar la API.
    const resetPromise = catalogService.resetCatalogToDefault();
    // Espera a que se elimine la caché y se emita la petición de recarga.
    await new Promise(resolve => setTimeout(resolve, 0));
    const pendingRequest = httpController.expectOne(`${environment.apiBaseUrl}/products?limit=20`);
    pendingRequest.flush({
      products: [
        { id: 5, title: 'Base API', price: 30, stock: 8, category: 'tech', thumbnail: 'https://img/api.png' },
      ],
    });
    // Espera a que el reseteo complete la recarga.
    await resetPromise;

    // Verifica que el catálogo refleje los datos restaurados desde la API.
    expect(catalogService.productsSignal()[0]?.id).toBe(5);
  });
});
