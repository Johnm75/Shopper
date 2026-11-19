/**
 * Definición raíz de rutas de "App Shoper" con carga perezosa y guardas JWT.
 *
 * La ruta raíz redirige a `/login` (punto de entrada obligatorio de la app)
 * y `/tabs` aloja el contenedor de las tres pestañas del dominio comercial:
 * Catálogo/Inventario (tab1), Carrito (tab2) y Mis Compras/Pedidos (tab3).
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-016)
 */

import type { Routes } from '@angular/router';

// Guarda que exige sesión JWT vigente para entrar al área privada `/tabs`.
import { authenticatedRouteGuard } from './guards/auth.guard';
// Guarda que impide reabrir `/login` cuando ya existe una sesión activa.
import { unauthenticatedOnlyGuard } from './guards/guest.guard';

/**
 * Mapa principal de rutas de la aplicación.
 *
 * Orden de evaluación de Angular: la primera coincidencia gana; el comodín
 * final captura cualquier URL desconocida y la devuelve al inicio de sesión.
 */
export const appRoutes: Routes = [
  {
    // Ruta raíz: `App Shoper` arranca SIEMPRE en el inicio de sesión; si la
    // sesión persiste en `@capacitor/preferences`, el guarda de invitados
    // (`unauthenticatedOnlyGuard`) redirige automáticamente a `/tabs`.
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    // Vista pública de autenticación JWT con selector de rol inicial
    // (Cliente | Vendedor) y botones de autocompletado rápido demostrativo.
    path: 'login',
    canActivate: [unauthenticatedOnlyGuard],
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule),
  },
  {
    // Contenedor autenticado de las tres pestañas principales del dominio;
    // solo es alcanzable con una sesión activa (token remoto u offline).
    path: 'tabs',
    canActivate: [authenticatedRouteGuard],
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    // Comodín de seguridad: cualquier ruta inexistente (typo o enlace roto)
    // regresa al flujo de autenticación sin dejar una pantalla en blanco.
    path: '**',
    redirectTo: 'login',
  },
];
