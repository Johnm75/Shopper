/**
 * Módulo del contenedor de navegación inferior por pestañas de "App Shoper".
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBadge,
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular';

import { TabsPageRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  imports: [
    CommonModule,
    TabsPageRoutingModule,
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
