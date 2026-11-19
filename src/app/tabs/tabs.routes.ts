/**
 * ===========================================================================
 * APP SHOPER — Árbol de rutas internas del contenedor de pestañas
 * ===========================================================================
 * Propósito : Declarar las rutas hijas de `/tabs` (tab1 Catálogo/Inventario,
 *             tab2 Carrito exclusivo de Cliente y tab3 Mis Compras/Pedidos).
 *             Cada sesión solo habilita la vista correspondiente al rol con
 *             el que inició sesión.
 * Autor     : John Fredy Marciales Morales
 * Fecha     : 2026-11-18
 * ===========================================================================
 */

import type { Routes } from '@angular/router';

import { TabsPage } from './tabs.page';
import { customerOnlyGuard } from '../guards/role.guard';

export const tabsRoutes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        // Pestaña 1 — Catálogo (Cliente) / Inventario (Tienda).
        path: 'tab1',
        loadChildren: () => import('../tab1/tab1.module').then(m => m.Tab1PageModule),
      },
      {
        // Pestaña 2 — Carrito de compras (exclusivo del rol Cliente).
        path: 'tab2',
        canActivate: [customerOnlyGuard],
        loadChildren: () => import('../tab2/tab2.module').then(m => m.Tab2PageModule),
      },
      {
        // Pestaña 3 — Mis Compras (Cliente) / Pedidos (Tienda).
        path: 'tab3',
        loadChildren: () => import('../tab3/tab3.module').then(m => m.Tab3PageModule),
      },
      {
        // Pestaña 4 — Usuario (perfil de sesión, token JWT y cierre de sesión).
        path: 'tab4',
        loadChildren: () => import('../tab4/tab4.module').then(m => m.Tab4PageModule),
      },
      {
        path: '',
        redirectTo: 'tab1',
        pathMatch: 'full',
      },
    ],
  },
];
