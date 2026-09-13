import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DemoDataService } from '../../core/demo-data.service';
import type { Donation, OrganizationSummary } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="page-heading dashboard-heading"><div><span class="kicker">NETWORK ADMIN</span><h1>See the complete Food Waste Matcher AI flow.</h1><p>Every organization, food post, acceptance, rejection, and pickup status comes from the shared database.</p></div><a pButton routerLink="/admin/organizations" class="mp-button mp-button-dark"><i class="pi pi-building"></i> View organizations</a></div>

    @if (data.error()) { <div class="data-state error-state"><i class="pi pi-database"></i><div><strong>Shared database unavailable</strong><span>{{ data.error() }}</span></div><button class="subtle-button" (click)="reload()">Try again</button></div> }
    @else if (data.loading() && !data.initialized()) { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading network activity…</span></div> }

    @if (pendingOrganizations().length > 0) { <section class="admin-review-queue"><div><span class="kicker">ACTION REQUIRED</span><h2>{{ pendingOrganizations().length }} organization{{ pendingOrganizations().length === 1 ? '' : 's' }} waiting for review</h2><p>New accounts cannot post or receive food until you complete the manual verification check.</p><div class="admin-review-names">@for (organization of pendingOrganizations().slice(0, 3); track organization.id) { <a [routerLink]="['/admin/organizations', organization.id]"><span class="org-avatar small">{{ initials(organization.name) }}</span><span><strong>{{ organization.name }}</strong><small>{{ organization.role === 'partner' ? 'Food Partner' : 'NGO' }} · {{ organization.city }}</small></span><i class="pi pi-arrow-right"></i></a> }</div></div><a pButton routerLink="/admin/organizations" class="mp-button mp-button-light">Review accounts <i class="pi pi-arrow-right"></i></a></section> } @else if (data.initialized()) { <section class="admin-review-clear"><i class="pi pi-check-circle"></i><div><strong>All organization reviews are complete.</strong><span>There are no pending accounts to verify right now.</span></div></section> }

    <section class="stats-grid simple-stats admin-stats"><article><span class="stat-icon green"><i class="pi pi-verified"></i></span><div><small>Organizations</small><strong>{{ data.organizations().length }}</strong><span>{{ partnerCount() }} partners · {{ ngoCount() }} NGOs</span></div></article><article><span class="stat-icon green"><i class="pi pi-box"></i></span><div><small>Food available now</small><strong>{{ availableCount() }}</strong><span>Waiting for an NGO</span></div></article><article><span class="stat-icon blue"><i class="pi pi-bolt"></i></span><div><small>Acceptance rate</small><strong>{{ acceptanceRate() }}%</strong><span>{{ typicalAcceptanceTime() }}</span></div></article><article><span class="stat-icon coral"><i class="pi pi-heart-fill"></i></span><div><small>Completed pickups</small><strong>{{ completedCount() }}</strong><span>{{ data.completedMeals() }} meals rescued</span></div></article></section>

    <section class="admin-simple-grid"><article class="panel"><div class="panel-heading"><div><span class="kicker">LIVE DATABASE</span><h2>Recent food posts</h2></div><a routerLink="/admin/donations">View all</a></div><div class="donation-list">@for (item of data.donations().slice(0, 7); track item.id) { <div class="donation-row admin-donation-row"><span class="food-thumb"><i class="pi pi-box"></i></span><div class="donation-main"><strong>{{ item.foodName }}</strong><small>{{ item.meals }} meals · {{ item.partner }} · {{ item.area }}</small></div><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span><span class="donation-time">{{ item.pickupBy }}</span></div> } @if (data.initialized() && data.donations().length === 0) { <div class="inline-empty"><i class="pi pi-inbox"></i><span><strong>No food posts yet</strong>Restaurant activity will appear here.</span></div> }</div></article><aside class="panel verification-card"><div class="panel-heading"><div><span class="kicker">ORGANIZATION DIRECTORY</span><h2>Latest accounts</h2></div></div>@for (organization of data.organizations().slice(0, 5); track organization.id) { <div class="organization-mini-row"><span class="org-avatar">{{ initials(organization.name) }}</span><div><strong>{{ organization.name }}</strong><small>{{ organization.role === 'partner' ? 'Food Partner' : 'NGO' }} · {{ organization.area }}</small></div><span [class]="'status ' + organization.status">{{ organization.status }}</span></div> }<a pButton routerLink="/admin/organizations" class="mp-button mp-button-dark directory-link">Open directory</a></aside></section>
  `
})
export class AdminDashboardComponent {
  readonly partnerCount = computed(() => this.data.organizations().filter((item) => item.role === 'partner').length);
  readonly ngoCount = computed(() => this.data.organizations().filter((item) => item.role === 'ngo').length);
  readonly pendingOrganizations = computed(() => this.data.organizations().filter((item) => item.status === 'pending').sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()));
  readonly availableCount = computed(() => this.data.donations().filter((item) => item.status === 'Available').length);
  readonly completedCount = computed(() => this.data.donations().filter((item) => item.status === 'Completed').length);
  readonly acceptedCount = computed(() => this.data.donations().filter((item) => Boolean(item.acceptedAt)).length);
  readonly acceptanceRate = computed(() => {
    const total = this.data.donations().length;
    return total ? Math.round((this.acceptedCount() / total) * 100) : 0;
  });
  readonly typicalAcceptanceTime = computed(() => {
    const minutes = this.data.donations()
      .filter((item) => item.acceptedAt)
      .map((item) => Math.max(0, Math.round((new Date(item.acceptedAt!).valueOf() - new Date(item.createdAt).valueOf()) / 60000)))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!minutes.length) return 'Waiting for first acceptance';
    const middle = Math.floor(minutes.length / 2);
    const median = minutes.length % 2 ? minutes[middle] : Math.round((minutes[middle - 1] + minutes[middle]) / 2);
    return `${median} min median to accept`;
  });
  constructor(public readonly data: DemoDataService) {}
  reload(): void { void this.data.refresh(); }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
}

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    @if (organization(); as organization) {
      <a routerLink="/admin/organizations" class="back-link"><i class="pi pi-arrow-left"></i> Back to organizations</a>
      <div class="page-heading dashboard-heading admin-organization-heading"><div><span class="kicker">{{ organization.role === 'partner' ? 'FOOD PARTNER' : 'NGO / FOOD RESCUE GROUP' }}</span><h1>{{ organization.name }}</h1><p>{{ organization.contactName }} · {{ organization.city }}, {{ organization.state }}</p></div><span [class]="'status ' + organization.status"><i class="pi pi-verified"></i> {{ organization.status }}</span></div>

      @if (updateError()) { <div class="auth-error page-error"><i class="pi pi-exclamation-circle"></i>{{ updateError() }}</div> }

      <section class="admin-organization-detail-grid">
        <article class="panel admin-detail-card"><div class="panel-heading"><div><span class="kicker">CONTACT & LOCATION</span><h2>Registration details</h2></div></div><dl class="admin-detail-list"><div><dt>Primary contact</dt><dd>{{ organization.contactName }}</dd></div><div><dt>Work phone</dt><dd>{{ organization.contactPhone }}</dd></div><div class="wide"><dt>Street address</dt><dd>{{ organization.address }}</dd></div><div><dt>Local area</dt><dd>{{ organization.area }}</dd></div><div><dt>City & state</dt><dd>{{ organization.city }}, {{ organization.state }}</dd></div><div><dt>Pincode</dt><dd>{{ organization.pincode }}</dd></div></dl></article>

        <article class="panel admin-detail-card"><div class="panel-heading"><div><span class="kicker">{{ organization.role === 'partner' ? 'DONATION PROFILE' : 'PICKUP PROFILE' }}</span><h2>{{ organization.role === 'partner' ? 'Food Partner settings' : 'NGO matching settings' }}</h2></div></div><dl class="admin-detail-list">@if (organization.role === 'partner') { <div class="wide"><dt>Participation</dt><dd>Can post surplus food for nearby verified NGOs.</dd></div><div><dt>Organization type</dt><dd>Food Partner</dd></div><div><dt>Current status</dt><dd>{{ organization.status }}</dd></div> } @else { <div><dt>Accepting donations</dt><dd>{{ organization.acceptingDonations ? 'Yes' : 'No' }}</dd></div><div><dt>Pickup radius</dt><dd>{{ organization.serviceRadiusKm }} km</dd></div><div><dt>Maximum pickup</dt><dd>{{ organization.maxMealsPerPickup }} meals</dd></div><div><dt>Non-vegetarian food</dt><dd>{{ organization.acceptsNonVegetarian ? 'Accepted' : 'Not accepted' }}</dd></div> }</dl></article>

        <article class="panel admin-detail-card"><div class="panel-heading"><div><span class="kicker">ACCOUNT & VERIFICATION</span><h2>Admin review</h2></div></div><dl class="admin-detail-list"><div><dt>Organization ID</dt><dd class="breakable">{{ organization.id }}</dd></div><div><dt>Registered on</dt><dd>{{ formatDate(organization.createdAt) }}</dd></div><div class="wide"><dt>Verification state</dt><dd>{{ organization.status }}</dd></div></dl>@if (reviews()[0]; as review) { <div class="review-history-summary"><span>Latest review</span><strong>{{ review.newStatus }} · {{ formatDate(review.createdAt) }}</strong>@if (review.note) { <small>{{ review.note }}</small> }</div> }</article>
      </section>
      <section class="admin-verification-workflow"><article class="panel admin-verification-panel"><div class="panel-heading"><div><span class="kicker">MANUAL VERIFICATION</span><h2>Record the review decision</h2></div><a [href]="mapsSearchUrl(organization)" target="_blank" rel="noopener noreferrer" class="subtle-button"><i class="pi pi-map-marker"></i> Open in Google Maps</a></div><p>Maps is a review aid, not proof by itself. Keep a simple internal record so every approval is accountable.</p><div class="review-checklist"><label class="confirm-control compact"><input type="checkbox" [checked]="locationChecked()" (change)="locationChecked.set($any($event.target).checked)" /><span><strong>Location checked</strong><small>The name and address reasonably match the real pickup base.</small></span></label><label class="confirm-control compact"><input type="checkbox" [checked]="phoneChecked()" (change)="phoneChecked.set($any($event.target).checked)" /><span><strong>Phone confirmed</strong><small>The listed contact confirmed this organization can participate.</small></span></label><label class="confirm-control compact"><input type="checkbox" [checked]="evidenceChecked()" (change)="evidenceChecked.set($any($event.target).checked)" /><span><strong>Supporting evidence checked</strong><small>For example, a website, registration document, or storefront proof.</small></span></label></div><label class="admin-review-note">Review note <small>Shared with the organization if you suspend it—write clear next steps.</small><textarea rows="3" [value]="reviewNote()" (input)="reviewNote.set($any($event.target).value)" placeholder="For example: Please correct the pickup address and provide a working contact number."></textarea></label><div class="admin-detail-actions">@if (organization.status !== 'verified') { <button pButton type="button" class="mp-button mp-button-dark" (click)="review('verified')" [disabled]="updating() || !canVerify()"><i class="pi pi-verified"></i>{{ updating() ? 'Saving…' : 'Verify organization' }}</button> } @if (organization.status !== 'suspended') { <button pButton type="button" class="mp-button mp-button-ghost" (click)="review('suspended')" [disabled]="updating() || !reviewNote().trim()"><i class="pi pi-ban"></i>{{ updating() ? 'Saving…' : 'Suspend account' }}</button> }</div></article></section>
    } @else if (!data.initialized()) {
      <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading organization details…</span></div>
    } @else {
      <div class="data-state"><i class="pi pi-building"></i><span>This organization could not be found.</span><a routerLink="/admin/organizations" class="subtle-button">Back to directory</a></div>
    }
  `
})
export class AdminOrganizationDetailComponent {
  private readonly organizationId: string;
  readonly organization = computed(() => this.data.organizations().find((item) => item.id === this.organizationId) ?? null);
  readonly updating = signal(false);
  readonly updateError = signal('');
  readonly locationChecked = signal(false);
  readonly phoneChecked = signal(false);
  readonly evidenceChecked = signal(false);
  readonly reviewNote = signal('');

  constructor(route: ActivatedRoute, public readonly data: DemoDataService) {
    this.organizationId = route.snapshot.paramMap.get('id') ?? '';
    effect(() => {
      if (this.data.initialized() && this.organizationId) void this.data.loadOrganizationReviewHistory(this.organizationId).catch(() => null);
    });
  }

  canVerify(): boolean { return this.locationChecked() && this.phoneChecked() && this.evidenceChecked(); }
  reviews() { return this.data.organizationReviews()[this.organizationId] ?? []; }

  async review(status: Extract<OrganizationSummary['status'], 'verified' | 'suspended'>): Promise<void> {
    if (status === 'verified' && !this.canVerify()) { this.updateError.set('Complete all three checks before verifying this organization.'); return; }
    if (status === 'suspended' && !this.reviewNote().trim()) { this.updateError.set('Add a review note before suspending this organization.'); return; }
    this.updating.set(true);
    this.updateError.set('');
    try {
      await this.data.reviewOrganization({ organizationId: this.organizationId, status, locationConfirmed: this.locationChecked(), phoneConfirmed: this.phoneChecked(), evidenceConfirmed: this.evidenceChecked(), note: this.reviewNote() });
      this.reviewNote.set('');
    } catch (error) {
      this.updateError.set(error instanceof Error ? error.message : 'Unable to update organization status.');
    } finally {
      this.updating.set(false);
    }
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Not available' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  mapsSearchUrl(organization: OrganizationSummary): string {
    const query = [organization.name, organization.address, organization.area, organization.city, organization.state, organization.pincode, 'India']
      .filter(Boolean)
      .join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (donation(); as item) {
      <div class="detail-top"><a routerLink="/admin/donations" class="back-link"><i class="pi pi-arrow-left"></i> Back to donations</a><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span></div>
      <div class="page-heading detail-heading"><div><span class="kicker">FOOD POST · {{ item.id }}</span><h1>{{ item.foodName }}</h1><p>{{ item.meals }} meals from {{ item.outlet }}</p></div></div>

      <section class="simple-detail-grid admin-donation-detail-grid"><div class="detail-main"><article class="panel"><div class="panel-heading"><div><span class="kicker">FOOD DETAILS</span><h2>Donation information</h2></div></div><div class="food-detail-hero"><span class="food-visual large"><i class="pi pi-box"></i></span><div><h3>{{ item.foodName }}</h3><p>{{ item.notes || 'No handling notes were provided with this donation.' }}</p></div><strong>{{ item.meals }}<small>meals</small></strong></div><div class="detail-facts four"><div><span>Category</span><strong>{{ item.category }}</strong></div><div><span>Dietary</span><strong>{{ item.dietary }}</strong></div><div><span>Prepared</span><strong>{{ item.preparedAt }}</strong></div><div><span>Pickup by</span><strong>{{ item.pickupBy }}</strong></div></div></article><article class="panel pickup-location-card"><span class="location-icon"><i class="pi pi-map-marker"></i></span><div><span class="kicker">PICKUP LOCATION</span><h2>{{ item.outlet }}</h2><p>{{ item.address }}, {{ item.area }}, {{ item.city }}, {{ item.state }} · {{ item.pincode }}</p></div></article></div><aside class="panel pickup-summary-card"><span class="kicker">NETWORK ACTIVITY</span><h2>Current record</h2><dl><div><dt>Status</dt><dd>{{ item.status }}</dd></div><div><dt>Food Partner</dt><dd><a [routerLink]="['/admin/organizations', item.partnerOrganizationId]" class="admin-record-link">{{ item.partner }}</a></dd></div><div><dt>Assigned NGO</dt><dd>@if (item.acceptedOrganizationId) { <a [routerLink]="['/admin/organizations', item.acceptedOrganizationId]" class="admin-record-link">{{ item.ngo }}</a> } @else { Waiting for NGO }</dd></div><div><dt>Created on</dt><dd>{{ formatDate(item.createdAt) }}</dd></div></dl></aside></section>
    } @else if (data.initialized()) {
      <div class="data-state error-state"><i class="pi pi-search"></i><div><strong>Donation not found</strong><span>This food post may have been removed.</span></div><a routerLink="/admin/donations" class="subtle-button">Back to donations</a></div>
    } @else {
      <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading donation details…</span></div>
    }
  `
})
export class AdminDonationDetailComponent {
  private readonly donationId: string;
  readonly donation = computed(() => this.data.findDonation(this.donationId));

  constructor(route: ActivatedRoute, public readonly data: DemoDataService) {
    this.donationId = route.snapshot.paramMap.get('id') ?? '';
  }

  statusClass(status: Donation['status']): string { return status.toLowerCase().replaceAll(' ', '-'); }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Not available' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
