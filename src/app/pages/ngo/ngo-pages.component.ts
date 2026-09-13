import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth.service';
import { DemoDataService } from '../../core/demo-data.service';
import { Donation } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="page-heading dashboard-heading"><div><span class="kicker">NGO WORKSPACE</span><h1>Food available near {{ auth.session()?.city }}.</h1><p>Verified opportunities inside your {{ auth.session()?.serviceRadiusKm }} km radius, filtered to your capacity and food preference.</p></div><div class="capacity-toggle"><span><i [class.off]="!auth.session()?.acceptingDonations"></i><strong>{{ auth.session()?.acceptingDonations ? 'Accepting pickups' : 'Pickup alerts paused' }}</strong><small>{{ auth.session()?.organization }}</small></span><button type="button" class="toggle" [class.active]="auth.session()?.acceptingDonations" [attr.aria-label]="auth.session()?.acceptingDonations ? 'Pause new pickup alerts' : 'Resume new pickup alerts'" (click)="toggleAvailability()" [disabled]="availabilityLoading()"><i></i></button></div></div>

    @if (auth.session()?.organizationStatus === 'suspended') { <section class="data-state warning-state"><i class="pi pi-exclamation-triangle"></i><div><strong>Your review needs changes.</strong><span>An admin paused this account. Check your notifications, correct the details, and request another review.</span></div><a routerLink="/ngo/profile" class="subtle-button">Update details <i class="pi pi-arrow-right"></i></a></section> } @else if (auth.session()?.organizationStatus !== 'verified') { <div class="data-state warning-state"><i class="pi pi-shield"></i><div><strong>Verification pending</strong><span>An admin is reviewing your NGO. Nearby food opportunities will appear after verification.</span></div></div> } @else { <section class="data-state verification-success"><i class="pi pi-verified"></i><div><strong>Your NGO is verified.</strong><span>Nearby food that fits your radius, capacity and food preference can now appear here.</span></div></section> }
    @if (availabilityError()) { <div class="auth-error page-error"><i class="pi pi-exclamation-circle"></i>{{ availabilityError() }}</div> }

    @if (data.error()) { <div class="data-state error-state"><i class="pi pi-database"></i><div><strong>Shared database unavailable</strong><span>{{ data.error() }}</span></div><button class="subtle-button" (click)="reload()">Try again</button></div> }
    @else if (data.loading() && !data.initialized()) { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading food posts in your area…</span></div> }

    @if (opportunities()[0]; as first) { <section class="ngo-alert"><i class="pi pi-bell"></i><div><strong>Food available · {{ first.area }}</strong><span>{{ first.meals }} {{ first.dietary.toLowerCase() }} meals · Pickup by {{ first.pickupBy }}</span></div><span>New</span><a pButton [routerLink]="'/ngo/opportunities/' + first.id" class="mp-button mp-button-light">View details</a></section> }

    <section class="stats-grid simple-stats"><article><span class="stat-icon coral"><i class="pi pi-compass"></i></span><div><small>Available in your area</small><strong>{{ opportunities().length }}</strong><span>Live database records</span></div></article><article><span class="stat-icon green"><i class="pi pi-shopping-bag"></i></span><div><small>Active pickups</small><strong>{{ activePickups().length }}</strong><span>Accepted by your NGO</span></div></article><article><span class="stat-icon green"><i class="pi pi-heart-fill"></i></span><div><small>Meals collected</small><strong>{{ data.completedMeals() }}</strong><span>Completed pickups</span></div></article></section>

    <div class="opportunity-heading"><div><span class="kicker">AVAILABLE NOW</span><h2>Eligible food near {{ auth.session()?.city }}</h2></div><span class="soft-chip">{{ auth.session()?.serviceRadiusKm }} km radius</span></div>
    <section class="opportunity-grid simple-opportunities">
      @for (item of opportunities(); track item.id) { <article class="opportunity-card"><div class="op-card-top"><span class="distance-chip"><i class="pi pi-map-marker"></i>{{ distanceLabel(item) }}</span><span class="time-left"><i class="pi pi-clock"></i> {{ item.pickupBy }}</span></div><span class="food-visual"><i class="pi pi-box"></i></span><h3>{{ item.foodName }}</h3><p class="meal-count">{{ item.meals }} meals · {{ item.dietary }}</p><div class="op-facts"><span><i class="pi pi-shop"></i><b>{{ item.outlet }}</b></span><span><i class="pi pi-map-marker"></i>{{ item.address }}, {{ item.pincode }}</span></div><a pButton [routerLink]="'/ngo/opportunities/' + item.id" class="mp-button mp-button-dark mp-button-block">Accept or decline <i class="pi pi-arrow-right"></i></a></article> }
      @if (data.initialized() && opportunities().length === 0) { <article class="empty-list-card"><i class="pi pi-check-circle"></i><h3>No eligible food right now</h3><p>{{ auth.session()?.acceptingDonations ? 'New posts matching your radius and capacity will appear automatically.' : 'Resume pickup alerts when your team is ready.' }}</p></article> }
    </section>

    @if (activePickups()[0]; as active) { <section class="active-pickup-card"><div><span [class]="'status ' + statusClass(active.status)">{{ active.status }}</span><h2>{{ active.foodName }} · {{ active.meals }} meals</h2><p>Accepted from {{ active.outlet }}. Open the pickup to view secure contact details.</p></div><div class="direct-mini-contact"><span class="avatar">{{ initials(active.partner) }}</span><div><strong>{{ active.partner }}</strong><small>Food partner</small></div><a [routerLink]="'/ngo/rescues/' + active.id" aria-label="Open food partner contact"><i class="pi pi-phone"></i></a></div><a pButton [routerLink]="'/ngo/rescues/' + active.id" class="mp-button mp-button-dark">Open pickup</a></section> }
  `
})
export class NgoDashboardComponent {
  readonly opportunities = computed(() => this.data.donations().filter((item) => item.status === 'Available'));
  readonly activePickups = computed(() => this.data.donations().filter((item) => item.status === 'Accepted' || item.status === 'Picked Up'));
  readonly availabilityLoading = signal(false);
  readonly availabilityError = signal('');
  constructor(public readonly data: DemoDataService, public readonly auth: AuthService) {}
  reload(): void { void this.data.refresh(); }
  async toggleAvailability(): Promise<void> { this.availabilityLoading.set(true); this.availabilityError.set(''); try { await this.data.setNgoAvailability(!this.auth.session()?.acceptingDonations); } catch (error) { this.availabilityError.set(error instanceof Error ? error.message : 'Unable to update pickup availability.'); } finally { this.availabilityLoading.set(false); } }
  distanceLabel(item: Donation): string { return item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km away` : item.matchBasis === 'pincode' ? `Same pincode · ${item.pincode}` : item.area; }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
}

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    @if (outcome() === 'rejected') { <section class="success-state accept-success"><span class="success-orbit neutral-orbit"><i class="pi pi-check"></i></span><span class="kicker">FOOD DECLINED</span><h1>Removed from your opportunity list.</h1><p>Other NGOs in the same area can still accept this food.</p><a pButton routerLink="/ngo/dashboard" class="mp-button mp-button-dark">Back to nearby food</a></section> }
    @else if (donation(); as item) {
      <div class="detail-top"><a routerLink="/ngo/dashboard" class="back-link"><i class="pi pi-arrow-left"></i> Nearby food</a><span class="time-left urgent"><i class="pi pi-clock"></i> Pickup by {{ item.pickupBy }}</span></div>
      @if (outcome() !== 'accepted' && item.status === 'Available') {
        <div class="page-heading opportunity-title"><div><span class="distance-chip"><i class="pi pi-map-marker"></i>{{ distanceLabel(item) }}</span><h1>{{ item.foodName }}</h1><p>{{ item.meals }} meals · {{ item.dietary }} · {{ item.outlet }}</p></div><span class="verified-donor"><i class="pi pi-verified"></i><span><strong>{{ item.partner }}</strong><small>Verified food partner in {{ item.city }}</small></span></span></div>
        <section class="simple-detail-grid opportunity-simple-grid"><div class="detail-main"><article class="panel"><div class="panel-heading"><div><span class="kicker">FOOD DETAILS</span><h2>What is available</h2></div><span class="human-badge"><i class="pi pi-user-edit"></i> Donor confirmed</span></div><div class="food-detail-hero"><span class="food-visual large"><i class="pi pi-box"></i></span><div><h3>{{ item.foodName }}</h3><p>{{ item.notes || 'No additional handling notes were provided.' }}</p></div><strong>{{ item.meals }}<small>meals</small></strong></div><div class="detail-facts four"><div><span>Dietary</span><strong>{{ item.dietary }}</strong></div><div><span>Category</span><strong>{{ item.category }}</strong></div><div><span>Prepared</span><strong>{{ item.preparedAt }}</strong></div><div><span>Pickup by</span><strong>{{ item.pickupBy }}</strong></div></div></article><article class="panel pickup-location-card"><span class="location-icon"><i class="pi pi-map-marker"></i></span><div><span class="kicker">PICKUP LOCATION</span><h2>{{ item.outlet }}</h2><p>{{ item.address }}, {{ item.city }} · {{ item.pincode }}</p></div></article></div><aside class="accept-panel simple-accept-panel"><span class="kicker">YOUR DECISION</span><h2>Can your team collect this food?</h2><dl><div><dt>Distance</dt><dd>{{ distanceLabel(item) }}</dd></div><div><dt>Pickup deadline</dt><dd>{{ item.pickupBy }}</dd></div><div><dt>Quantity</dt><dd>{{ item.meals }} meals</dd></div></dl><label class="confirm-control compact"><input type="checkbox" [checked]="capacityConfirmed()" (change)="capacityConfirmed.set($any($event.target).checked)" /><span><strong>We have capacity</strong><small>Our team can collect and use this food before the deadline.</small></span></label>@if (error()) { <div class="auth-error"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }<button pButton class="mp-button mp-button-dark mp-button-block" (click)="accept()" [disabled]="actionLoading() || !capacityConfirmed()">Accept food <i class="pi pi-arrow-right"></i></button><button class="subtle-button mp-button-block" (click)="reject()" [disabled]="actionLoading()">Decline for my NGO</button><p class="fine-print"><i class="pi pi-shield"></i> Declining only removes this post from your NGO’s list.</p></aside></section>
      } @else {
        <section class="success-state accept-success"><span class="success-orbit"><i class="pi pi-check"></i></span><span class="kicker">FOOD ACCEPTED</span><h1>Contact the food partner.</h1><p>The database has assigned this pickup to {{ auth.session()?.organization }}. Both organizations can now see direct contact details.</p>@if (contact(); as person) { <div class="handoff-card"><span class="avatar coral-avatar">{{ initials(person.organizationName) }}</span><div><strong>{{ person.fullName }} · {{ person.organizationName }}</strong><span>{{ person.email }} · {{ person.phone }}</span></div><a [href]="'tel:' + person.phone" class="contact-button dark"><i class="pi pi-phone"></i> Call</a></div> }<div class="success-actions"><a pButton [routerLink]="'/ngo/rescues/' + item.id" class="mp-button mp-button-dark">Open pickup <i class="pi pi-arrow-right"></i></a><a pButton routerLink="/ngo/dashboard" class="mp-button mp-button-ghost">Back to nearby food</a></div></section>
      }
    } @else if (data.initialized()) { <div class="data-state error-state"><i class="pi pi-search"></i><div><strong>Food post unavailable</strong><span>It may have been accepted, declined, or removed.</span></div><a routerLink="/ngo/dashboard" class="subtle-button">Back to nearby food</a></div> } @else { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading food post…</span></div> }
  `
})
export class OpportunityDetailComponent {
  private readonly donationId: string;
  readonly donation = computed(() => this.data.findDonation(this.donationId));
  readonly contact = computed(() => this.data.contactFor(this.donationId));
  readonly outcome = signal<'accepted' | 'rejected' | null>(null);
  readonly actionLoading = signal(false);
  readonly capacityConfirmed = signal(false);
  readonly error = signal('');
  constructor(route: ActivatedRoute, public readonly data: DemoDataService, public readonly auth: AuthService) {
    this.donationId = route.snapshot.paramMap.get('id') ?? '';
    effect(() => { const item = this.donation(); if (item?.acceptedOrganizationId) void this.data.loadContact(item.id).catch(() => null); });
  }
  distanceLabel(item: Donation): string { return item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km away` : item.matchBasis === 'pincode' ? `Same pincode · ${item.pincode}` : item.area; }
  async accept(): Promise<void> { this.actionLoading.set(true); this.error.set(''); try { await this.data.acceptDonation(this.donationId); this.outcome.set('accepted'); await this.data.loadContact(this.donationId); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to accept this food.'); } finally { this.actionLoading.set(false); } }
  async reject(): Promise<void> { this.actionLoading.set(true); this.error.set(''); try { await this.data.rejectDonation(this.donationId); this.outcome.set('rejected'); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to decline this food.'); } finally { this.actionLoading.set(false); } }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
}

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    @if (donation(); as item) {
      <div class="detail-top"><a routerLink="/ngo/rescues/active" class="back-link"><i class="pi pi-arrow-left"></i> Active pickups</a><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span></div><div class="page-heading detail-heading"><div><span class="kicker">{{ item.id }}</span><h1>{{ item.foodName }}</h1><p>{{ item.meals }} meals from {{ item.outlet }}</p></div></div>
      <section class="simple-status-card panel ngo-status-action"><div><span class="kicker">CURRENT STEP</span><h2>{{ actionTitle(item) }}</h2><p>{{ actionCopy(item) }}</p></div>@if (item.status === 'Accepted') { <button pButton class="mp-button mp-button-dark mp-button-lg" (click)="markPickedUp()" [disabled]="actionLoading()">Mark food as collected <i class="pi pi-check"></i></button> } @else if (item.status === 'Picked Up') { <span class="waiting-confirmation"><i class="pi pi-clock"></i> Waiting for partner confirmation</span> } @else { <span class="success-inline"><i class="pi pi-check-circle"></i> Pickup complete</span> }</section>
      @if (error()) { <div class="auth-error page-error"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }
      <section class="simple-detail-grid"><div class="detail-main"><article class="panel direct-contact-panel"><div class="panel-heading"><div><span class="kicker">FOOD PARTNER CONTACT</span><h2>Coordinate directly</h2></div></div>@if (contact(); as person) { <div class="direct-contact-row"><span class="avatar coral-avatar">{{ initials(person.organizationName) }}</span><div><strong>{{ person.fullName }}</strong><small>{{ person.organizationName }}</small><span>{{ person.email }}</span></div><a [href]="'tel:' + person.phone" class="contact-button dark"><i class="pi pi-phone"></i> Call</a><a [href]="'sms:' + person.phone" class="subtle-button"><i class="pi pi-comment"></i> Message</a></div> } @else { <div class="inline-empty"><i class="pi pi-spin pi-spinner"></i><span>Loading secure contact…</span></div> }</article><article class="panel"><div class="panel-heading"><div><span class="kicker">PICKUP CHECK</span><h2>Inspect before collecting</h2></div></div><ul class="pickup-checklist"><li><i class="pi pi-check-circle"></i><span><strong>Details are reasonably accurate</strong>Food type and quantity match the post.</span></li><li><i class="pi pi-check-circle"></i><span><strong>Packaging looks suitable</strong>No visible leaks, contamination, or unsafe handling.</span></li><li><i class="pi pi-check-circle"></i><span><strong>Your team can use the food</strong>It fits your organization’s own policy.</span></li></ul><p class="policy-note">Food Waste Matcher AI does not certify food safety. Your organization can decline at pickup.</p></article></div><aside class="panel pickup-summary-card"><span class="kicker">PICKUP SUMMARY</span><h2>{{ item.meals }} meals</h2><dl><div><dt>Food</dt><dd>{{ item.foodName }}</dd></div><div><dt>Dietary</dt><dd>{{ item.dietary }}</dd></div><div><dt>Pickup by</dt><dd>{{ item.pickupBy }}</dd></div><div><dt>Area</dt><dd>{{ item.area }}</dd></div></dl></aside></section>
    } @else if (data.initialized()) { <div class="data-state error-state"><i class="pi pi-search"></i><div><strong>Pickup not found</strong><span>This record is not assigned to your NGO.</span></div><a routerLink="/ngo/dashboard" class="subtle-button">Back to dashboard</a></div> } @else { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading pickup…</span></div> }
  `
})
export class RescueDetailComponent {
  private readonly donationId: string;
  readonly donation = computed(() => this.data.findDonation(this.donationId));
  readonly contact = computed(() => this.data.contactFor(this.donationId));
  readonly actionLoading = signal(false);
  readonly error = signal('');
  constructor(route: ActivatedRoute, public readonly data: DemoDataService) {
    this.donationId = route.snapshot.paramMap.get('id') ?? '';
    effect(() => { const item = this.donation(); if (item?.acceptedOrganizationId) void this.data.loadContact(item.id).catch((error) => this.error.set(error instanceof Error ? error.message : 'Unable to load contact.')); });
  }
  actionTitle(item: Donation): string { return item.status === 'Accepted' ? 'Collect the food and update the partner.' : item.status === 'Picked Up' ? 'Food collected.' : 'Pickup completed.'; }
  actionCopy(item: Donation): string { return item.status === 'Accepted' ? 'Call the partner, inspect the food, and mark it collected.' : item.status === 'Picked Up' ? 'The food partner can now confirm the handoff.' : 'This pickup is closed and included in both organizations’ impact.'; }
  async markPickedUp(): Promise<void> { this.actionLoading.set(true); this.error.set(''); try { await this.data.setStatus(this.donationId, 'Picked Up'); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to update pickup.'); } finally { this.actionLoading.set(false); } }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
}
