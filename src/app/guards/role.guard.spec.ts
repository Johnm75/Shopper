/**
 * Pruebas unitarias de `customerOnlyGuard`.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-18
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { customerOnlyGuard } from './role.guard';
import { JwtAuthenticationService } from '../services/auth-jwt.service';
import type { UserRole } from '../models/shoper.model';

describe('customerOnlyGuard', () => {
  let activeRoleSignal: ReturnType<typeof signal<UserRole>>;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    activeRoleSignal = signal<UserRole>('customer');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: JwtAuthenticationService,
          useValue: { activeRole: activeRoleSignal },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('debe permitir el acceso a /tabs/tab2 cuando el rol activo es customer', () => {
    activeRoleSignal.set('customer');
    const result = TestBed.runInInjectionContext(() =>
      customerOnlyGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('debe redirigir a /tabs/tab1 cuando el rol activo es seller', () => {
    activeRoleSignal.set('seller');
    const result = TestBed.runInInjectionContext(() =>
      customerOnlyGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/tabs/tab1');
  });
});
