import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanActivateChildFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { AppRole } from './models';

function expectedRole(route: ActivatedRouteSnapshot): AppRole | null {
  return (route.data['role'] ?? route.parent?.data['role']) as AppRole | null;
}

export const authGuard: CanActivateFn = (route, state) => checkAuthenticated(route, state);
export const authChildGuard: CanActivateChildFn = (route, state) => checkAuthenticated(route, state);

async function checkAuthenticated(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | ReturnType<Router['createUrlTree']>> {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  if (auth.session()) return true;
  return router.createUrlTree(['/login'], { queryParams: { role: expectedRole(route) ?? 'partner', returnUrl: state.url } });
}

export const roleGuard: CanActivateFn = (route) => checkRole(route);
export const roleChildGuard: CanActivateChildFn = (route) => checkRole(route);

export const verifiedPartnerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  const session = auth.session();
  if (session?.role === 'partner' && session.organizationStatus === 'verified') return true;
  return router.createUrlTree(['/partner/dashboard']);
};

async function checkRole(route: ActivatedRouteSnapshot): Promise<boolean | ReturnType<Router['createUrlTree']>> {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  const session = auth.session();
  const role = expectedRole(route);
  if (!session) return router.createUrlTree(['/login'], { queryParams: { role: role ?? 'partner' } });
  if (!role || session.role === role) return true;
  return router.createUrlTree([auth.homeForRole(session.role)]);
}

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  const session = auth.session();
  return session ? router.createUrlTree([auth.homeForRole(session.role)]) : true;
};
