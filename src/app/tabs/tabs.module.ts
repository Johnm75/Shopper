/**
 * Módulo del contenedor de navegación inferior por pestañas de "App Shoper".
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBadge,
  IonHeader,
  IonIcon,
  IonLabel,
  IonNote,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { TabsPageRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  imports: [
    CommonModule,
    TabsPageRoutingModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonNote,
    IonLabel,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonBadge,
  ],
  declarations: [TabsPage],
})
export class TabsPageModule {}
