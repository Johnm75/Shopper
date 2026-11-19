/**
 * ===========================================================================
 * APP SHOPER — Pestaña 1: Catálogo (Cliente) / Inventario (Vendedor)
 * ===========================================================================
 * Propósito : Vista dual condicionada por el rol activo (`activeRole`):
 *             - Cliente: cuadrícula de productos con imagen diferida
 *               (`loading="lazy"`), categoría, precio, stock y botón
 *               "Agregar al carrito" conectado a `CartService`.
 *             - Vendedor: misma cuadrícula con acciones editar/eliminar,
 *               formulario reactivo validado de alta/edición de productos y
 *               botón "Restaurar catálogo base API" contra `CatalogService`.
 *             Los datos se refrescan en `ionViewWillEnter()` porque el
 *             `ion-router-outlet` de Ionic cachea las páginas en el DOM.
 * Fase SDD  : Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-018).
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-12
 * ===========================================================================
 */

import { Component, inject, signal } from '@angular/core';
// Constructor de formularios reactivos y validadores del formulario vendedor.
import { FormBuilder, Validators } from '@angular/forms';
// Contratos de ciclo de vida de Ionic (entrada a vista y anuncio accesible).
import type { ViewDidEnter, ViewWillEnter } from '@ionic/angular';
// Registro explícito de los iconos usados en tarjetas, formulario y avisos.
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  cartOutline,
  checkmarkCircleOutline,
  closeOutline,
  createOutline,
  refreshOutline,
  trashOutline,
} from 'ionicons/icons';

// Servicio local-first del catálogo: señal `productsSignal` + CRUD completo.
import { CatalogService } from '../services/catalog.service';
// Servicio del carrito: agrega productos validando el stock disponible.
import { CartService } from '../services/cart.service';
// Servicio de sesión: expone la señal `activeRole` que condiciona la vista.
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Contrato del producto del dominio Shoper.
import type { ProductItem } from '../models/shoper.model';
// Utilidad que anuncia la navegación de la vista a los lectores de pantalla.
import { announcePageNavigation } from '../utils/a11y-announce.util';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  // Página declarada por `Tab1PageModule` (arquitectura NgModule del proyecto).
  standalone: false,
})
export class Tab1Page implements ViewWillEnter, ViewDidEnter {
  // Motor local-first del catálogo (caché `shoper.catalog.v1` + API DummyJSON).
  private readonly catalogService = inject(CatalogService);
  // Motor reactivo del carrito para la acción "Agregar al carrito".
  private readonly cartService = inject(CartService);
  // Fuente única de verdad del rol activo (Cliente | Vendedor).
  private readonly authenticationService = inject(JwtAuthenticationService);
  // Constructor del formulario reactivo de alta/edición del vendedor.
  private readonly formBuilder = inject(FormBuilder);

  /** Rol activo que decide qué vista se renderiza (señal del servicio). */
  readonly activeRole = this.authenticationService.activeRole;

  /** Listado reactivo de productos consumido por la cuadrícula. */
  readonly products = this.catalogService.productsSignal;

  /** Bloquea la cuadrícula mientras se hidrata el catálogo desde storage/API. */
  readonly isLoadingCatalog = signal<boolean>(false);

  /** Indica si el formulario del vendedor está desplegado o replegado. */
  readonly isProductFormOpen = signal<boolean>(false);

  /** Identificador del producto en edición; `null` significa "alta nueva". */
  readonly editingProductId = signal<number | null>(null);

  /** Mensaje de retroalimentación mostrado en la región `aria-live`. */
  readonly actionMessage = signal<string>('');

  /** Naturaleza del mensaje ('success' | 'error') para el color del aviso. */
  readonly actionMessageType = signal<'success' | 'error'>('success');

  /**
   * Formulario reactivo del vendedor (REQ-005) con validación estricta:
   * - `title`: nombre del producto, obligatorio y mínimo 3 caracteres.
   * - `price`: precio unitario, obligatorio y mayor que cero.
   * - `stock`: unidades disponibles, obligatorias y no negativas.
   * - `category`: categoría comercial, obligatoria.
   * - `thumbnail`: URL de la imagen; opcional (se usa una imagen por defecto).
   */
  readonly productForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    price: [0, [Validators.required, Validators.min(0.01)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    category: ['', [Validators.required]],
    thumbnail: [''],
  });

  /**
   * URL de miniatura por defecto cuando el vendedor no aporta una imagen:
   * evita `<img src="">` rotos en la cuadrícula.
   */
  readonly defaultThumbnailUrl =
    'https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/1.png';

  /**
   * Registra únicamente los iconos empleados por esta vista (tree-shaking).
   */
  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      cartOutline,
      checkmarkCircleOutline,
      closeOutline,
      createOutline,
      refreshOutline,
      trashOutline,
    });
  }

  /**
   * Ciclo de vida Ionic: en CADA entrada a la pestaña se hidrata el catálogo
   * desde `@capacitor/preferences` (o desde la API/semilla en el primer uso),
   * de modo que los cambios del vendedor se reflejan al volver al catálogo.
   */
  ionViewWillEnter(): void {
    void this.refreshCatalog();
  }

  /**
   * Ciclo de vida Ionic: anuncia la vista al lector de pantalla y mueve el
   * foco accesible al encabezado de la sección principal.
   */
  ionViewDidEnter(): void {
    announcePageNavigation('Catálogo — App Shoper', 'tab1-title');
  }

  /**
   * Carga el catálogo con indicador de progreso y tolerancia a fallos:
   * `loadCatalog()` ya implementa la cascada caché → API → semilla offline.
   */
  async refreshCatalog(): Promise<void> {
    this.isLoadingCatalog.set(true);
    try {
      await this.catalogService.loadCatalog();
    } finally {
      // Libera el spinner incluso si la carga lanza un error inesperado.
      this.isLoadingCatalog.set(false);
    }
  }

  /**
   * Acción del Cliente: agrega una unidad del producto al carrito.
   * `CartService` valida el stock y lanza un error descriptivo si no alcanza.
   *
   * @param product Producto de la tarjeta pulsada.
   */
  async addToCart(product: ProductItem): Promise<void> {
    try {
      await this.cartService.addProductToCart(product);
      this.announceAction(`"${product.title}" agregado al carrito.`, 'success');
    } catch (stockError) {
      // Convierte el Error del servicio en texto legible para la región live.
      const message = stockError instanceof Error ? stockError.message : 'No se pudo agregar el producto.';
      this.announceAction(message, 'error');
    }
  }

  /**
   * Acción del Vendedor: abre el formulario en modo ALTA con campos vacíos.
   */
  openCreateProductForm(): void {
    this.editingProductId.set(null);
    this.productForm.reset({ title: '', price: 0, stock: 0, category: '', thumbnail: '' });
    this.isProductFormOpen.set(true);
  }

  /**
   * Acción del Vendedor: abre el formulario en modo EDICIÓN precargado con
   * los datos actuales del producto seleccionado.
   *
   * @param product Producto que se va a modificar.
   */
  openEditProductForm(product: ProductItem): void {
    this.editingProductId.set(product.id);
    this.productForm.setValue({
      title: product.title,
      price: product.price,
      stock: product.stock,
      category: product.category,
      thumbnail: product.thumbnail,
    });
    this.isProductFormOpen.set(true);
  }

  /**
   * Acción del Vendedor: repliega el formulario sin persistir cambios.
   */
  closeProductForm(): void {
    this.isProductFormOpen.set(false);
    this.editingProductId.set(null);
  }

  /**
   * Acción del Vendedor: valida el formulario y crea o actualiza el producto
   * según el modo activo (`editingProductId`), persistiendo en el catálogo.
   */
  async submitProductForm(): Promise<void> {
    // Si el formulario es inválido, marca los controles para mostrar errores.
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.announceAction('Revisa los campos obligatorios del formulario.', 'error');
      return;
    }

    // Normaliza los valores: números positivos y URL de imagen con respaldo.
    const formValue = this.productForm.getRawValue();
    const productData = {
      title: formValue.title.trim(),
      price: Number(formValue.price),
      stock: Math.max(0, Math.round(Number(formValue.stock))),
      category: formValue.category.trim(),
      thumbnail: formValue.thumbnail.trim() || this.defaultThumbnailUrl,
    };

    const editingId = this.editingProductId();
    if (editingId !== null) {
      // Modo EDICIÓN: actualización parcial del producto existente.
      await this.catalogService.updateProduct(editingId, productData);
      this.announceAction(`Producto "${productData.title}" actualizado.`, 'success');
    } else {
      // Modo ALTA: inserción al inicio del catálogo con id autoincremental.
      await this.catalogService.createProduct(productData);
      this.announceAction(`Producto "${productData.title}" creado.`, 'success');
    }

    // Cierra el formulario tras guardar para mostrar la cuadrícula actualizada.
    this.closeProductForm();
  }

  /**
   * Acción del Vendedor: elimina un producto del catálogo local.
   * La acción es reversible con "Restaurar catálogo base API".
   *
   * @param product Producto que se va a eliminar.
   */
  async deleteProduct(product: ProductItem): Promise<void> {
    await this.catalogService.deleteProduct(product.id);
    this.announceAction(`Producto "${product.title}" eliminado del inventario.`, 'success');
  }

  /**
   * Acción del Vendedor: descarta los cambios locales y recarga el catálogo
   * base de la API pública (o la semilla offline si no hay red).
   */
  async resetCatalogToBase(): Promise<void> {
    this.isLoadingCatalog.set(true);
    try {
      await this.catalogService.resetCatalogToDefault();
      this.announceAction('Catálogo restaurado a los datos base de la API.', 'success');
    } finally {
      this.isLoadingCatalog.set(false);
    }
  }

  /**
   * Devuelve el texto de error de un campo del formulario del vendedor solo
   * tras la interacción del usuario (evita ruido visual al abrir el alta).
   *
   * @param fieldName Control consultado del `productForm`.
   */
  getProductFieldError(
    fieldName: 'title' | 'price' | 'stock' | 'category'
  ): string | undefined {
    const control = this.productForm.controls[fieldName];
    if (control.valid || !control.touched) {
      return undefined;
    }

    // Mensaje específico según la regla de validación incumplida.
    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    if (control.hasError('minlength')) {
      return 'Usa al menos 3 caracteres.';
    }
    if (control.hasError('min')) {
      return fieldName === 'price' ? 'El precio debe ser mayor que 0.' : 'El stock no puede ser negativo.';
    }
    return 'Revisa el valor introducido.';
  }

  /**
   * Publica un mensaje en la región accesible `aria-live="polite"` y fija su
   * naturaleza para aplicar el color semántico correcto en la plantilla.
   *
   * @param message Texto anunciado al usuario.
   * @param type Semántica del mensaje ('success' verde | 'error' rojo).
   */
  private announceAction(message: string, type: 'success' | 'error'): void {
    this.actionMessageType.set(type);
    this.actionMessage.set(message);
  }
}
