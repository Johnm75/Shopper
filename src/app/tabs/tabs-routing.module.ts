/**
 * Módulo de enrutamiento del contenedor de pestañas `/tabs`.
 *
 * Registra el árbol de rutas hijo declarado de forma centralizada en
 * `tabs.routes.ts` (FILE-014 de PLAN.md) para que `TabsPage` aloje las tres
 * pestañas del dominio comercial con carga perezosa.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-017)
 */

import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

// Árbol de rutas canónico de las pestañas (tab1, tab2, tab3 + redirección base).
import { tabsRoutes } from './tabs.routes';

// Registra las rutas hijas del contenedor y reexporta `RouterModule` para que
// las directivas `routerLink`/`routerLinkActive` estén disponibles en la vista.
@NgModule({
  imports: [RouterModule.forChild(tabsRoutes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
