/**
 * Módulo de la pestaña «Catálogo / Inventario» (`Tab1Page`).
 *
 * Declara la vista dual Cliente/Vendedor y registra los custom elements de
 * Ionic empleados: rejilla responsive de tarjetas de producto, spinner de
 * carga e insumos del formulario reactivo de alta/edición del vendedor.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-018)
 */

import { NgModule } from '@angular/core';
// Directivas base y pipe `CurrencyPipe` (`| currency`) usado en los precios.
import { CommonModule } from '@angular/common';
// Infraestructura de formularios reactivos del formulario del vendedor.
import { ReactiveFormsModule } from '@angular/forms';
// Custom elements de Ionic usados en la plantilla del catálogo/inventario.
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonItem,
  IonRow,
  IonSpinner,
} from '@ionic/angular';

// Página del catálogo/inventario declarada por este módulo perezoso.
import { Tab1Page } from './tab1.page';
// Rutas hijas que vinculan `/tabs/tab1` con `Tab1Page`.
import { Tab1PageRoutingModule } from './tab1-routing.module';

// Ensambla la rejilla de productos y el formulario reactivo del vendedor.
@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Tab1PageRoutingModule,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonItem,
    IonInput,
    IonSpinner,
  ],
  declarations: [Tab1Page],
})
export class Tab1PageModule {}
