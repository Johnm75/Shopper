/**
 * Módulo de la pestaña «Usuario» (`Tab4Page`).
 *
 * Declara la vista dedicada a la identidad del usuario autenticado (Cliente o
 * Tienda), inspección del token JWT, diagnóstico de almacenamiento local y
 * cierre de sesión seguro.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/angular';

import { Tab4PageRoutingModule } from './tab4-routing.module';
import { Tab4Page } from './tab4.page';

@NgModule({
  imports: [
    CommonModule,
    Tab4PageRoutingModule,
    IonAlert,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
  ],
  declarations: [Tab4Page],
})
export class Tab4PageModule {}
