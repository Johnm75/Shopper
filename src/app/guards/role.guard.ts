/**
 * Guarda funcional de rol para las pestañas exclusivas de Cliente.
 *
 * Impide que una sesión iniciada como Tienda/Vendedor (`seller`) acceda a
 * rutas exclusivas del flujo de compra (como `/tabs/tab2` Carrito),
 * redirigiendo al inventario (`/tabs/tab1`).
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { JwtAuthenticationService } from '../services/auth-jwt.service';

export const customerOnlyGuard: CanActivateFn = () => {
  const authenticationService = inject(JwtAuthenticationService);
  const router = inject(Router);

  if (authenticationService.activeRole() === 'customer') {
    return true;
  }

  return router.parseUrl('/tabs/tab1');
};
