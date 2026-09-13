import { Component, computed, effect, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AiExtractionService } from '../../core/ai-extraction.service';
import { AuthService } from '../../core/auth.service';
import { DemoDataService } from '../../core/demo-data.service';
import { Donation, DonationExtraction, DonationHandoff, DonationHandoffInput } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="page-heading dashboard-heading">
      <div><span class="kicker">FOOD PARTNER</span><h1>Hello, {{ auth.session()?.name }}.</h1><p>Share surplus food with verified NGOs near the actual pickup point.</p></div>
      @if (auth.session()?.organizationStatus === 'verified') { <a pButton routerLink="/partner/donations/new" class="mp-button mp-button-dark"><i class="pi pi-plus"></i> Post surplus food</a> } @else if (auth.session()?.organizationStatus === 'suspended') { <a pButton routerLink="/partner/profile" class="mp-button mp-button-light"><i class="pi pi-pencil"></i> Update details</a> } @else { <button pButton type="button" class="mp-button mp-button-ghost" disabled><i class="pi pi-clock"></i> Verification pending</button> }
    </div>

    @if (auth.session()?.organizationStatus === 'suspended') { <section class="data-state warning-state"><i class="pi pi-exclamation-triangle"></i><div><strong>Your review needs changes.</strong><span>An admin paused this account. Check your notifications, correct the details, and request another review.</span></div><a routerLink="/partner/profile" class="subtle-button">Update details <i class="pi pi-arrow-right"></i></a></section> } @else if (auth.session()?.organizationStatus !== 'verified') { <div class="data-state warning-state"><i class="pi pi-shield"></i><div><strong>Verification pending</strong><span>An admin is reviewing your organization. You will be able to post surplus food as soon as it is verified.</span></div></div> } @else { <section class="data-state verification-success"><i class="pi pi-verified"></i><div><strong>Your organization is verified.</strong><span>You can now post surplus food and connect with eligible nearby NGOs.</span></div><a routerLink="/partner/donations/new" class="subtle-button">Post food <i class="pi pi-arrow-right"></i></a></section> }
    @if (data.error()) { <div class="data-state error-state"><i class="pi pi-database"></i><div><strong>Shared database unavailable</strong><span>{{ data.error() }}</span></div><button class="subtle-button" (click)="reload()">Try again</button></div> }
    @else if (data.loading() && !data.initialized()) { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading your food posts…</span></div> }

    @if (active(); as item) {
      <section class="coordination-card forest-card">
        <div class="coordination-copy">
          <span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span>
          <h2>{{ item.meals }} meals are being coordinated.</h2>
          <p>{{ item.ngo }} accepted the food from {{ item.outlet }}. Open the donation to contact the NGO and confirm the handoff.</p>
          <div class="pickup-steps" aria-label="Pickup status">
            <span class="done"><i class="pi pi-check"></i>Available</span>
            <span class="done"><i class="pi pi-check"></i>Accepted</span>
            <span [class.done]="item.status === 'Picked Up'"><i [class]="item.status === 'Picked Up' ? 'pi pi-check' : 'pi pi-shopping-bag'"></i>Picked up</span>
            <span><i class="pi pi-check-circle"></i>Completed</span>
          </div>
          <a [routerLink]="'/partner/donations/' + item.id" class="inline-arrow light-link">Open donation <i class="pi pi-arrow-right"></i></a>
        </div>
        <aside class="coordination-contact"><span class="match-avatar large">{{ initials(item.ngo) }}</span><div><small>ACCEPTED BY</small><strong>{{ item.ngo }}</strong><span>{{ item.area }}</span></div><a [routerLink]="'/partner/donations/' + item.id" class="contact-button"><i class="pi pi-phone"></i> View contact</a></aside>
      </section>
    } @else if (data.initialized()) {
      <section class="empty-action-card"><span class="empty-icon"><i class="pi pi-plus"></i></span><div><span class="kicker">NO ACTIVE PICKUP</span><h2>Have surplus food today?</h2><p>Create a food post and eligible verified NGOs near its pickup point will see it.</p></div><a pButton routerLink="/partner/donations/new" class="mp-button mp-button-dark">Post surplus food</a></section>
    }

    <section class="stats-grid simple-stats partner-stats" aria-label="Your impact">
      <article><span class="stat-icon green"><i class="pi pi-heart-fill"></i></span><div><small>Meals rescued</small><strong>{{ data.completedMeals() }}</strong></div></article>
      <article><span class="stat-icon green"><i class="pi pi-check-circle"></i></span><div><small>Completed pickups</small><strong>{{ completedCount() }}</strong></div></article>
      <article><span class="stat-icon coral"><i class="pi pi-users"></i></span><div><small>NGO connections</small><strong>{{ connectionCount() }}</strong></div></article>
    </section>

    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><span class="kicker">DATABASE ACTIVITY</span><h2>Your food posts</h2></div><a routerLink="/partner/donations/history">View history</a></div><div class="donation-list">
        @for (item of data.donations().slice(0, 6); track item.id) { <a class="donation-row" [routerLink]="'/partner/donations/' + item.id"><span class="food-thumb"><i class="pi pi-box"></i></span><div class="donation-main"><strong>{{ item.foodName }}</strong><small>{{ item.meals }} meals · {{ item.outlet }}</small></div><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span><span class="donation-time">{{ item.pickupBy }}</span><i class="pi pi-chevron-right"></i></a> }
        @if (data.initialized() && data.donations().length === 0) { <div class="inline-empty"><i class="pi pi-inbox"></i><span><strong>No food posts yet</strong>Create your first post to start.</span></div> }
      </div></section>
      <aside class="panel impact-card"><div class="panel-heading"><div><span class="kicker">SIMPLE IMPACT</span><h2>Food shared, not wasted.</h2></div><i class="pi pi-sparkles"></i></div><div class="impact-ring" [style.background]="impactBackground()"><div><strong>{{ impactRate() }}%</strong><span>completed</span></div></div><dl><div><dt>Meals offered</dt><dd>{{ offeredMeals() }}</dd></div><div><dt>Meals rescued</dt><dd>{{ data.completedMeals() }}</dd></div><div><dt>NGOs connected</dt><dd>{{ connectionCount() }}</dd></div></dl></aside>
    </div>
  `
})
export class PartnerDashboardComponent {
  readonly active = computed(() => this.data.donations().find((item) => item.status === 'Accepted' || item.status === 'Picked Up') ?? null);
  readonly completedCount = computed(() => this.data.donations().filter((item) => item.status === 'Completed').length);
  readonly connectionCount = computed(() => new Set(this.data.donations().map((item) => item.acceptedOrganizationId).filter(Boolean)).size);
  readonly offeredMeals = computed(() => this.data.donations().reduce((sum, item) => sum + item.meals, 0));
  readonly impactRate = computed(() => this.offeredMeals() ? Math.round((this.data.completedMeals() / this.offeredMeals()) * 100) : 0);
  readonly impactBackground = computed(() => {
    const rate = this.impactRate();
    return `conic-gradient(from -36deg, #145f46 0%, #237f5d ${Math.max(0, rate * .55)}%, #62b78d ${rate}%, #e7ece9 ${rate}% 100%)`;
  });
  constructor(public readonly data: DemoDataService, public readonly auth: AuthService) {}
  reload(): void { void this.data.refresh(); }
  initials(value?: string): string { return (value ?? 'NGO').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule],
  template: `
    <div class="wizard-top"><a routerLink="/partner/dashboard" class="back-link"><i class="pi pi-arrow-left"></i> Dashboard</a><div class="wizard-progress"><span [class.active]="step() >= 1"><b>1</b> Share</span><i></i><span [class.active]="step() >= 2"><b>2</b> Check</span><i></i><span [class.active]="step() >= 3"><b>3</b> Alert NGOs</span></div><span class="draft-state"><i class="pi pi-database"></i> Saved when posted</span></div>

    @if (step() === 1) {
      <section class="wizard-layout"><div class="wizard-copy"><span class="kicker">POST SURPLUS FOOD</span><h1>Tell us what is available.</h1><p>Describe the food in your own words and AI will suggest the form details. Nothing is posted until you confirm.</p><div class="safety-callout"><i class="pi pi-shield"></i><div><strong>You confirm every detail.</strong><span>AI does not publish or certify food safety.</span></div></div></div><div class="capture-card"><div class="input-mode-tabs simple-input-tabs"><button class="active"><i class="pi pi-sparkles"></i> AI assist</button><button type="button" (click)="manualEntry()"><i class="pi pi-align-left"></i> Manual form</button></div><div class="typed-fallback ai-text-entry"><span>DESCRIBE THE FOOD IN YOUR OWN WORDS</span><textarea [formControl]="rawInput" rows="5" placeholder="e.g. 20 vegetarian meals at Korum Mall, ready for pickup by 8 PM"></textarea><small>AI suggests the fields; you review and confirm them before posting.</small><button pButton class="mp-button mp-button-dark" (click)="extractTyped()" [disabled]="loading()">@if (loading()) { <i class="pi pi-spin pi-spinner"></i> Structuring details… } @else { Fill the form with AI <i class="pi pi-sparkles"></i> }</button></div><p class="ai-pilot-note"><i class="pi pi-info-circle"></i><span><strong>Pilot AI helper.</strong> It may be briefly busy; the Manual form is always available and posting never depends on AI.</span></p>@if (error()) { <div class="auth-error form-error"><i class="pi pi-exclamation-circle"></i><span>{{ error() }}</span><button type="button" class="text-button" (click)="manualEntry()">Continue manually <i class="pi pi-arrow-right"></i></button></div> }</div></section>
    }

    @if (step() === 2) {
        <section class="confirm-layout"><div class="confirm-main"><div class="page-heading"><div><span class="kicker">CHECK THE DETAILS</span><h1>Is everything correct?</h1><p>Only verified NGOs that fit this pickup’s distance, capacity, availability and food type can see it.</p></div><span class="confidence"><i class="pi pi-sparkles"></i> Human confirmed</span></div><form [formGroup]="form" class="details-form"><div class="form-section-head"><span><i class="pi pi-box"></i></span><div><h2>Food details</h2><p>Give a practical quantity and clear description.</p></div></div><label class="full">What food is available?<input pInputText formControlName="foodName" /></label><div class="form-grid three"><label>Estimated meals<input pInputText type="number" formControlName="meals" /></label><label>Food type<select formControlName="category"><option>Cooked meal</option><option>Packaged food</option><option>Fresh produce</option></select></label><label>Dietary<select formControlName="dietary"><option>Vegetarian</option><option>Non-vegetarian</option><option>Mixed</option></select></label></div><div class="form-section-head"><span><i class="pi pi-map-marker"></i></span><div><h2>Pickup details</h2><p>Enter the actual pickup point—not only the organization’s main office.</p></div></div><div class="form-grid"><label>Outlet / pickup point<input pInputText formControlName="outlet" /></label><label>Full pickup address<input pInputText formControlName="address" (input)="clearCoordinates()" /></label></div><div class="form-grid three"><label>City<input pInputText formControlName="city" /></label><label>State<input pInputText formControlName="state" /></label><label>5-digit pincode<input pInputText inputmode="numeric" maxlength="5" formControlName="pincode" /></label></div><div class="location-capture compact-location"><span class="location-capture-icon"><i class="pi pi-map-marker"></i></span><div><strong>{{ hasCoordinates() ? 'Pickup pin captured' : 'Using exact pincode fallback' }}</strong><small>{{ hasCoordinates() ? 'Distance will be calculated from this pickup pin.' : 'Capture the pickup pin for accurate cross-pincode matching.' }}</small></div><button type="button" class="subtle-button" (click)="useCurrentLocation()" [disabled]="locationLoading()">@if (locationLoading()) { <i class="pi pi-spin pi-spinner"></i> Locating… } @else { <i class="pi pi-crosshairs"></i> Capture pickup pin }</button></div>@if (locationError()) { <div class="field-help warning"><i class="pi pi-info-circle"></i>{{ locationError() }}</div> }<div class="form-grid"><label>Prepared at<input pInputText type="datetime-local" formControlName="preparedAt" /></label><label>Pickup by<input pInputText type="datetime-local" formControlName="pickupBy" /></label></div><label class="full">Handling notes<textarea formControlName="notes" rows="3"></textarea></label><label class="confirm-control"><input type="checkbox" formControlName="confirmed" /><span><strong>I confirm these details are accurate.</strong><small>The receiving NGO will make its own food-safety decision.</small></span></label></form></div><aside class="publish-summary"><span class="kicker">READY TO SHARE</span><h2>{{ form.controls.meals.value }} {{ form.controls.dietary.value?.toLowerCase() }} meals</h2><div class="summary-location"><i class="pi pi-map-marker"></i><div><strong>{{ form.controls.outlet.value }}</strong><span>{{ form.controls.address.value }}, {{ form.controls.pincode.value }}</span></div></div><dl><div><dt>Matching</dt><dd>{{ hasCoordinates() ? 'NGO radius' : 'Exact pincode' }}</dd></div><div><dt>Pickup by</dt><dd>{{ form.controls.pickupBy.value }}</dd></div></dl><section class="ai-handoff-brief"><div class="ai-handoff-head"><div><span class="kicker"><i class="pi pi-sparkles"></i> AI HANDOFF BRIEF</span><strong>Make the pickup clear.</strong></div><i class="pi pi-send"></i></div>@if (handoff(); as draft) { <p>{{ draft.pickupSummary }}</p><ul>@for (item of draft.checklist; track item) { <li><i class="pi pi-check-circle"></i>{{ item }}</li> }</ul>@if (draft.missing.length) { <div class="handoff-missing"><i class="pi pi-info-circle"></i><span>Add if known: {{ draft.missing.join(', ') }}</span></div> }<div class="handoff-message"><span>DRAFT FOR THE NGO</span><p>{{ draft.ngoMessage }}</p><button type="button" class="text-button" (click)="copyHandoffMessage()">@if (handoffCopied()) { Copied <i class="pi pi-check"></i> } @else { Copy draft <i class="pi pi-copy"></i> }</button></div><button type="button" class="subtle-button mp-button-block" (click)="prepareHandoff()" [disabled]="handoffLoading()"><i class="pi pi-refresh"></i> Refresh brief</button> } @else { <p>AI turns your reviewed details into a practical pickup brief. It never approves food safety or chooses an NGO.</p><button type="button" class="subtle-button mp-button-block" (click)="prepareHandoff()" [disabled]="form.invalid || handoffLoading()">@if (handoffLoading()) { <i class="pi pi-spin pi-spinner"></i> Preparing brief… } @else { <i class="pi pi-sparkles"></i> Prepare NGO handoff }</button> } @if (handoffError()) { <div class="field-help warning"><i class="pi pi-info-circle"></i>{{ handoffError() }}</div> }</section><p class="plain-help"><i class="pi pi-info-circle"></i> Eligible nearby NGOs are notified. Contact details unlock only after acceptance.</p>@if (error()) { <div class="auth-error"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }<button pButton class="mp-button mp-button-dark mp-button-block" (click)="publish()" [disabled]="form.invalid || publishing()">@if (publishing()) { <i class="pi pi-spin pi-spinner"></i> Posting… } @else { Alert eligible NGOs <i class="pi pi-send"></i> }</button><button class="subtle-button mp-button-block" (click)="step.set(1)">Back</button></aside></section>
    }

    @if (step() === 3 && published(); as item) { <section class="success-state"><span class="success-orbit"><i class="pi pi-check"></i></span><span class="kicker">FOOD POSTED</span><h1>Eligible NGOs near {{ item.city }} can now see it.</h1><p>{{ item.meals }} meals from {{ item.outlet }} are matched by pickup radius, availability, capacity and dietary fit.</p><div class="success-match"><span class="match-avatar large"><i class="pi pi-bell"></i></span><div><span>WHAT HAPPENS NEXT</span><strong>An eligible NGO can accept or decline</strong><small>Once accepted, both organizations receive direct contact details.</small></div></div><div class="success-actions"><a pButton [routerLink]="'/partner/donations/' + item.id" class="mp-button mp-button-dark">View donation <i class="pi pi-arrow-right"></i></a><button pButton class="mp-button mp-button-ghost" (click)="reset()">Post another</button></div></section> }
  `
})
export class DonationWizardComponent {
  readonly step = signal<1 | 2 | 3>(1);
  readonly loading = signal(false);
  readonly publishing = signal(false);
  readonly error = signal('');
  readonly locationLoading = signal(false);
  readonly locationError = signal('');
  readonly published = signal<Donation | null>(null);
  readonly handoff = signal<DonationHandoff | null>(null);
  readonly handoffLoading = signal(false);
  readonly handoffError = signal('');
  readonly handoffCopied = signal(false);
  readonly rawInput = new FormControl('', [Validators.maxLength(4000)]);
  readonly form = new FormGroup({ foodName: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]), meals: new FormControl(0, [Validators.required, Validators.min(1), Validators.max(100000)]), category: new FormControl('Cooked meal', [Validators.required, Validators.maxLength(80)]), dietary: new FormControl<Donation['dietary']>('Vegetarian', Validators.required), outlet: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]), address: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]), city: new FormControl('', [Validators.required, Validators.maxLength(100)]), state: new FormControl('', [Validators.required, Validators.maxLength(100)]), pincode: new FormControl('', [Validators.required, Validators.pattern(/^[1-9][0-9]{4}$/)]), latitude: new FormControl<number | null>(null), longitude: new FormControl<number | null>(null), preparedAt: new FormControl(this.localDateTime(new Date()), Validators.required), pickupBy: new FormControl(this.localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)), Validators.required), notes: new FormControl('', [Validators.maxLength(2000)]), confirmed: new FormControl(false, Validators.requiredTrue) });

  constructor(private readonly ai: AiExtractionService, private readonly data: DemoDataService, public readonly auth: AuthService) {
    const session = auth.session();
    this.form.patchValue({ outlet: session?.organization ?? '', address: session?.address ?? '', city: session?.city ?? '', state: session?.state ?? '', pincode: session?.pincode ?? '', latitude: session?.latitude ?? null, longitude: session?.longitude ?? null });
    this.form.valueChanges.subscribe(() => { this.handoff.set(null); this.handoffCopied.set(false); });
  }
  async extractTyped(): Promise<void> {
    if (!this.organizationIsVerified()) return;
    const text = (this.rawInput.value ?? '').trim();
    if (!text) { this.error.set('Describe the food before asking AI to fill the form.'); return; }
    await this.runExtraction(text);
  }
  manualEntry(): void { if (this.organizationIsVerified()) { this.error.set(''); this.step.set(2); } }
  private organizationIsVerified(): boolean {
    if (this.auth.session()?.organizationStatus === 'verified') return true;
    this.error.set('Your organization is awaiting admin verification. You cannot create or post surplus food yet.');
    return false;
  }
  private async runExtraction(text: string): Promise<void> { this.loading.set(true); this.error.set(''); try { this.patchExtraction(await this.ai.extract(text)); this.step.set(2); } catch (error) { this.error.set(error instanceof Error ? error.message : 'AI extraction failed. You can use the manual form.'); } finally { this.loading.set(false); } }
  private patchExtraction(value: DonationExtraction): void { this.form.patchValue({ foodName: value.foodName, meals: value.meals, category: value.category, dietary: value.dietary, outlet: value.outlet || this.form.controls.outlet.value, address: value.address || this.form.controls.address.value, notes: value.notes }); }
  async prepareHandoff(): Promise<void> {
    if (this.form.invalid || this.handoffLoading()) { this.form.markAllAsTouched(); return; }
    this.handoffLoading.set(true); this.handoffError.set(''); this.handoffCopied.set(false);
    try { this.handoff.set(await this.ai.prepareHandoff(this.handoffInput())); }
    catch (error) { this.handoffError.set(error instanceof Error ? error.message : 'AI handoff preparation is temporarily unavailable.'); }
    finally { this.handoffLoading.set(false); }
  }
  async copyHandoffMessage(): Promise<void> {
    const message = this.handoff()?.ngoMessage;
    if (!message) return;
    try { await navigator.clipboard.writeText(message); this.handoffCopied.set(true); }
    catch { this.handoffError.set('Copy is unavailable in this browser. Select the draft text manually.'); }
  }
  private handoffInput(): DonationHandoffInput {
    const value = this.form.getRawValue();
    return { foodName: value.foodName ?? '', meals: value.meals ?? 0, category: value.category ?? '', dietary: value.dietary ?? 'Mixed', outlet: value.outlet ?? '', address: value.address ?? '', city: value.city ?? '', state: value.state ?? '', pincode: value.pincode ?? '', preparedAt: value.preparedAt ?? '', pickupBy: value.pickupBy ?? '', notes: value.notes ?? '' };
  }
  hasCoordinates(): boolean { return this.form.controls.latitude.value != null && this.form.controls.longitude.value != null; }
  clearCoordinates(): void { this.form.patchValue({ latitude: null, longitude: null }); }
  useCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { this.locationError.set('Location is unavailable on this device. Exact pincode matching will be used.'); return; }
    this.locationLoading.set(true); this.locationError.set('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { this.form.patchValue({ latitude: coords.latitude, longitude: coords.longitude }); this.locationLoading.set(false); },
      () => { this.locationError.set('Could not capture the pickup pin. Check the pincode carefully.'); this.locationLoading.set(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  }
  async publish(): Promise<void> {
    if (this.form.invalid || this.publishing()) return;
    if (this.auth.session()?.organizationStatus !== 'verified') { this.error.set('An admin must verify this organization before it can post food.'); return; }
    this.publishing.set(true); this.error.set('');
    const value = this.form.getRawValue();
    try {
      const preparedAt = new Date(value.preparedAt!);
      const pickupBy = new Date(value.pickupBy!);
      if (Number.isNaN(preparedAt.getTime()) || Number.isNaN(pickupBy.getTime()) || pickupBy <= preparedAt || pickupBy <= new Date()) throw new Error('Pickup deadline must be after preparation time and still in the future.');
      this.published.set(await this.data.publishDonation({ foodName: value.foodName!, meals: value.meals!, category: value.category!, dietary: value.dietary!, outlet: value.outlet!, address: value.address!, city: value.city!, state: value.state!, pincode: value.pincode!, latitude: value.latitude, longitude: value.longitude, preparedAt: preparedAt.toISOString(), pickupBy: pickupBy.toISOString(), notes: value.notes ?? '', missing: [], confidence: 0.92 }));
      this.step.set(3);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to post this food.'); }
    finally { this.publishing.set(false); }
  }
  reset(): void { const session = this.auth.session(); this.form.reset({ meals: 0, category: 'Cooked meal', dietary: 'Vegetarian', outlet: session?.organization ?? '', address: session?.address ?? '', city: session?.city ?? '', state: session?.state ?? '', pincode: session?.pincode ?? '', latitude: session?.latitude ?? null, longitude: session?.longitude ?? null, preparedAt: this.localDateTime(new Date()), pickupBy: this.localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)), confirmed: false }); this.rawInput.reset(''); this.published.set(null); this.handoff.set(null); this.handoffError.set(''); this.handoffCopied.set(false); this.error.set(''); this.step.set(1); }
  private localDateTime(date: Date): string { const pad = (value: number) => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
}

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    @if (donation(); as item) {
      <div class="detail-top"><a routerLink="/partner/donations/history" class="back-link"><i class="pi pi-arrow-left"></i> Donations</a><span [class]="'status ' + statusClass(item.status)">{{ item.status }}</span></div><div class="page-heading detail-heading"><div><span class="kicker">{{ item.id }}</span><h1>{{ item.foodName }}</h1><p>{{ item.meals }} meals · {{ item.outlet }}</p></div></div>
      <section class="simple-status-card panel"><div><span class="kicker">PICKUP STATUS</span><h2>{{ statusTitle(item) }}</h2><p>{{ statusCopy(item) }}</p></div><div class="pickup-steps light-steps" aria-label="Donation status"><span class="done"><i class="pi pi-check"></i>Available</span><span [class.done]="stage(item) >= 2"><i [class]="stage(item) >= 2 ? 'pi pi-check' : 'pi pi-heart'"></i>Accepted</span><span [class.done]="stage(item) >= 3"><i [class]="stage(item) >= 3 ? 'pi pi-check' : 'pi pi-shopping-bag'"></i>Picked up</span><span [class.done]="stage(item) >= 4"><i [class]="stage(item) >= 4 ? 'pi pi-check' : 'pi pi-check-circle'"></i>Completed</span></div>@if (stage(item) === 3) { <button pButton class="mp-button mp-button-dark" (click)="completePickup()" [disabled]="actionLoading()">Confirm handoff complete</button> }</section>
      @if (error()) { <div class="auth-error page-error"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }
      <section class="simple-detail-grid"><article class="panel"><div class="panel-heading"><div><span class="kicker">FOOD DETAILS</span><h2>Stored in the shared database</h2></div></div><div class="detail-facts"><div><span>Food</span><strong>{{ item.foodName }}</strong></div><div><span>Quantity</span><strong>{{ item.meals }} meals</strong></div><div><span>Dietary</span><strong>{{ item.dietary }}</strong></div><div><span>Prepared</span><strong>{{ item.preparedAt }}</strong></div><div><span>Pickup by</span><strong>{{ item.pickupBy }}</strong></div><div><span>Location</span><strong>{{ item.address }}, {{ item.pincode }}</strong></div></div></article><aside class="panel direct-contact-card">@if (contact(); as person) { <span class="kicker">DIRECT COORDINATION</span><span class="match-avatar large">{{ initials(person.organizationName) }}</span><h2>{{ person.organizationName }}</h2><p>{{ person.fullName }} · {{ person.email }}</p><a [href]="'tel:' + person.phone" class="contact-button dark"><i class="pi pi-phone"></i> {{ person.phone }}</a><a [href]="'sms:' + person.phone" class="subtle-button mp-button-block"><i class="pi pi-comment"></i> Send message</a> } @else if (item.acceptedOrganizationId) { <span class="kicker">LOADING CONTACT</span><i class="pi pi-spin pi-spinner waiting-icon"></i><p>Retrieving the accepting NGO’s contact securely.</p> } @else { <span class="kicker">WAITING FOR AN NGO</span><i class="pi pi-bell waiting-icon"></i><h2>Eligible nearby NGOs can see this post.</h2><p>Contact details will appear after one accepts.</p> }</aside></section>
      @if (stage(item) < 3) { <button class="danger-link" (click)="cancel()" [disabled]="actionLoading()">Cancel donation</button> }
    } @else if (data.initialized()) { <div class="data-state error-state"><i class="pi pi-search"></i><div><strong>Donation not found</strong><span>It may have been removed or is not available to this account.</span></div><a routerLink="/partner/dashboard" class="subtle-button">Back to dashboard</a></div> } @else { <div class="data-state"><i class="pi pi-spin pi-spinner"></i><span>Loading donation…</span></div> }
  `
})
export class DonationDetailComponent {
  private readonly donationId: string;
  readonly donation = computed(() => this.data.findDonation(this.donationId));
  readonly contact = computed(() => this.data.contactFor(this.donationId));
  readonly actionLoading = signal(false);
  readonly error = signal('');
  constructor(route: ActivatedRoute, public readonly data: DemoDataService) {
    this.donationId = route.snapshot.paramMap.get('id') ?? '';
    effect(() => { const item = this.donation(); if (item?.acceptedOrganizationId) void this.data.loadContact(item.id).catch((error) => this.error.set(error instanceof Error ? error.message : 'Unable to load contact.')); });
  }
  stage(item: Donation): number { return item.status === 'Completed' ? 4 : item.status === 'Picked Up' ? 3 : item.status === 'Accepted' ? 2 : 1; }
  statusTitle(item: Donation): string { const stage = this.stage(item); return stage === 4 ? 'Pickup completed.' : stage === 3 ? 'Food has been collected.' : stage === 2 ? `${item.ngo} accepted the food.` : 'Waiting for an NGO in your area.'; }
  statusCopy(item: Donation): string { const stage = this.stage(item); return stage === 4 ? 'This donation is closed and included in your impact.' : stage === 3 ? 'Confirm the handoff to close this donation.' : stage === 2 ? 'Use the secure contact details to agree on pickup.' : 'The database will update when an NGO accepts or declines.'; }
  async completePickup(): Promise<void> { await this.runAction('Completed'); }
  async cancel(): Promise<void> { await this.runAction('Cancelled'); }
  private async runAction(status: Donation['status']): Promise<void> { this.actionLoading.set(true); this.error.set(''); try { await this.data.setStatus(this.donationId, status); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Unable to update the donation.'); } finally { this.actionLoading.set(false); } }
  initials(value: string): string { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
  statusClass(status: string): string { return status.toLowerCase().replaceAll(' ', '-'); }
}
