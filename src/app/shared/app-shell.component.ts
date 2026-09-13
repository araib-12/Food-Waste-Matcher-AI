import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DemoDataService } from '../core/demo-data.service';
import { AppRole, NavItem } from '../core/models';
import { BrandComponent } from './brand.component';

@Component({
  selector: 'mp-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand"><mp-brand /></div>
        <div class="workspace-label">{{ workspaceLabel }}</div>
        <nav class="side-nav" aria-label="Workspace navigation">
          @for (item of nav; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active">
              <i [class]="'pi ' + item.icon"></i><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidebar-rescue-card">
          <i class="pi pi-heart"></i>
          <strong>Keep it simple.</strong>
          <span>Share clearly, connect directly, confirm the pickup.</span>
        </div>
        <div class="sidebar-profile">
          <span class="avatar">{{ initials }}</span>
          <div><strong>{{ auth.session()?.name }}</strong><small>{{ auth.session()?.organization }}</small></div>
          <button type="button" class="sidebar-logout" aria-label="Log out" title="Log out" (click)="logout()"><i class="pi pi-sign-out"></i></button>
        </div>
      </aside>

      <div class="app-stage">
        <header class="app-topbar">
          <button class="icon-button menu-button" aria-label="Open menu"><i class="pi pi-bars"></i></button>
          <div class="topbar-location"><i class="pi pi-map-marker"></i><span>{{ auth.session()?.area || 'Food Waste Matcher AI network' }}</span></div>
          <div class="topbar-actions">
            <span class="workspace-chip"><i class="pi pi-lock"></i>{{ workspaceLabel }}</span>
              <a class="icon-button" [routerLink]="'/' + role + '/notifications'" aria-label="Notifications"><i class="pi pi-bell"></i>@if (hasUnread) { <span class="notification-dot"></span> }</a>
            <button type="button" class="icon-button topbar-logout" aria-label="Log out" title="Log out" (click)="logout()"><i class="pi pi-sign-out"></i></button>
          </div>
        </header>
        <main class="app-main"><router-outlet /></main>
      </div>

      <nav class="mobile-nav" aria-label="Mobile navigation">
        @for (item of mobileNav; track item.route) {
          <a [routerLink]="item.route" routerLinkActive="active"><i [class]="'pi ' + item.icon"></i><span>{{ item.label }}</span></a>
        }
      </nav>
    </div>
  `
})
export class AppShellComponent implements OnInit {
  role: AppRole = 'partner';

  readonly roleNav: Record<AppRole, NavItem[]> = {
    partner: [
      { label: 'Overview', icon: 'pi-home', route: '/partner/dashboard' },
      { label: 'Post surplus food', icon: 'pi-plus-circle', route: '/partner/donations/new' },
      { label: 'Donation history', icon: 'pi-history', route: '/partner/donations/history' },
      { label: 'Profile', icon: 'pi-user', route: '/partner/profile' }
    ],
    ngo: [
      { label: 'Nearby food', icon: 'pi-compass', route: '/ngo/dashboard' },
      { label: 'Active pickups', icon: 'pi-shopping-bag', route: '/ngo/rescues/active' },
      { label: 'Pickup history', icon: 'pi-history', route: '/ngo/rescues/history' },
      { label: 'Profile', icon: 'pi-user', route: '/ngo/profile' }
    ],
    admin: [
      { label: 'Overview', icon: 'pi-home', route: '/admin/dashboard' },
      { label: 'Organizations', icon: 'pi-building', route: '/admin/organizations' },
      { label: 'Donations', icon: 'pi-box', route: '/admin/donations' }
    ]
  };

  constructor(public readonly auth: AuthService, public readonly data: DemoDataService, private readonly route: ActivatedRoute, private readonly router: Router) {}

  ngOnInit(): void {
    this.role = (this.route.snapshot.data['role'] as AppRole) ?? 'partner';
    void this.data.refresh();
  }

  get nav(): NavItem[] { return this.roleNav[this.role]; }
  get mobileNav(): NavItem[] { return this.nav.slice(0, 4); }
  get hasUnread(): boolean { return this.data.notifications().some((item) => item.unread); }
  get workspaceLabel(): string { return this.role === 'partner' ? 'FOOD PARTNER' : this.role === 'ngo' ? 'NGO WORKSPACE' : 'NETWORK ADMIN'; }
  get initials(): string { return (this.auth.session()?.name ?? 'MP').split(' ').map((part) => part[0]).join('').slice(0, 2); }
  async logout(): Promise<void> { await this.auth.signOut(); await this.router.navigate(['/login'], { queryParams: { role: this.role } }); }
}
