/**
 * Módulo perezoso de la pestaña Usuario (`Tab4Page`).
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

/**
 * Declara `Tab4Page` y registra los componentes Ionic de perfil, token y cierre de sesión.
 */
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
