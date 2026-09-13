import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard, roleChildGuard, roleGuard, verifiedPartnerGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.LandingComponent),
    title: 'Food Waste Matcher AI — Ping surplus. Rescue meals.'
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.LoginComponent),
    title: 'Log in — Food Waste Matcher AI'
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.RegisterComponent),
    title: 'Join Food Waste Matcher AI'
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.LegalComponent),
    data: { legal: 'privacy' },
    title: 'Privacy — Food Waste Matcher AI'
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.LegalComponent),
    data: { legal: 'terms' },
    title: 'Terms — Food Waste Matcher AI'
  },
  {
    path: 'partner',
    canActivate: [authGuard, roleGuard],
    canActivateChild: [authChildGuard, roleChildGuard],
    loadComponent: () => import('./shared/app-shell.component').then((m) => m.AppShellComponent),
    data: { role: 'partner' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/partner/partner-pages.component').then((m) => m.PartnerDashboardComponent), title: 'Partner dashboard — Food Waste Matcher AI' },
      { path: 'donations/new', canActivate: [verifiedPartnerGuard], loadComponent: () => import('./pages/partner/partner-pages.component').then((m) => m.DonationWizardComponent), title: 'Create a Food Waste Matcher AI' },
      { path: 'donations/history', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'partner-history' }, title: 'Donation history' },
      { path: 'donations/:id', loadComponent: () => import('./pages/partner/partner-pages.component').then((m) => m.DonationDetailComponent), title: 'Donation details' },
      { path: 'outlets', redirectTo: 'profile' },
      { path: 'notifications', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'notifications' }, title: 'Notifications' },
      { path: 'profile', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'partner-profile' }, title: 'Profile' }
    ]
  },
  {
    path: 'ngo',
    canActivate: [authGuard, roleGuard],
    canActivateChild: [authChildGuard, roleChildGuard],
    loadComponent: () => import('./shared/app-shell.component').then((m) => m.AppShellComponent),
    data: { role: 'ngo' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/ngo/ngo-pages.component').then((m) => m.NgoDashboardComponent), title: 'NGO dashboard — Food Waste Matcher AI' },
      { path: 'opportunities/:id', loadComponent: () => import('./pages/ngo/ngo-pages.component').then((m) => m.OpportunityDetailComponent), title: 'Rescue opportunity' },
      { path: 'rescues/active', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'active-rescues' }, title: 'Active rescues' },
      { path: 'rescues/history', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'ngo-history' }, title: 'Rescue history' },
      { path: 'rescues/:id', loadComponent: () => import('./pages/ngo/ngo-pages.component').then((m) => m.RescueDetailComponent), title: 'Rescue details' },
      { path: 'notifications', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'notifications' }, title: 'Notifications' },
      { path: 'profile', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'ngo-profile' }, title: 'Profile' }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    canActivateChild: [authChildGuard, roleChildGuard],
    loadComponent: () => import('./shared/app-shell.component').then((m) => m.AppShellComponent),
    data: { role: 'admin' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/admin-pages.component').then((m) => m.AdminDashboardComponent), title: 'Operations dashboard — Food Waste Matcher AI' },
      { path: 'organizations', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'organizations' }, title: 'Organizations' },
      { path: 'organizations/:id', loadComponent: () => import('./pages/admin/admin-pages.component').then((m) => m.AdminOrganizationDetailComponent), title: 'Organization details — Food Waste Matcher AI' },
      { path: 'donations', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'admin-donations' }, title: 'All donations' },
      { path: 'donations/:id', loadComponent: () => import('./pages/admin/admin-pages.component').then((m) => m.AdminDonationDetailComponent), title: 'Donation details — Food Waste Matcher AI' },
      { path: 'notifications', loadComponent: () => import('./pages/shared/utility-page.component').then((m) => m.UtilityPageComponent), data: { view: 'notifications' }, title: 'Notifications' },
      { path: 'matches', redirectTo: 'donations' },
      { path: 'exceptions', redirectTo: 'dashboard' },
      { path: 'settings', redirectTo: 'dashboard' }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./pages/public/public-pages.component').then((m) => m.NotFoundComponent),
    title: 'Page not found — Food Waste Matcher AI'
  }
];
