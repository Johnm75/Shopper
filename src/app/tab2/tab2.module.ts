/**
 * Módulo de la pestaña «Carrito de compras» (`Tab2Page`).
 *
 * Declara la vista del carrito y registra únicamente los custom elements de
 * Ionic 9 empleados por la plantilla (listado de líneas con miniatura,
 * stepper de cantidad, spinner de hidratación y pie adhesivo de checkout)
 * para mantener el bundle perezoso lo más pequeño posible.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-019)
 */

import { NgModule } from '@angular/core';
// Directivas base y pipe `CurrencyPipe` (`| currency`) usado en precios y totales.
import { CommonModule } from '@angular/common';
// Custom elements de Ionic usados en la plantilla del carrito.
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonThumbnail,
} from '@ionic/angular';

// Página del carrito de compras declarada por este módulo perezoso.
import { Tab2Page } from './tab2.page';
// Rutas hijas que vinculan `/tabs/tab2` con `Tab2Page`; además reexporta
// `RouterModule`, lo que habilita la directiva `routerLink` del estado vacío
// ("Explorar el catálogo" → `/tabs/tab1`).
import { Tab2PageRoutingModule } from './tab2-routing.module';

// Ensambla el listado de líneas del carrito y la barra inferior de checkout.
@NgModule({
  imports: [
    CommonModule,
    Tab2PageRoutingModule,
    IonContent,
    IonList,
    IonItem,
    IonThumbnail,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  declarations: [Tab2Page],
})
export class Tab2PageModule {}
