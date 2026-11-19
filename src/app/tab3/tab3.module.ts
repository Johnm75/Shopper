/**
 * Módulo de la pestaña «Mis Compras / Pedidos Activos y Cuenta» (`Tab3Page`).
 *
 * Declara la vista dual de seguimiento logístico y registra únicamente los
 * custom elements de Ionic 9 empleados por la plantilla (tarjetas de pedido,
 * línea de tiempo, listas del panel de sesión y diálogos de confirmación)
 * para mantener el bundle perezoso lo más pequeño posible.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-019)
 */

import { NgModule } from '@angular/core';
// Directivas base (`NgClass` de la línea de tiempo) y pipe `CurrencyPipe`
// (`| currency`) usado en los importes de cada pedido.
import { CommonModule } from '@angular/common';
// Custom elements de Ionic usados en la plantilla de pedidos y cuenta.
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
} from '@ionic/angular';

// Página de pedidos/cuenta declarada por este módulo perezoso.
import { Tab3Page } from './tab3.page';
// Rutas hijas que vinculan `/tabs/tab3` con `Tab3Page`; además reexporta
// `RouterModule`, lo que habilita la directiva `routerLink` del estado vacío
// ("Explorar el catálogo" → `/tabs/tab1`).
import { Tab3PageRoutingModule } from './tab3-routing.module';

// Ensambla el seguimiento logístico, el panel JWT y los diálogos de acción.
@NgModule({
  imports: [
    CommonModule,
    Tab3PageRoutingModule,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonButton,
    IonSpinner,
    IonAlert,
  ],
  declarations: [Tab3Page],
})
export class Tab3PageModule {}
