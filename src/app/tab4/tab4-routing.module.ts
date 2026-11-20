/**
 * Enrutamiento hijo de la pestaña `/tabs/tab4`.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Tab4Page } from './tab4.page';

const tab4Routes: Routes = [
  {
    path: '',
    component: Tab4Page,
  },
];

/**
 * Configura las rutas hijas de `Tab4PageModule`.
 */
@NgModule({
  imports: [RouterModule.forChild(tab4Routes)],
  exports: [RouterModule],
})
export class Tab4PageRoutingModule {}
