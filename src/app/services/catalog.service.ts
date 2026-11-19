/**
 * Servicio de catálogo de productos para "App Shoper".
 *
 * Implementa el patrón Cache-Aside / Local-First sobre `ShopperDatabaseService`
 * (tabla `products` en `shopper_db` / IndexedDB con respaldo Preferences):
 * carga inicial desde la API pública DummyJSON, persistencia transaccional y
 * operaciones CRUD de inventario para el rol vendedor/tienda.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { ProductItem } from '../models/shoper.model';
import { environment } from '../../environments/environment';
import { ShopperDatabaseService } from './database.service';

interface DummyJsonProductsResponse {
  products: Array<{
    id: number;
    title: string;
    price: number;
    stock: number;
    category: string;
    thumbnail: string;
    description?: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly httpClient = inject(HttpClient);
  private readonly database = inject(ShopperDatabaseService);

  /**
   * Señal reactiva canónica con el listado de productos disponibles.
   */
  readonly productsSignal = signal<ProductItem[]>([]);

  /**
   * Lee el catálogo desde `shopper_db`; si la tabla aún no ha sido poblada,
   * descarga de la API pública o carga el catálogo semilla offline.
   */
  async loadCatalog(): Promise<void> {
    const initialized = await this.database.hasCatalogBeenInitialized();
    if (initialized) {
      const persistedProducts = await this.database.getAllProducts();
      this.productsSignal.set(persistedProducts);
      return;
    }

    try {
      const remoteProducts = await this.fetchRemoteProducts();
      this.productsSignal.set(remoteProducts);
      await this.database.replaceAllProducts(remoteProducts);
    } catch {
      const seedProducts = this.createSeedCatalog();
      this.productsSignal.set(seedProducts);
      await this.database.replaceAllProducts(seedProducts);
    }
  }

  /**
   * Crea un nuevo producto, lo inserta al inicio del catálogo y persiste en BD.
   */
  async createProduct(product: Omit<ProductItem, 'id'>): Promise<ProductItem> {
    const currentProducts = this.productsSignal();
    const nextId =
      currentProducts.length > 0 ? Math.max(...currentProducts.map(p => p.id)) + 1 : 1;

    const newProduct: ProductItem = {
      ...product,
      id: nextId,
    };

    const updatedProducts = [newProduct, ...currentProducts];
    this.productsSignal.set(updatedProducts);
    await this.database.replaceAllProducts(updatedProducts);

    return newProduct;
  }

  /**
   * Actualiza parcialmente un producto existente y persiste en BD.
   */
  async updateProduct(id: number, changes: Partial<Omit<ProductItem, 'id'>>): Promise<void> {
    let updatedProduct: ProductItem | null = null;

    this.productsSignal.update(products =>
      products.map(product => {
        if (product.id !== id) {
          return product;
        }
        updatedProduct = { ...product, ...changes };
        return updatedProduct;
      })
    );

    if (updatedProduct) {
      await this.database.upsertProduct(updatedProduct);
    }
  }

  /**
   * Elimina un producto del catálogo y lo borra de la tabla `products`.
   */
  async deleteProduct(id: number): Promise<void> {
    this.productsSignal.update(products => products.filter(product => product.id !== id));
    await this.database.deleteProduct(id);
  }

  /**
   * Reduce el stock de un producto en la cantidad indicada y actualiza la BD.
   */
  async decrementStock(productId: number, quantity: number): Promise<void> {
    if (quantity <= 0) {
      throw new Error('La cantidad a descontar debe ser mayor a cero.');
    }

    const product = this.productsSignal().find(p => p.id === productId);
    if (!product) {
      throw new Error(`No se encontró el producto con id ${productId}.`);
    }

    if (product.stock < quantity) {
      throw new Error(`Stock insuficiente para el producto "${product.title}".`);
    }

    const updatedProduct: ProductItem = { ...product, stock: product.stock - quantity };
    this.productsSignal.update(products =>
      products.map(p => (p.id === productId ? updatedProduct : p))
    );
    await this.database.upsertProduct(updatedProduct);
  }

  /**
   * Limpia la tabla `products` y recarga el catálogo desde la API o semilla.
   */
  async resetCatalogToDefault(): Promise<void> {
    await this.database.clearProducts();
    await this.loadCatalog();
  }

  private async fetchRemoteProducts(): Promise<ProductItem[]> {
    const catalogEndpointUrl = `${environment.apiBaseUrl}/products?limit=20`;

    const response = await firstValueFrom(
      this.httpClient.get<DummyJsonProductsResponse>(catalogEndpointUrl)
    );

    if (!response || !Array.isArray(response.products)) {
      throw new Error('La respuesta de la API no contiene productos.');
    }

    return response.products.map(remoteProduct => this.normalizeRemoteProduct(remoteProduct));
  }

  private normalizeRemoteProduct(
    remoteProduct: DummyJsonProductsResponse['products'][number]
  ): ProductItem {
    return {
      id: remoteProduct.id,
      title: remoteProduct.title,
      price: Number(remoteProduct.price),
      stock: Number(remoteProduct.stock),
      category: remoteProduct.category,
      thumbnail: remoteProduct.thumbnail,
      description: remoteProduct.description,
    };
  }

  private createSeedCatalog(): ProductItem[] {
    return [
      {
        id: 101,
        title: 'Smartphone Demo X1',
        price: 299.99,
        stock: 25,
        category: 'smartphones',
        thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/iPhone%2013%20Pro/1.png',
        description: 'Teléfono inteligente de demostración con cámara triple y 128 GB.',
      },
      {
        id: 102,
        title: 'Auriculares Inalámbricos Pro',
        price: 89.5,
        stock: 40,
        category: 'mobile-accessories',
        thumbnail:
          'https://cdn.dummyjson.com/products/images/mobile-accessories/Apple%20AirPods%20Max%20Silver/1.png',
        description: 'Auriculares con cancelación activa de ruido y batería de 20 horas.',
      },
      {
        id: 103,
        title: 'Portátil Ultraligero 14"',
        price: 749.0,
        stock: 12,
        category: 'laptops',
        thumbnail:
          'https://cdn.dummyjson.com/products/images/laptops/Apple%20MacBook%20Pro%2014%20Inch%20Space%20Grey/1.png',
        description: 'Laptop ligera orientada a productividad y desarrollo móvil.',
      },
      {
        id: 104,
        title: 'Reloj Inteligente Sport',
        price: 129.99,
        stock: 30,
        category: 'smartwatches',
        thumbnail:
          'https://cdn.dummyjson.com/products/images/smartwatches/Apple%20Watch%20Series%207%20Diamond%20Face/1.png',
        description: 'Smartwatch con monitor cardíaco, GPS y resistencia al agua.',
      },
    ];
  }
}
