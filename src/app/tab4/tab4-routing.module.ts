/**
 * Enrutamiento hijo de la pestaña `/tabs/tab4` (Usuario).
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
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

@NgModule({
  imports: [RouterModule.forChild(tab4Routes)],
  exports: [RouterModule],
})
export class Tab4PageRoutingModule {}
