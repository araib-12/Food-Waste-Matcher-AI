import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../core/auth.service';
import { BrandComponent } from './brand.component';

@Component({
  selector: 'mp-public-header',
  standalone: true,
  imports: [RouterLink, ButtonModule, BrandComponent],
  template: `
    <header class="public-header network-header">
      <div class="public-nav page-width">
        <mp-brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#businesses">For food partners</a>
          <a href="#ngos">For NGOs</a>
          <a href="#safety">Safety</a>
        </nav>
        <div class="header-actions">
          @if (auth.session(); as session) {
            <span class="text-link hide-mobile">{{ session.organization }}</span>
            <a pButton [routerLink]="auth.homeForRole(session.role)" class="mp-button mp-button-dark workspace-header-action">Open workspace <i class="pi pi-arrow-right"></i></a>
          } @else {
            <a class="text-link hide-mobile" routerLink="/login">Log in</a>
            <a pButton routerLink="/register" class="mp-button network-cta network-cta-header">Join Food Waste Matcher AI <i class="pi pi-arrow-up-right"></i></a>
          }
        </div>
      </div>
    </header>
  `
})
export class PublicHeaderComponent {
  constructor(public readonly auth: AuthService) {}
}
