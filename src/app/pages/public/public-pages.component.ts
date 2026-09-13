import { AfterViewInit, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AppRole } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { PublicHeaderComponent } from '../../shared/public-header.component';
import { BrandComponent } from '../../shared/brand.component';
import { gsap } from 'gsap';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule, PublicHeaderComponent, BrandComponent],
  template: `
    <mp-public-header />
    <main class="landing-page network-landing">
      <section class="network-hero page-width">
        <div class="network-hero-copy">
          <span class="network-eyebrow landing-reveal"><i class="pi pi-bolt"></i> Local food rescue, made direct</span>
          <h1 class="landing-reveal">Surplus food has <span class="type-accent">another</span> destination.</h1>
          <p class="hero-lead landing-reveal">Food Waste Matcher AI helps food businesses share what is available with nearby verified NGOs—so a real team can collect it before it becomes waste.</p>
          <div class="hero-proof landing-reveal" aria-label="Food Waste Matcher AI principles"><span><i class="pi pi-verified"></i> Verified organizations</span><span><i class="pi pi-map-marker"></i> Location-aware matching</span><span><i class="pi pi-comments"></i> Direct handoff</span></div>
          <div class="hero-actions landing-reveal">
            @if (auth.session(); as session) { <a pButton [routerLink]="auth.homeForRole(session.role)" class="mp-button mp-button-dark mp-button-lg">Open your workspace <i class="pi pi-arrow-right"></i></a> } @else { <a pButton routerLink="/login" [queryParams]="{ role: 'partner', returnUrl: '/partner/donations/new' }" class="mp-button network-cta mp-button-lg">Start a food rescue <i class="pi pi-arrow-right"></i></a> }
          </div>
        </div>
        <figure class="network-hero-visual landing-reveal"><div class="hero-image-frame"><img src="/food-waste-matcher-hero.png" alt="A restaurant worker handing reusable meal containers to an NGO pickup volunteer" /></div><figcaption class="hero-proof-card"><span><i class="pi pi-check-circle"></i> A local handoff, not a delivery order</span><strong>Clear details make a good pickup possible.</strong></figcaption><div class="hero-route-card"><div><span>LOCAL RESCUE ROUTE</span><b><i class="pi pi-circle-fill"></i> Ready to coordinate</b></div><ol><li><i class="pi pi-shop"></i><span><small>FOOD PARTNER</small><strong>Shares food and pickup window</strong></span></li><li><i class="pi pi-map-marker"></i><span><small>FOOD WASTE MATCHER AI</small><strong>Matches nearby capacity</strong></span></li><li><i class="pi pi-heart"></i><span><small>VERIFIED NGO</small><strong>Confirms the collection</strong></span></li></ol></div></figure>
      </section>

      <section class="network-principles page-width">
        <div class="network-section-heading landing-reveal"><span class="kicker">DESIGNED AROUND A REAL HANDOFF</span><h2>Warm like a restaurant. Clear like a route. <span class="type-accent">Trusted like a community.</span></h2><p>Food Waste Matcher AI keeps the signals that matter and removes the rest.</p></div>
        <div class="principle-grid">
          <article class="principle-card food landing-reveal"><span class="principle-icon"><i class="pi pi-shop"></i></span><span>FOOD BUSINESS</span><h3>Food needs context.</h3><p>Quantity, dietary information, and a realistic collection time appear before anyone commits.</p><small><i class="pi pi-clock"></i> Ready when the kitchen says so</small></article>
          <article class="principle-card route landing-reveal"><span class="principle-icon"><i class="pi pi-map-marker"></i></span><span>LOCAL COORDINATION</span><h3>Every minute needs a signal.</h3><p>Location, service radius, and pickup window make the next action easy to understand.</p><small><i class="pi pi-directions-alt"></i> Match nearby, then coordinate direct</small></article>
          <article class="principle-card trust landing-reveal"><span class="principle-icon"><i class="pi pi-heart"></i></span><span>NGO TEAMS</span><h3>Trust is part of the route.</h3><p>Organizations are reviewed manually, and people—not AI—make the collection decision.</p><small><i class="pi pi-verified"></i> Responsible by design</small></article>
        </div>
      </section>

      <section id="how-it-works" class="flow-section network-flow page-width">
        <div class="flow-intro landing-reveal"><span class="kicker">ONE LOCAL RESCUE FLOW</span><h2>Post the facts. Find capacity. <span class="type-accent">Close the loop.</span></h2><p>A focused handoff has three moments—each with a clear owner and no unnecessary delivery-platform complexity.</p></div>
        <div class="flow-steps">
          <article class="landing-reveal"><span>01</span><div><small>FOOD PARTNER</small><h3>Share what is ready</h3><p>Enter food, quantity, pickup location, and collection window. AI can organize details; your team confirms them.</p></div></article>
          <article class="landing-reveal"><span>02</span><div><small>LOCAL MATCH</small><h3>Find nearby capacity</h3><p>Eligible NGOs see suitable food inside their service area and decide whether they can collect it in time.</p></div></article>
          <article class="landing-reveal"><span>03</span><div><small>DIRECT HANDOFF</small><h3>Coordinate and confirm</h3><p>Once accepted, both teams unlock contact details and record the completed pickup together.</p></div></article>
        </div>
      </section>

      <section id="businesses" class="network-business page-width">
        <div class="split-copy landing-reveal"><span class="kicker">FOR FOOD PARTNERS</span><h2>Posting surplus should feel <span class="type-accent">as clear as a kitchen ticket.</span></h2><p>Share only the operational details needed for a successful pickup. The right NGO sees the post, not a public marketplace.</p><ul class="check-list"><li><i class="pi pi-check"></i> Food, quantity, and dietary details</li><li><i class="pi pi-check"></i> Pickup time and exact location</li><li><i class="pi pi-check"></i> Direct contact only after acceptance</li></ul>@if (auth.session(); as session) { <a [routerLink]="auth.homeForRole(session.role)" class="inline-arrow">Open your workspace <i class="pi pi-arrow-up-right"></i></a> } @else { <a routerLink="/login" [queryParams]="{ role: 'partner' }" class="inline-arrow">Food Partner login <i class="pi pi-arrow-up-right"></i></a> }</div>
        <article class="food-post-preview landing-reveal"><header><span>EXAMPLE FOOD POST</span><b><i class="pi pi-clock"></i> Ready today</b></header><div class="food-post-title"><span><i class="pi pi-box"></i></span><div><h3>Vegetarian meal boxes</h3><p>35 meals · Freshly prepared</p></div></div><dl><div><dt>Pickup point</dt><dd>Dolmen Mall, Clifton</dd></div><div><dt>Collection by</dt><dd>8:00 PM</dd></div><div><dt>Visibility</dt><dd>Nearby verified NGOs</dd></div></dl><footer><span><i class="pi pi-map-marker"></i> Location-aware matching</span><i class="pi pi-arrow-up-right"></i></footer></article>
      </section>

      <section id="ngos" class="ngo-band network-ngo">
        <div class="page-width ngo-band-inner"><div class="landing-reveal"><span class="kicker coral">FOR VERIFIED NGO TEAMS</span><h2>See nearby food while it can still be <span class="type-accent">collected.</span></h2><p>Every post tells your team what is ready, where it is, and until when—before you decide.</p></div><div class="ngo-feature-grid landing-reveal"><span><i class="pi pi-map-marker"></i> Nearby food</span><span><i class="pi pi-clock"></i> Clear deadline</span><span><i class="pi pi-phone"></i> Direct donor contact</span><span><i class="pi pi-shield"></i> Manual verification</span></div>@if (auth.session(); as session) { <a pButton [routerLink]="auth.homeForRole(session.role)" class="mp-button mp-button-light landing-reveal">Open workspace <i class="pi pi-arrow-right"></i></a> } @else { <a pButton routerLink="/login" [queryParams]="{ role: 'ngo' }" class="mp-button mp-button-light landing-reveal">NGO login <i class="pi pi-arrow-right"></i></a> }</div>
      </section>

      <section id="safety" class="network-safety page-width landing-reveal"><div class="safety-mark"><i class="pi pi-shield"></i></div><div><span class="kicker">BUILT AROUND HUMAN ACCOUNTABILITY</span><h2>AI organizes information. <span class="type-accent">People make the call.</span></h2><p>Food Waste Matcher AI never declares food safe. Food partners confirm each post, and NGO teams inspect it before they collect it.</p></div><a routerLink="/terms" class="inline-arrow">Read safety principles <i class="pi pi-arrow-right"></i></a></section>

      <section class="network-final page-width landing-reveal"><div><span class="eyebrow light">READY WHEN YOUR TEAM IS</span><h2>Give good food its <span class="type-accent">next destination.</span></h2><p>Start with one local, responsible handoff.</p></div>@if (auth.session(); as session) { <a pButton [routerLink]="auth.homeForRole(session.role)" class="mp-button mp-button-light mp-button-lg">Open your workspace <i class="pi pi-arrow-right"></i></a> } @else { <a pButton routerLink="/register" class="mp-button network-cta mp-button-lg">Join the network <i class="pi pi-arrow-right"></i></a> }</section>
    </main>
    <footer class="site-footer premium-footer network-footer"><div class="page-width premium-footer-main"><div class="footer-brand"><mp-brand /><p>Make surplus food visible to the people who can collect it—while it is still good to share.</p></div><div class="footer-column"><span>EXPLORE</span><nav><a href="#how-it-works">How it works</a><a href="#businesses">For food partners</a><a href="#ngos">For NGO teams</a><a href="#safety">Safety principles</a></nav></div><div class="footer-column footer-action"><span>START LOCALLY</span><p>One clear post can begin a direct, verified food rescue.</p>@if (auth.session(); as session) { <a [routerLink]="auth.homeForRole(session.role)" class="inline-arrow light-link">Open your workspace <i class="pi pi-arrow-up-right"></i></a> } @else { <a pButton routerLink="/register" class="mp-button footer-cta">Join Food Waste Matcher AI <i class="pi pi-arrow-up-right"></i></a> }</div></div><div class="page-width footer-bottom"><small>© 2026 Food Waste Matcher AI. A responsible local food rescue network.</small><div><a routerLink="/privacy">Privacy</a><a routerLink="/terms">Terms</a><a href="mailto:hello@foodmatcherai.org">Contact</a></div></div></footer>
  `
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private introTimeline?: gsap.core.Timeline;
  constructor(public readonly auth: AuthService) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = this.host.nativeElement.querySelectorAll('.network-hero .landing-reveal');
    this.introTimeline = gsap.timeline({ defaults: { duration: 0.56, ease: 'power3.out' } })
      .from(elements, { y: 14, stagger: 0.06, clearProps: 'transform' });
  }

  ngOnDestroy(): void { this.introTimeline?.kill(); }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, BrandComponent],
  template: `
    <main class="auth-page network-auth-page">
      <section class="auth-story"><mp-brand /><div><span class="eyebrow light">LOCAL FOOD SHARING</span><h1>Post, accept, and coordinate directly.</h1><p>A focused network for food businesses and verified NGOs—without delivery-platform complexity.</p></div></section>
      <section class="auth-form-panel"><div class="auth-form-wrap"><div class="mobile-brand"><mp-brand /></div><span class="kicker">SECURE WORKSPACE</span><h2>{{ auth.roleLabel(role()) }} login</h2><p>Use the account registered for this organization type.</p>
        <div class="login-role-switch" aria-label="Choose login type">
          <button type="button" [class.active]="role() === 'partner'" (click)="chooseRole('partner')"><i class="pi pi-shop"></i>Food Partner</button>
          <button type="button" [class.active]="role() === 'ngo'" (click)="chooseRole('ngo')"><i class="pi pi-heart"></i>NGO</button>
          <button type="button" [class.active]="role() === 'admin'" (click)="chooseRole('admin')"><i class="pi pi-shield"></i>Admin</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>Email address
            <input pInputText type="email" formControlName="email" placeholder="you@organization.org" [class.field-invalid]="fieldError('email')" [attr.aria-invalid]="fieldError('email') ? 'true' : null" />
            @if (fieldError('email'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
          </label>
          <label>Password
            <div class="password-field"><input pInputText [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="At least 6 characters" [class.field-invalid]="fieldError('password')" [attr.aria-invalid]="fieldError('password') ? 'true' : null" /><button type="button" class="password-toggle" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" (click)="showPassword.set(!showPassword())"><i [class]="showPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"></i></button></div>
            @if (fieldError('password'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
          </label>
          <div class="form-meta"><span><i class="pi pi-lock"></i> Role-protected access</span><a href="mailto:support@foodmatcherai.org?subject=Password%20reset">Forgot password?</a></div>
          @if (error()) { <div class="auth-error" role="alert"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }
          <button pButton type="submit" class="mp-button mp-button-dark entry-primary mp-button-block" [disabled]="loading()">@if (loading()) { <i class="pi pi-spin pi-spinner"></i> Signing in… } @else { Log in <i class="pi pi-arrow-right"></i> }</button>
        </form>
        @if (showHackathonAccounts) { <div class="demo-credentials reviewer-access"><div><span class="soft-chip">HACKATHON REVIEW</span><strong>Want to explore this workspace?</strong></div><button type="button" class="subtle-button" (click)="fillReviewerCredentials()">Use test account <i class="pi pi-arrow-right"></i></button></div> }
        <p class="auth-footer">New to Food Waste Matcher AI? <a class="entry-link" routerLink="/register">Create an organization account <i class="pi pi-arrow-right"></i></a></p>
      </div></section>
    </main>
  `
})
export class LoginComponent implements OnInit {
  readonly role = signal<AppRole>('partner');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly showPassword = signal(false);
  readonly form = new FormGroup({ email: new FormControl('', [Validators.required, Validators.email]), password: new FormControl('', [Validators.required, Validators.minLength(6)]) });
  constructor(public readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute) {}
  ngOnInit(): void {
    const requestedRole = this.route.snapshot.queryParamMap.get('role');
    if (requestedRole === 'partner' || requestedRole === 'ngo' || requestedRole === 'admin') this.role.set(requestedRole);
  }
  get showHackathonAccounts(): boolean { return environment.hackathonDemoAccounts === true; }
  chooseRole(role: AppRole): void { this.role.set(role); this.error.set(''); this.submitted.set(false); this.showPassword.set(false); this.form.reset(); }
  fillReviewerCredentials(): void { this.form.setValue(this.reviewerCredentials()); this.error.set(''); this.submitted.set(false); }
  private reviewerCredentials(): { email: string; password: string } {
    const emailByRole: Record<AppRole, string> = {
      partner: 'partner.demo@foodwastematcherai.test', ngo: 'ngo.demo@foodwastematcherai.test', admin: 'admin.demo@foodwastematcherai.test'
    };
    return { email: emailByRole[this.role()], password: 'Demo@FoodWaste26' };
  }
  fieldError(controlName: 'email' | 'password'): string {
    const control = this.form.controls[controlName];
    if (!this.submitted() && !control.touched) return '';
    if (control.hasError('required')) return controlName === 'email' ? 'Email address is required.' : 'Password is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('minlength')) return 'Password must be at least 6 characters.';
    return '';
  }
  async submit(): Promise<void> {
    if (this.loading()) return;
    this.submitted.set(true);
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Please correct the highlighted fields.'); return; }
    this.loading.set(true); this.error.set('');
    const result = await this.auth.signIn(this.form.controls.email.value!, this.form.controls.password.value!, this.role());
    this.loading.set(false);
    if (!result.success) { this.error.set(result.message ?? 'Unable to log in.'); return; }
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = requested?.startsWith(`/${this.role()}/`) ? requested : this.auth.homeForRole(this.role());
    await this.router.navigateByUrl(destination);
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, BrandComponent],
  template: `
    <main class="register-page premium-register-page network-register-page"><header class="register-header premium-register-header network-entry-header"><div class="page-width"><mp-brand /><span>Already registered? <a class="entry-link" routerLink="/login">Log in <i class="pi pi-arrow-right"></i></a></span></div></header>
      <section class="register-wrap premium-register-wrap page-width"><div class="register-intro premium-register-intro"><span class="kicker">JOIN THE RESCUE NETWORK</span><h1>Build your local <span class="type-accent">rescue network.</span></h1><p>Your organization gets a focused workspace to post, match, and coordinate food handoffs responsibly.</p><div class="register-proof"><span><i class="pi pi-shield"></i> Manual organization verification</span><span><i class="pi pi-map-marker"></i> Location-aware matching</span></div><div class="register-process" aria-label="Your registration journey"><div><b>01</b><span><strong>Choose your role</strong><small>Food Partner or NGO</small></span></div><div><b>02</b><span><strong>Share essential details</strong><small>Identity, address and contact</small></span></div><div><b>03</b><span><strong>Start coordinating</strong><small>After your account is verified</small></span></div></div></div>
        <div class="register-card premium-register-card"><div class="register-card-intro"><span class="step-count">CREATE YOUR ORGANIZATION ACCOUNT</span><h2>How will you use Food Waste Matcher AI?</h2><p>This helps us prepare the right workspace and review details.</p></div>
          <div class="role-options">
            <button type="button" [class.selected]="role() === 'partner'" (click)="chooseRole('partner')"><i class="pi pi-shop"></i><span><strong>Food Partner</strong><small>Restaurant, hotel, caterer, cloud kitchen or store</small></span><i class="pi pi-check-circle"></i></button>
            <button type="button" [class.selected]="role() === 'ngo'" (click)="chooseRole('ngo')"><i class="pi pi-heart"></i><span><strong>NGO / Food rescue group</strong><small>Receive opportunities and coordinate pickup volunteers</small></span><i class="pi pi-check-circle"></i></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="continue()" novalidate>
            <label>Organization name
              <input pInputText formControlName="organization" maxlength="160" placeholder="e.g. Saffron Table" [class.field-invalid]="fieldError('organization')" [attr.aria-invalid]="fieldError('organization') ? 'true' : null" />
              @if (fieldError('organization'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
            </label>
            <div class="form-grid">
              <label>Your name
                <input pInputText formControlName="name" maxlength="120" placeholder="Full name" [class.field-invalid]="fieldError('name')" [attr.aria-invalid]="fieldError('name') ? 'true' : null" />
                @if (fieldError('name'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
              <label>Work phone
                <input pInputText type="tel" formControlName="phone" maxlength="30" autocomplete="tel" placeholder="+92 300…" [class.field-invalid]="fieldError('phone')" [attr.aria-invalid]="fieldError('phone') ? 'true' : null" />
                @if (fieldError('phone'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
            </div>
            <label>Street address
              <input pInputText formControlName="address" maxlength="500" autocomplete="street-address" placeholder="Building, street and landmark" [class.field-invalid]="fieldError('address')" [attr.aria-invalid]="fieldError('address') ? 'true' : null" />
              @if (fieldError('address'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
            </label>
            <div class="form-grid">
              <label>Local area
                <input pInputText formControlName="area" maxlength="100" placeholder="e.g. Clifton" [class.field-invalid]="fieldError('area')" [attr.aria-invalid]="fieldError('area') ? 'true' : null" />
                @if (fieldError('area'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
              <label>City
                <input pInputText formControlName="city" maxlength="100" autocomplete="address-level2" placeholder="e.g. Karachi" [class.field-invalid]="fieldError('city')" [attr.aria-invalid]="fieldError('city') ? 'true' : null" />
                @if (fieldError('city'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
            </div>
            <div class="form-grid">
              <label>State
                <input pInputText formControlName="state" maxlength="100" autocomplete="address-level1" placeholder="e.g. Sindh" [class.field-invalid]="fieldError('state')" [attr.aria-invalid]="fieldError('state') ? 'true' : null" />
                @if (fieldError('state'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
              <label>5-digit postal code
                <input pInputText inputmode="numeric" maxlength="5" autocomplete="postal-code" formControlName="pincode" placeholder="74200" [class.field-invalid]="fieldError('pincode')" [attr.aria-invalid]="fieldError('pincode') ? 'true' : null" />
                @if (fieldError('pincode'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
              </label>
            </div>
            <div class="location-capture">
              <span class="location-capture-icon"><i class="pi pi-map-marker"></i></span>
              <div><strong>{{ hasCoordinates() ? 'Location pin captured' : 'Add a location pin for accurate matching' }}</strong><small>{{ hasCoordinates() ? 'Nearby NGOs will be calculated from this pin.' : 'Without a pin, Food Waste Matcher AI safely falls back to exact pincode matching.' }}</small></div>
              <button type="button" class="subtle-button" (click)="useCurrentLocation()" [disabled]="locationLoading()">@if (locationLoading()) { <i class="pi pi-spin pi-spinner"></i> Locating… } @else { <i class="pi pi-crosshairs"></i> {{ hasCoordinates() ? 'Update pin' : 'Use current location' }} }</button>
            </div>
            @if (locationError()) { <div class="field-help warning"><i class="pi pi-info-circle"></i>{{ locationError() }}</div> }
            @if (role() === 'ngo') {
              <div class="ngo-match-settings"><span class="kicker">NGO PICKUP CAPACITY</span><div class="form-grid"><label>Pickup radius (km)<input pInputText type="number" min="1" max="100" formControlName="serviceRadiusKm" [class.field-invalid]="fieldError('serviceRadiusKm')" [attr.aria-invalid]="fieldError('serviceRadiusKm') ? 'true' : null" />@if (fieldError('serviceRadiusKm'); as message) { <small class="field-error" role="alert">{{ message }}</small> }</label><label>Maximum meals per pickup<input pInputText type="number" min="1" max="10000" formControlName="maxMealsPerPickup" [class.field-invalid]="fieldError('maxMealsPerPickup')" [attr.aria-invalid]="fieldError('maxMealsPerPickup') ? 'true' : null" />@if (fieldError('maxMealsPerPickup'); as message) { <small class="field-error" role="alert">{{ message }}</small> }</label></div><label class="confirm-control compact"><input type="checkbox" formControlName="acceptsNonVegetarian" /><span><strong>We can collect non-vegetarian or mixed food</strong><small>Leave unchecked if your organization accepts vegetarian food only.</small></span></label></div>
            }
            <label>Work email
              <input pInputText type="email" formControlName="email" maxlength="254" autocomplete="email" placeholder="you@organization.org" [class.field-invalid]="fieldError('email')" [attr.aria-invalid]="fieldError('email') ? 'true' : null" />
              @if (fieldError('email'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
            </label>
            <label>Create password
              <input pInputText type="password" formControlName="password" minlength="6" maxlength="128" autocomplete="new-password" placeholder="At least 6 characters, one uppercase letter, number and special character" [class.field-invalid]="fieldError('password')" [attr.aria-invalid]="fieldError('password') ? 'true' : null" />
              @if (fieldError('password'); as message) { <small class="field-error" role="alert">{{ message }}</small> }
            </label>
          @if (error()) { <div class="auth-error" role="alert"><i class="pi pi-exclamation-circle"></i>{{ error() }}</div> }
          @if (confirmationMessage()) { <div class="auth-success" role="status"><i class="pi pi-envelope"></i>{{ confirmationMessage() }}</div> }
          <button pButton type="submit" class="mp-button mp-button-dark entry-primary mp-button-block" [disabled]="loading()">@if (loading()) { <i class="pi pi-spin pi-spinner"></i> Creating account… } @else { Create account <i class="pi pi-arrow-right"></i> }</button></form><p class="fine-print"><i class="pi pi-lock"></i> Your contact details unlock only for an accepted pickup.</p>
        </div>
      </section>
    </main>
  `
})
export class RegisterComponent {
  readonly role = signal<'partner' | 'ngo'>('partner');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);
  readonly confirmationMessage = signal('');
  readonly locationLoading = signal(false);
  readonly locationError = signal('');
  readonly form = new FormGroup({
    organization: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]),
    name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    phone: new FormControl('', [Validators.required, Validators.pattern(/^\+?[0-9][0-9\s-]{6,29}$/), Validators.maxLength(30)]),
    address: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]),
    area: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    city: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    state: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    pincode: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]),
    latitude: new FormControl<number | null>(null),
    longitude: new FormControl<number | null>(null),
    serviceRadiusKm: new FormControl(10, [Validators.required, Validators.min(1), Validators.max(100)]),
    maxMealsPerPickup: new FormControl(100, [Validators.required, Validators.min(1), Validators.max(10000)]),
    acceptsNonVegetarian: new FormControl(false),
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(254)]),
    password: new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(128), Validators.pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/)])
  });
  constructor(private readonly auth: AuthService, private readonly router: Router) {}
  chooseRole(role: 'partner' | 'ngo'): void { this.role.set(role); this.error.set(''); this.confirmationMessage.set(''); this.submitted.set(false); }
  hasCoordinates(): boolean { return this.form.controls.latitude.value != null && this.form.controls.longitude.value != null; }
  fieldError(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || (!this.submitted() && !control.touched)) return '';
    if (control.valid) return '';
    const labels: Record<string, string> = {
      organization: 'Organization name', name: 'Your name', phone: 'Work phone', address: 'Street address', area: 'Local area', city: 'City', state: 'State',
      pincode: 'Pincode', serviceRadiusKm: 'Pickup radius', maxMealsPerPickup: 'Maximum meals per pickup', email: 'Work email', password: 'Password'
    };
    const label = labels[controlName] ?? 'This field';
    if (control.hasError('required')) return `${label} is required.`;
    if (control.hasError('email')) return 'Enter a valid work email address.';
    if (control.hasError('pattern')) {
      if (controlName === 'pincode') return 'Enter a valid 5-digit Pakistani postal code.';
      if (controlName === 'phone') return 'Enter a valid phone number, for example +92 300 1234567.';
      if (controlName === 'password') return 'Use at least 6 characters with an uppercase letter, number, and special character.';
    }
    const minLength = control.getError('minlength') as { requiredLength: number } | null;
    if (minLength) return `${label} must have at least ${minLength.requiredLength} characters.`;
    const maxLength = control.getError('maxlength') as { requiredLength: number } | null;
    if (maxLength) return `${label} must have no more than ${maxLength.requiredLength} characters.`;
    if (control.hasError('min') || control.hasError('max')) {
      if (controlName === 'serviceRadiusKm') return 'Choose a pickup radius from 1 to 100 km.';
      if (controlName === 'maxMealsPerPickup') return 'Enter a capacity from 1 to 10,000 meals.';
    }
    return 'Enter a valid value.';
  }
  useCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { this.locationError.set('Location is not supported on this device. Exact pincode matching will still work.'); return; }
    this.locationLoading.set(true); this.locationError.set('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { this.form.patchValue({ latitude: coords.latitude, longitude: coords.longitude }); this.locationLoading.set(false); },
      () => { this.locationError.set('Location permission was not available. Confirm the pincode carefully; matching will use that pincode.'); this.locationLoading.set(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  }
  async continue(): Promise<void> {
    if (this.loading()) return;
    this.submitted.set(true);
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Please correct the highlighted fields.'); return; }
    this.loading.set(true); this.error.set(''); this.confirmationMessage.set('');
    const value = this.form.getRawValue();
    const result = await this.auth.register({
      email: value.email!, password: value.password!, role: this.role(), name: value.name!, organization: value.organization!, phone: value.phone!,
      address: value.address!, area: value.area!, city: value.city!, state: value.state!, pincode: value.pincode!,
      latitude: value.latitude, longitude: value.longitude,
      serviceRadiusKm: value.serviceRadiusKm!, maxMealsPerPickup: value.maxMealsPerPickup!, acceptsNonVegetarian: Boolean(value.acceptsNonVegetarian)
    });
    this.loading.set(false);
    if (!result.success) { this.error.set(result.message ?? 'Unable to create this account.'); return; }
    if (result.requiresEmailConfirmation) { this.confirmationMessage.set(result.message ?? 'Check your email to continue.'); return; }
    await this.router.navigateByUrl(this.auth.homeForRole(this.role()));
  }
}

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, BrandComponent],
  template: `
    <header class="legal-header page-width"><mp-brand /><a routerLink="/">Back to home</a></header>
    <main class="legal-page page-width"><aside><span>LEGAL</span><a routerLink="/privacy" routerLinkActive="active">Privacy policy</a><a routerLink="/terms" routerLinkActive="active">Terms of service</a></aside><article><span class="kicker">LAST UPDATED · 13 SEPTEMBER 2026</span><h1>{{ title() }}</h1><p class="legal-lead">This prototype policy explains the principles Food Waste Matcher AI will use while the production legal documents are reviewed.</p>
      <h2>1. Information we handle</h2><p>Food Waste Matcher AI stores organization identity, authorized team members, outlet and service-area locations, donation details, timestamps and handoff evidence. The product should collect only what a rescue genuinely needs.</p>
      <h2>2. Responsible AI</h2><p>AI may convert typed descriptions or images into structured fields and identify missing information. A human must confirm every donation. AI does not certify food safety, determine legal compliance or make irreversible decisions.</p>
      <h2>3. Location and notifications</h2><p>Approximate organization locations support matching. Precise pickup details are shared only with eligible, verified participants during an active rescue.</p>
      <h2>4. Safety and accountability</h2><p>Food Partners remain responsible for truthful preparation and handling information. NGOs decide whether an opportunity fits their policy and capacity. Food Waste Matcher AI records the handoff but does not replace local food-safety obligations.</p>
      <div class="legal-note"><i class="pi pi-info-circle"></i><span><strong>Pilot notice</strong>Before a public launch, obtain legal review, location consent, and verified partner documentation.</span></div>
    </article></main>
  `
})
export class LegalComponent {
  readonly title = computed(() => this.route.snapshot.data['legal'] === 'terms' ? 'Terms of service' : 'Privacy policy');
  constructor(private readonly route: ActivatedRoute) {}
}

@Component({
  standalone: true,
  imports: [RouterLink, ButtonModule, BrandComponent],
  template: `<main class="not-found"><mp-brand /><span>404</span><h1>This Food Waste Matcher AI went off route.</h1><p>The page does not exist, but tonight’s rescue opportunities do.</p><a pButton routerLink="/" class="mp-button mp-button-dark">Return home</a></main>`
})
export class NotFoundComponent {}
