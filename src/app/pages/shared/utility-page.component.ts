import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/auth.service';
import { DemoDataService } from '../../core/demo-data.service';
import { AppNotification } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule, InputTextModule, ReactiveFormsModule, NgTemplateOutlet],
  template: `
    @switch (view) {
      @case ('partner-history') { <ng-container *ngTemplateOutlet="history; context: { ngo: false }" /> }
      @case ('ngo-history') { <ng-container *ngTemplateOutlet="history; context: { ngo: true }" /> }
      @case ('active-rescues') {
        <div class="page-heading"><div><span class="kicker">ACTIVE PICKUPS</span><h1>Food your NGO accepted</h1><p>These records are assigned to {{ auth.session()?.organization }} in the shared database.</p></div><span class="soft-chip">{{ activeForNgo().length }} active</span></div>
        <section class="active-rescues-list">@for (item of activeForNgo(); track item.id) {<article class="active-rescue-card"><div class="active-rescue-status"><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span><span>Pickup by {{ item.pickupBy }}</span></div><div class="active-rescue-main"><span class="food-visual"><i class="pi pi-box"></i></span><div><h2>{{ item.foodName }}</h2><p>{{ item.meals }} meals · {{ item.outlet }}</p><div class="rescue-route"><span><i class="pi pi-phone"></i>Secure contact available</span></div></div><a pButton [routerLink]="'/ngo/rescues/' + item.id" class="mp-button mp-button-dark">Open pickup</a></div><div class="active-rescue-footer"><span><b>Food partner</b> {{ item.partner }}</span><span><b>Area</b> {{ item.area }}</span></div></article>} @if (data.initialized() && activeForNgo().length === 0) {<div class="data-state"><i class="pi pi-inbox"></i><span>No active pickups for this NGO.</span></div>}</section>
      }
      @case ('notifications') {
        <div class="page-heading dashboard-heading"><div><span class="kicker">DATABASE UPDATES</span><h1>Notifications</h1><p>New food posts, acceptances, expiry alerts, and pickup confirmations.</p></div></div><section class="notification-list simple-notification-list">@for (note of data.notifications(); track note.id) {<a [routerLink]="notificationTarget(note)" class="notification-entry" [class.unread]="note.unread" (click)="markRead(note.id)"><span [class]="'notification-icon ' + note.tone"><i [class]="notificationIcon(note.tone)"></i></span><div><h3>{{ note.title }}</h3><p>{{ note.body }}</p><small>{{ note.time }}</small></div><i class="pi pi-chevron-right notification-chevron"></i></a>} @if (data.initialized() && data.notifications().length === 0) {<div class="data-state"><i class="pi pi-bell"></i><span>No notifications yet.</span></div>}</section>
      }
      @case ('partner-profile') { <ng-container *ngTemplateOutlet="profile; context: { ngo: false }" /> }
      @case ('ngo-profile') { <ng-container *ngTemplateOutlet="profile; context: { ngo: true }" /> }
      @case ('organizations') {
        <ng-container *ngTemplateOutlet="adminOrganizations" />
      }
      @case ('admin-donations') {
        <ng-container *ngTemplateOutlet="adminTable; context: { kind: 'donations' }" />
      }
    }

    <ng-template #history let-ngo="ngo"><div class="page-heading dashboard-heading"><div><span class="kicker">{{ ngo ? 'PICKUP HISTORY' : 'DONATION HISTORY' }}</span><h1>{{ ngo ? 'Your NGO pickups' : 'Your food posts' }}</h1><p>Role-protected records loaded from the shared database.</p></div></div><section class="table-panel"><div class="data-table"><div class="table-row table-head"><span>Food post</span><span>Meals</span><span>{{ ngo ? 'Food partner' : 'NGO' }}</span><span>Pickup by</span><span>Status</span><span></span></div>@for (item of data.donations(); track item.id) {<a class="table-row" [routerLink]="ngo ? '/ngo/rescues/' + item.id : '/partner/donations/' + item.id"><span><strong>{{ item.foodName }}</strong><small>{{ item.id }}</small></span><span>{{ item.meals }}</span><span>{{ ngo ? item.partner : (item.ngo ?? 'Waiting for NGO') }}</span><span>{{ item.pickupBy }}</span><span><b [class]="'status ' + statusClass(item.status)">{{ item.status }}</b></span><span><i class="pi pi-chevron-right"></i></span></a>}</div><div class="table-footer"><span>Showing {{ data.donations().length }} database records</span></div></section></ng-template>

    <ng-template #profile let-ngo="ngo">
      <div class="page-heading dashboard-heading"><div><span class="kicker">ORGANIZATION PROFILE</span><h1>{{ auth.session()?.organization }}</h1><p>Your authenticated organization and matching settings.</p></div><span [class]="'status ' + (auth.session()?.organizationStatus === 'verified' ? 'completed' : 'published')"><i class="pi pi-verified"></i> {{ auth.session()?.organizationStatus }}</span></div>
      @if (auth.session()?.organizationStatus === 'suspended') { <section class="data-state warning-state profile-review-alert"><i class="pi pi-exclamation-triangle"></i><div><strong>Your review needs changes.</strong><span>Read the notification from Food Waste Matcher AI, correct the details below, then request another review.</span></div><button type="button" class="subtle-button" (click)="startEditing()">Update details</button></section> }
      <section class="profile-content simple-profile"><article class="panel profile-identity"><span class="org-avatar">{{ initials(auth.session()?.organization || 'MP') }}</span><div><h2>{{ auth.session()?.organization }}</h2><p>{{ ngo ? 'NGO / food rescue group' : 'Food Partner' }} · {{ auth.session()?.area }}, {{ auth.session()?.city }}</p></div></article><article class="panel"><div class="panel-heading"><div><span class="kicker">CONTACT & LOCATION</span><h2>Account details</h2></div><button type="button" class="subtle-button" (click)="startEditing()"><i class="pi pi-pencil"></i> Edit details</button></div><div class="profile-fields"><div><span>Primary contact</span><strong>{{ auth.session()?.name }}</strong></div><div><span>Phone</span><strong>{{ auth.session()?.phone }}</strong></div><div><span>Email</span><strong>{{ auth.session()?.email }}</strong></div><div><span>Pickup base</span><strong>{{ auth.session()?.address }}</strong></div><div><span>City & state</span><strong>{{ auth.session()?.city }}, {{ auth.session()?.state }}</strong></div><div><span>Pincode</span><strong>{{ auth.session()?.pincode }}</strong></div>@if (ngo) { <div><span>Pickup radius</span><strong>{{ auth.session()?.serviceRadiusKm }} km</strong></div><div><span>Pickup capacity</span><strong>Up to {{ auth.session()?.maxMealsPerPickup }} meals</strong></div> }</div></article></section>
      @if (editingProfile()) { <section class="panel organization-edit-panel"><div class="panel-heading"><div><span class="kicker">UPDATE ORGANIZATION</span><h2>{{ auth.session()?.organizationStatus === 'suspended' ? 'Correct details and request review' : 'Edit account details' }}</h2><p>Use the real pickup base and a working contact number.</p></div></div><form [formGroup]="profileForm" (ngSubmit)="saveProfile(ngo)"><div class="form-grid"><label>Organization name<input pInputText formControlName="organization" /></label><label>Primary contact<input pInputText formControlName="name" /></label></div><div class="form-grid"><label>Work phone<input pInputText inputmode="tel" formControlName="phone" /></label><label>Local area<input pInputText formControlName="area" (input)="clearProfileCoordinates()" /></label></div><label class="full">Street address<input pInputText formControlName="address" (input)="clearProfileCoordinates()" /></label><div class="form-grid three"><label>City<input pInputText formControlName="city" (input)="clearProfileCoordinates()" /></label><label>State<input pInputText formControlName="state" (input)="clearProfileCoordinates()" /></label><label>6-digit pincode<input pInputText inputmode="numeric" maxlength="6" formControlName="pincode" (input)="clearProfileCoordinates()" /></label></div><div class="location-capture compact-location"><span class="location-capture-icon"><i class="pi pi-map-marker"></i></span><div><strong>{{ profileHasCoordinates() ? 'Location pin captured' : 'Exact pincode matching will be used' }}</strong><small>Changing the address clears the old pin. Capture a new pin for radius-based matching.</small></div><button type="button" class="subtle-button" (click)="captureProfileLocation()" [disabled]="profileLocationLoading()">@if (profileLocationLoading()) { <i class="pi pi-spin pi-spinner"></i> Locating… } @else { <i class="pi pi-crosshairs"></i> Capture location pin }</button></div>@if (profileLocationError()) { <div class="field-help warning"><i class="pi pi-info-circle"></i>{{ profileLocationError() }}</div> } @if (ngo) { <div class="form-grid"><label>Pickup radius (km)<input pInputText type="number" min="1" max="100" formControlName="serviceRadiusKm" /></label><label>Maximum meals per pickup<input pInputText type="number" min="1" max="10000" formControlName="maxMealsPerPickup" /></label></div><label class="confirm-control compact"><input type="checkbox" formControlName="acceptsNonVegetarian" /><span><strong>We can collect non-vegetarian or mixed food</strong><small>Leave unchecked for vegetarian-only collection.</small></span></label> } @if (auth.session()?.organizationStatus === 'suspended') { <label class="full resubmission-note">What did you correct?<textarea rows="3" formControlName="resubmissionNote" placeholder="For example: We corrected our pickup address and confirmed the contact number."></textarea><small>Give the admin a short note so they can review faster.</small></label> } @if (profileError()) { <div class="auth-error form-error"><i class="pi pi-exclamation-circle"></i>{{ profileError() }}</div> }<div class="organization-edit-actions"><button pButton type="submit" class="mp-button mp-button-dark" [disabled]="profileSaving()">@if (profileSaving()) { <i class="pi pi-spin pi-spinner"></i> Saving… } @else { {{ auth.session()?.organizationStatus === 'suspended' ? 'Save and request review' : 'Save details' }} <i class="pi pi-check"></i> }</button><button type="button" class="subtle-button" (click)="cancelEditing()" [disabled]="profileSaving()">Cancel</button></div></form></section> }
    </ng-template>

    <ng-template #adminOrganizations><div class="page-heading dashboard-heading"><div><span class="kicker">ORGANIZATION DIRECTORY</span><h1>Organizations</h1><p>Open an account to review the full registration details and verification status.</p></div><span class="soft-chip">{{ data.organizations().length }} total</span></div><section class="admin-organization-groups"><article class="organization-category-panel"><div class="organization-category-heading"><div><span class="kicker">FOOD PARTNERS</span><h2>Food donors</h2><p>Restaurants, hotels, caterers and cloud kitchens.</p></div><span class="category-count">{{ organizationsByRole('partner').length }}</span></div><div class="organization-category-list">@for (organization of organizationsByRole('partner'); track organization.id) { <a [routerLink]="['/admin/organizations', organization.id]" class="organization-directory-row"><span class="directory-org-avatar partner-avatar">{{ initials(organization.name) }}</span><span class="organization-directory-main"><strong>{{ organization.name }}</strong><small>{{ organization.contactName }} · {{ organization.contactPhone }}</small><small>{{ organization.address }}, {{ organization.area }}, {{ organization.city }} · {{ organization.pincode }}</small></span><span class="organization-directory-meta"><b [class]="'status ' + organization.status">{{ organization.status }}</b><small>Open details <i class="pi pi-chevron-right"></i></small></span></a> } @empty { <div class="organization-category-empty"><i class="pi pi-building"></i><span>No Food Partner accounts yet.</span></div> }</div></article><article class="organization-category-panel"><div class="organization-category-heading"><div><span class="kicker">NGOS</span><h2>Food rescue groups</h2><p>Organizations available to collect and distribute food.</p></div><span class="category-count">{{ organizationsByRole('ngo').length }}</span></div><div class="organization-category-list">@for (organization of organizationsByRole('ngo'); track organization.id) { <a [routerLink]="['/admin/organizations', organization.id]" class="organization-directory-row"><span class="directory-org-avatar ngo-avatar">{{ initials(organization.name) }}</span><span class="organization-directory-main"><strong>{{ organization.name }}</strong><small>{{ organization.contactName }} · {{ organization.contactPhone }}</small><small>{{ organization.area }}, {{ organization.city }} · {{ organization.serviceRadiusKm }} km radius · max {{ organization.maxMealsPerPickup }} meals</small></span><span class="organization-directory-meta"><b [class]="'status ' + organization.status">{{ organization.status }}</b><small>Open details <i class="pi pi-chevron-right"></i></small></span></a> } @empty { <div class="organization-category-empty"><i class="pi pi-heart"></i><span>No NGO accounts yet.</span></div> }</div></article></section></ng-template>

    <ng-template #adminTable let-kind="kind"><div class="page-heading dashboard-heading"><div><span class="kicker">SHARED DATABASE</span><h1>{{ adminTitle(kind) }}</h1><p>{{ adminSubtitle(kind) }}</p></div></div><section class="table-panel"><div class="data-table"><div class="table-row table-head"><span>Record</span><span>Type</span><span>Location</span><span>Matching</span><span>Status</span><span>Action</span></div>@for (row of adminRows(kind); track row.fullId) {<div class="table-row"><span><strong>{{ row.name }}</strong><small>{{ row.contactName }} · {{ row.contactPhone }}</small><small>ID: {{ row.id }}</small></span><span>{{ row.type }}</span><span>{{ row.area }}</span><span>{{ row.activity }}</span><span><b [class]="'status ' + row.class">{{ row.status }}</b></span><span class="admin-row-actions">@if (kind === 'donations') { <a [routerLink]="['/admin/donations', row.id]" class="table-action">View details</a> } @if (kind === 'organizations') { <a [routerLink]="['/admin/organizations', row.fullId]" class="table-action">Review</a> }</span></div>}</div><div class="table-footer"><span>Showing {{ adminRows(kind).length }} database records</span></div></section></ng-template>
  `
})
export class UtilityPageComponent implements OnInit {
  readonly view: string;
  readonly editingProfile = signal(false);
  readonly profileSaving = signal(false);
  readonly profileError = signal('');
  readonly profileLocationLoading = signal(false);
  readonly profileLocationError = signal('');
  readonly profileForm = new FormGroup({
    organization: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]),
    name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    phone: new FormControl('', [Validators.required, Validators.minLength(7), Validators.maxLength(30)]),
    area: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    address: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]),
    city: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    state: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    pincode: new FormControl('', [Validators.required, Validators.pattern(/^[1-9][0-9]{5}$/)]),
    latitude: new FormControl<number | null>(null),
    longitude: new FormControl<number | null>(null),
    serviceRadiusKm: new FormControl(10, [Validators.required, Validators.min(1), Validators.max(100)]),
    maxMealsPerPickup: new FormControl(100, [Validators.required, Validators.min(1), Validators.max(10000)]),
    acceptsNonVegetarian: new FormControl(false),
    resubmissionNote: new FormControl('', Validators.maxLength(1000))
  });
  constructor(route: ActivatedRoute, public readonly data: DemoDataService, public readonly auth: AuthService) { this.view = route.snapshot.data['view'] as string; }
  ngOnInit(): void { if (this.view === 'notifications') void this.data.markNotificationsRead().catch(() => null); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
  notificationIcon(tone: string): string { return tone === 'success' ? 'pi pi-check' : tone === 'warning' ? 'pi pi-exclamation-triangle' : 'pi pi-bell'; }
  adminTitle(kind: string): string { return kind === 'organizations' ? 'Organizations' : kind === 'matches' ? 'Matching activity' : 'All donations'; }
  adminSubtitle(kind: string): string { return kind === 'organizations' ? 'Authenticated food partners and NGOs across every area.' : 'Every food post and its current pickup status.'; }
  organizationsByRole(role: 'partner' | 'ngo') { return this.data.organizations().filter((organization) => organization.role === role); }
  adminRows(kind: string): Array<{ name: string; id: string; fullId: string; type: string; contactName: string; contactPhone: string; area: string; activity: string; status: string; class: string }> {
    if (kind === 'organizations') return this.data.organizations().map((item) => ({ name: item.name, id: item.id.slice(0, 8), fullId: item.id, type: item.role === 'partner' ? 'Food Partner' : 'NGO', contactName: item.contactName, contactPhone: item.contactPhone, area: `${item.address}, ${item.area}, ${item.city}, ${item.state} · ${item.pincode}`, activity: item.role === 'ngo' ? `${item.serviceRadiusKm} km · max ${item.maxMealsPerPickup} meals` : 'Food donor location', status: item.status, class: item.status === 'verified' ? 'completed' : item.status === 'suspended' ? 'expired' : 'published' }));
    return this.data.donations().map((item) => ({ name: item.foodName, id: item.id, fullId: item.dbId, type: `${item.meals} meals`, contactName: item.partner, contactPhone: '', area: `${item.city} · ${item.pincode}`, activity: item.ngo ?? 'Waiting for NGO', status: item.status, class: this.statusClass(item.status) }));
  }
  notificationTarget(note: AppNotification): string {
    const role = this.auth.session()?.role;
    if (!role || !note.donationId) return role ? `/${role}/notifications` : '/login';
    // Notifications retain the database UUID for secure relationships, while
    // route URLs deliberately use the human-safe public donation ID.
    const donation = this.data.donations().find((item) => item.dbId === note.donationId);
    if (!donation) return `/${role}/notifications`;
    if (role === 'admin') return `/admin/donations/${donation.id}`;
    return role === 'partner' ? `/partner/donations/${donation.id}` : `/ngo/opportunities/${donation.id}`;
  }
  markRead(notificationId: string): void { void this.data.markNotificationsRead([notificationId]).catch(() => null); }
  startEditing(): void {
    const session = this.auth.session();
    if (!session || session.role === 'admin') return;
    this.profileForm.reset({
      organization: session.organization,
      name: session.name,
      phone: session.phone,
      area: session.area,
      address: session.address,
      city: session.city,
      state: session.state,
      pincode: session.pincode,
      latitude: session.latitude,
      longitude: session.longitude,
      serviceRadiusKm: session.serviceRadiusKm,
      maxMealsPerPickup: session.maxMealsPerPickup,
      acceptsNonVegetarian: session.acceptsNonVegetarian,
      resubmissionNote: ''
    });
    this.profileError.set('');
    this.profileLocationError.set('');
    this.editingProfile.set(true);
  }
  cancelEditing(): void { this.editingProfile.set(false); this.profileError.set(''); this.profileLocationError.set(''); }
  profileHasCoordinates(): boolean { return this.profileForm.controls.latitude.value != null && this.profileForm.controls.longitude.value != null; }
  clearProfileCoordinates(): void { this.profileForm.patchValue({ latitude: null, longitude: null }); }
  captureProfileLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { this.profileLocationError.set('Location is unavailable on this device. Exact pincode matching will be used.'); return; }
    this.profileLocationLoading.set(true);
    this.profileLocationError.set('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { this.profileForm.patchValue({ latitude: coords.latitude, longitude: coords.longitude }); this.profileLocationLoading.set(false); },
      () => { this.profileLocationError.set('Could not capture your location. Check the address and pincode carefully.'); this.profileLocationLoading.set(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  }
  async saveProfile(ngo: boolean): Promise<void> {
    if (this.profileSaving()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.profileError.set('Complete every required field with valid details before saving.');
      return;
    }
    const session = this.auth.session();
    const value = this.profileForm.getRawValue();
    if (!session) return;
    if (session.organizationStatus === 'suspended' && (value.resubmissionNote ?? '').trim().length < 10) {
      this.profileError.set('Briefly explain what you corrected before requesting another review.');
      return;
    }
    this.profileSaving.set(true);
    this.profileError.set('');
    try {
      await this.data.updateMyOrganization({
        name: value.organization ?? '', fullName: value.name ?? '', phone: value.phone ?? '', area: value.area ?? '',
        address: value.address ?? '', city: value.city ?? '', state: value.state ?? '', pincode: value.pincode ?? '',
        latitude: value.latitude, longitude: value.longitude,
        serviceRadiusKm: ngo ? Number(value.serviceRadiusKm) : null,
        maxMealsPerPickup: ngo ? Number(value.maxMealsPerPickup) : null,
        acceptsNonVegetarian: ngo ? Boolean(value.acceptsNonVegetarian) : null,
        resubmissionNote: value.resubmissionNote ?? ''
      });
      this.editingProfile.set(false);
    } catch (error) {
      this.profileError.set(error instanceof Error ? error.message : 'Unable to update organization details.');
    } finally {
      this.profileSaving.set(false);
    }
  }
  activeForNgo() { return this.data.donations().filter((item) => item.status === 'Accepted' || item.status === 'Picked Up'); }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
}
