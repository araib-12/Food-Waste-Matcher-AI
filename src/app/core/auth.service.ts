import { computed, inject, Injectable, signal } from '@angular/core';
import { AppRole } from './models';
import { SupabaseService } from './supabase.service';

const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/;
const passwordRequirementMessage = 'Use at least 6 characters with an uppercase letter, number, and special character.';

export interface AppSession {
  userId: string;
  email: string;
  role: AppRole;
  name: string;
  organization: string;
  phone: string;
  organizationId: string | null;
  area: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  acceptingDonations: boolean;
  serviceRadiusKm: number;
  maxMealsPerPickup: number;
  acceptsNonVegetarian: boolean;
  organizationStatus: 'pending' | 'verified' | 'suspended' | 'admin';
}

export interface AuthResult {
  success: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

export interface RegistrationInput {
  email: string;
  password: string;
  role: Exclude<AppRole, 'admin'>;
  name: string;
  organization: string;
  phone: string;
  area: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  maxMealsPerPickup: number;
  acceptsNonVegetarian: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly initialization: Promise<void>;
  readonly session = signal<AppSession | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isDemoMode = false;
  readonly isConfigured = this.supabase.client !== null;

  constructor() {
    this.initialization = this.supabase.client ? this.restoreSupabaseSession() : Promise.resolve();
  }

  ready(): Promise<void> { return this.initialization; }

  async signIn(email: string, password: string, expectedRole: AppRole): Promise<AuthResult> {
    const client = this.supabase.client;
    if (!client) return { success: false, message: 'The Food Waste Matcher AI database is not configured yet.' };

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.user) return { success: false, message: 'Email or password is incorrect.' };

    const session = await this.loadProfile(data.user.id, data.user.email ?? normalizedEmail);
    if (!session) {
      await client.auth.signOut();
      return { success: false, message: 'Your organization profile could not be loaded.' };
    }
    if (session.role !== expectedRole) {
      await client.auth.signOut();
      return { success: false, message: `This account is not registered as ${this.roleLabel(expectedRole)}.` };
    }

    this.persistSession(session);
    return { success: true };
  }

  async register(input: RegistrationInput): Promise<AuthResult> {
    const client = this.supabase.client;
    if (!client) return { success: false, message: 'The Food Waste Matcher AI database is not configured yet.' };
    if (input.password.length < 6 || input.password.length > 128 || !passwordPattern.test(input.password)) {
      return { success: false, message: passwordRequirementMessage };
    }

    const email = input.email.trim().toLowerCase();
    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          role: input.role,
          full_name: input.name.trim(),
          organization: input.organization.trim(),
          phone: input.phone.trim(),
          area: input.area.trim(),
          address: input.address.trim(),
          city: input.city.trim(),
          state: input.state.trim(),
          pincode: input.pincode.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          service_radius_km: input.serviceRadiusKm,
          max_meals_per_pickup: input.maxMealsPerPickup,
          accepts_non_vegetarian: input.acceptsNonVegetarian
        }
      }
    });
    if (error || !data.user) return { success: false, message: 'Unable to create this account. Check the details and password requirements.' };
    if (!data.session) return { success: true, requiresEmailConfirmation: true, message: 'Check your email to confirm the account, then log in.' };

    const session = await this.loadProfile(data.user.id, email);
    if (!session) return { success: false, message: 'Account created, but the organization profile could not be loaded.' };
    this.persistSession(session);
    return { success: true };
  }

  async signOut(): Promise<void> {
    if (this.supabase.client) await this.supabase.client.auth.signOut();
    this.clearSession();
  }

  homeForRole(role: AppRole): string { return `/${role}/dashboard`; }
  roleLabel(role: AppRole): string { return role === 'partner' ? 'Food Partner' : role === 'ngo' ? 'NGO' : 'Admin'; }
  demoCredentials(_role: AppRole): { email: string; password: string } { return { email: '', password: '' }; }

  updateNgoAvailability(acceptingDonations: boolean): void {
    const session = this.session();
    if (!session || session.role !== 'ngo') return;
    this.persistSession({ ...session, acceptingDonations });
  }

  /** Refreshes the role and verification status after a server-side change. */
  async refreshCurrentSession(): Promise<void> {
    const current = this.session();
    if (!current || !this.supabase.client) return;
    const refreshed = await this.loadProfile(current.userId, current.email);
    if (refreshed) this.persistSession(refreshed);
  }

  private async restoreSupabaseSession(): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const { data } = await client.auth.getUser();
    if (!data.user) { this.clearSession(); return; }
    const session = await this.loadProfile(data.user.id, data.user.email ?? '');
    if (session) this.persistSession(session);
  }

  private async loadProfile(userId: string, email: string): Promise<AppSession | null> {
    const client = this.supabase.client;
    if (!client) return null;
    const { data, error } = await client.rpc('get_my_session_profile');
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row || row['user_id'] !== userId) return null;
    const role = row['app_role'] as AppRole;
    return {
      userId,
      email,
      role,
      name: String(row['full_name'] ?? 'Food Waste Matcher AI member'),
      organization: role === 'admin' ? 'Food Waste Matcher AI Network' : String(row['organization_name'] ?? 'Organization'),
      phone: String(row['phone'] ?? ''),
      organizationId: row['organization_id'] as string | null,
      area: role === 'admin' ? 'All areas' : String(row['area'] ?? ''),
      address: role === 'admin' ? '' : String(row['address'] ?? ''),
      city: role === 'admin' ? 'All cities' : String(row['city'] ?? ''),
      state: role === 'admin' ? 'All states' : String(row['state'] ?? ''),
      pincode: role === 'admin' ? '' : String(row['pincode'] ?? ''),
      latitude: role === 'admin' || row['latitude'] == null ? null : Number(row['latitude']),
      longitude: role === 'admin' || row['longitude'] == null ? null : Number(row['longitude']),
      acceptingDonations: role === 'ngo' ? Boolean(row['accepting_donations']) : false,
      serviceRadiusKm: Number(row['service_radius_km'] ?? 10),
      maxMealsPerPickup: Number(row['max_meals_per_pickup'] ?? 100),
      acceptsNonVegetarian: Boolean(row['accepts_non_vegetarian']),
      organizationStatus: role === 'admin' ? 'admin' : (row['organization_status'] as AppSession['organizationStatus'] ?? 'pending')
    };
  }

  private persistSession(session: AppSession): void {
    this.session.set(session);
  }

  private clearSession(): void {
    this.session.set(null);
  }
}
