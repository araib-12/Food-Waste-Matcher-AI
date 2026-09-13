import { computed, inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { AppNotification, Donation, DonationContact, DonationExtraction, DonationStatus, OrganizationReview, OrganizationSummary } from './models';
import { SupabaseService } from './supabase.service';

type RelationName = { name?: string } | Array<{ name?: string }> | null;

interface DonationRow {
  id: string;
  public_id: string;
  partner_organization_id: string;
  accepted_by: string | null;
  accepted_at: string | null;
  status: string;
  food_name: string;
  estimated_meals: number;
  category: string;
  dietary: Donation['dietary'];
  prepared_at_text: string;
  pickup_by_text: string;
  prepared_at: string | null;
  pickup_by: string | null;
  outlet_name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  handling_notes: string | null;
  created_at: string;
  partner: RelationName;
  accepted_ngo: RelationName;
}

interface DonationDistanceRow {
  donation_id: string;
  distance_km: number | string | null;
  match_basis: Donation['matchBasis'];
}

interface OrganizationProfileRow {
  organization_id: string | null;
  full_name: string;
  phone: string;
}

interface OrganizationDirectoryRow {
  id: string;
  name: string;
  role: OrganizationSummary['role'];
  area: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: OrganizationSummary['status'];
  accepting_donations: boolean;
  service_radius_km: number | string;
  max_meals_per_pickup: number;
  accepts_non_vegetarian: boolean;
  created_at: string;
}

interface OrganizationReviewRow {
  id: string;
  previous_status: OrganizationReview['previousStatus'];
  new_status: OrganizationReview['newStatus'];
  location_confirmed: boolean;
  phone_confirmed: boolean;
  evidence_confirmed: boolean;
  note: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private realtimeChannel: RealtimeChannel | null = null;

  readonly donations = signal<Donation[]>([]);
  readonly notifications = signal<AppNotification[]>([]);
  readonly organizations = signal<OrganizationSummary[]>([]);
  readonly organizationReviews = signal<Record<string, OrganizationReview[]>>({});
  readonly contacts = signal<Record<string, DonationContact>>({});
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly isConfigured = this.supabase.client !== null;

  readonly activeDonations = computed(() => this.donations().filter((item) => !['Completed', 'Expired', 'Cancelled'].includes(item.status)));
  readonly completedMeals = computed(() => this.donations().filter((item) => item.status === 'Completed').reduce((sum, item) => sum + item.meals, 0));

  async refresh(): Promise<void> {
    if (this.loading()) return;
    const client = this.supabase.client;
    const session = this.auth.session();
    if (!client) {
      this.error.set('Connect your Supabase project to use the shared Food Waste Matcher AI database.');
      this.initialized.set(true);
      return;
    }
    if (!session) return;

    this.loading.set(true);
    this.error.set('');
    try {
      await Promise.all([
        this.loadDonations(),
        this.loadNotifications(),
        session.role === 'admin' ? this.loadOrganizations() : Promise.resolve()
      ]);
      this.subscribeToChanges();
    } catch (error) {
      this.error.set(this.message(error, 'Unable to load Food Waste Matcher AI data.'));
    } finally {
      this.loading.set(false);
      this.initialized.set(true);
    }
  }

  findDonation(id: string | null): Donation | null {
    return this.donations().find((item) => item.id === id) ?? null;
  }

  async publishDonation(input: DonationExtraction & {
    outlet: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number | null;
    longitude: number | null;
  }): Promise<Donation> {
    const client = this.requireClient();
    this.actionError.set('');
    const { data, error } = await client.rpc('create_donation', {
      p_food_name: input.foodName,
      p_estimated_meals: input.meals,
      p_category: input.category,
      p_dietary: input.dietary,
      p_prepared_at: input.preparedAt,
      p_pickup_by: input.pickupBy,
      p_outlet_name: input.outlet,
      p_address: input.address,
      p_city: input.city,
      p_state: input.state,
      p_pincode: input.pincode,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_handling_notes: input.notes
    });
    if (error || !data) throw this.fail(error?.message ?? 'Unable to post this food.');
    const row = (Array.isArray(data) ? data[0] : data) as DonationRow;
    await this.refresh();
    return this.findDonation(row.public_id) ?? this.mapDonation(row);
  }

  async acceptDonation(id: string, _ngo?: string): Promise<void> {
    await this.runDonationAction('accept_donation', id);
  }

  async rejectDonation(id: string): Promise<void> {
    const client = this.requireClient();
    this.actionError.set('');
    const { error } = await client.rpc('reject_donation', { p_public_id: id });
    if (error) throw this.fail(error.message);
    await this.refresh();
  }

  async setStatus(id: string, status: DonationStatus): Promise<void> {
    const functionName = status === 'Picked Up'
      ? 'mark_donation_picked_up'
      : status === 'Completed'
        ? 'complete_donation'
        : status === 'Cancelled'
          ? 'cancel_donation'
          : '';
    if (!functionName) throw this.fail('This status change is not allowed.');
    await this.runDonationAction(functionName, id);
  }

  async setNgoAvailability(accepting: boolean): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('set_ngo_availability', { p_accepting: accepting });
    if (error) throw this.fail(error.message);
    this.auth.updateNgoAvailability(accepting);
    await this.refresh();
  }

  async setOrganizationStatus(id: string, status: OrganizationSummary['status']): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('set_organization_status', { p_organization_id: id, p_status: status });
    if (error) throw this.fail(error.message);
    await this.loadOrganizations();
  }

  async updateMyOrganization(input: {
    name: string;
    fullName: string;
    phone: string;
    area: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number | null;
    longitude: number | null;
    serviceRadiusKm: number | null;
    maxMealsPerPickup: number | null;
    acceptsNonVegetarian: boolean | null;
    resubmissionNote: string;
  }): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('update_my_organization', {
      p_name: input.name.trim(),
      p_full_name: input.fullName.trim(),
      p_phone: input.phone.trim(),
      p_area: input.area.trim(),
      p_address: input.address.trim(),
      p_city: input.city.trim(),
      p_state: input.state.trim(),
      p_pincode: input.pincode.trim(),
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_service_radius_km: input.serviceRadiusKm,
      p_max_meals_per_pickup: input.maxMealsPerPickup,
      p_accepts_non_vegetarian: input.acceptsNonVegetarian,
      p_resubmission_note: input.resubmissionNote.trim()
    });
    if (error) throw this.fail(error.message);
    await this.auth.refreshCurrentSession();
    await this.refresh();
  }

  async reviewOrganization(input: {
    organizationId: string;
    status: Extract<OrganizationSummary['status'], 'verified' | 'suspended'>;
    locationConfirmed: boolean;
    phoneConfirmed: boolean;
    evidenceConfirmed: boolean;
    note: string;
  }): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('review_organization', {
      p_organization_id: input.organizationId,
      p_status: input.status,
      p_location_confirmed: input.locationConfirmed,
      p_phone_confirmed: input.phoneConfirmed,
      p_evidence_confirmed: input.evidenceConfirmed,
      p_note: input.note.trim()
    });
    if (error) throw this.fail(error.message);
    await Promise.all([this.loadOrganizations(), this.loadOrganizationReviewHistory(input.organizationId)]);
  }

  async loadOrganizationReviewHistory(organizationId: string): Promise<void> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_organization_review_history', { p_organization_id: organizationId });
    if (error) throw this.fail(error.message);
    this.organizationReviews.update((current) => ({
      ...current,
      [organizationId]: ((data ?? []) as OrganizationReviewRow[]).map((row) => ({
        id: String(row.id),
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        locationConfirmed: Boolean(row.location_confirmed),
        phoneConfirmed: Boolean(row.phone_confirmed),
        evidenceConfirmed: Boolean(row.evidence_confirmed),
        note: String(row.note ?? ''),
        createdAt: String(row.created_at)
      }))
    }));
  }

  async markNotificationsRead(notificationIds?: string[]): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.rpc('mark_notifications_read', { p_notification_ids: notificationIds?.length ? notificationIds : null });
    if (error) throw this.fail(error.message);
    const target = notificationIds ? new Set(notificationIds) : null;
    this.notifications.update((items) => items.map((item) => !target || target.has(item.id) ? { ...item, unread: false } : item));
  }

  async loadContact(id: string): Promise<DonationContact | null> {
    const existing = this.contacts()[id];
    if (existing) return existing;
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_donation_contact', { p_public_id: id });
    if (error) throw this.fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const contact: DonationContact = {
      fullName: String(row.full_name ?? ''),
      organizationName: String(row.organization_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      role: row.role
    };
    this.contacts.update((items) => ({ ...items, [id]: contact }));
    return contact;
  }

  contactFor(id: string): DonationContact | null { return this.contacts()[id] ?? null; }

  private async runDonationAction(functionName: string, id: string): Promise<void> {
    const client = this.requireClient();
    this.actionError.set('');
    const { error } = await client.rpc(functionName, { p_public_id: id });
    if (error) throw this.fail(error.message);
    await this.refresh();
    const updated = this.findDonation(id);
    if (updated?.acceptedOrganizationId) await this.loadContact(id).catch(() => null);
  }

  private async loadDonations(): Promise<void> {
    const client = this.requireClient();
    const { error: expiryError } = await client.rpc('refresh_expired_donations');
    if (expiryError) throw expiryError;
    const { data, error } = await client
      .from('donations')
      .select('id, public_id, partner_organization_id, accepted_by, accepted_at, status, food_name, estimated_meals, category, dietary, prepared_at_text, pickup_by_text, prepared_at, pickup_by, outlet_name, address, area, city, state, pincode, pickup_latitude, pickup_longitude, handling_notes, created_at, partner:organizations!donations_partner_organization_id_fkey(name), accepted_ngo:organizations!donations_accepted_by_fkey(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    let mapped = ((data ?? []) as unknown as DonationRow[]).map((row) => this.mapDonation(row));
    if (this.auth.session()?.role === 'ngo' && mapped.length) {
      const { data: distances, error: distanceError } = await client.rpc('get_my_donation_distances');
      if (distanceError) throw distanceError;
      const byId = new Map(((distances ?? []) as DonationDistanceRow[]).map((row) => [String(row.donation_id), row]));
      mapped = mapped.map((item) => {
        const distance = byId.get(item.dbId);
        return distance ? { ...item, distanceKm: distance.distance_km == null ? undefined : Number(distance.distance_km), matchBasis: distance.match_basis as Donation['matchBasis'] } : item;
      });
      mapped.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
    }
    this.donations.set(mapped);
  }

  private async loadNotifications(): Promise<void> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('notifications')
      .select('id, title, body, tone, donation_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    this.notifications.set((data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      tone: row.tone as AppNotification['tone'],
      unread: !row.read_at,
      donationId: row.donation_id ? String(row.donation_id) : undefined,
      time: this.relativeTime(String(row.created_at))
    })));
  }

  private async loadOrganizations(): Promise<void> {
    const client = this.requireClient();
    const [{ data, error }, { data: profiles, error: profilesError }] = await Promise.all([
      client.rpc('get_admin_organizations'),
      client.from('profiles').select('organization_id, full_name, phone')
    ]);
    if (error) throw error;
    if (profilesError) throw profilesError;
    const profileByOrganization = new Map(
      ((profiles ?? []) as OrganizationProfileRow[])
        .filter((profile) => profile.organization_id)
        .map((profile) => [profile.organization_id!, profile])
    );
    this.organizations.set(((data ?? []) as OrganizationDirectoryRow[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      role: row.role as OrganizationSummary['role'],
      contactName: profileByOrganization.get(String(row.id))?.full_name ?? 'No contact assigned',
      contactPhone: profileByOrganization.get(String(row.id))?.phone ?? 'No phone provided',
      area: String(row.area),
      address: String(row.address ?? ''),
      city: String(row.city ?? ''),
      state: String(row.state ?? ''),
      pincode: String(row.pincode ?? ''),
      acceptingDonations: Boolean(row.accepting_donations),
      serviceRadiusKm: Number(row.service_radius_km ?? 10),
      maxMealsPerPickup: Number(row.max_meals_per_pickup ?? 100),
      acceptsNonVegetarian: Boolean(row.accepts_non_vegetarian),
      status: row.status as OrganizationSummary['status'],
      createdAt: String(row.created_at)
    })));
  }

  private mapDonation(row: DonationRow): Donation {
    return {
      dbId: row.id,
      id: row.public_id,
      foodName: row.food_name,
      meals: row.estimated_meals,
      category: row.category,
      dietary: row.dietary,
      preparedAt: this.formatDateTime(row.prepared_at ?? row.prepared_at_text),
      pickupBy: this.formatDateTime(row.pickup_by ?? row.pickup_by_text),
      outlet: row.outlet_name,
      address: row.address,
      area: row.area,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      status: this.displayStatus(row.status),
      partner: this.relationName(row.partner) || row.outlet_name,
      partnerOrganizationId: row.partner_organization_id,
      acceptedOrganizationId: row.accepted_by ?? undefined,
      acceptedAt: row.accepted_at ?? undefined,
      ngo: this.relationName(row.accepted_ngo) || undefined,
      notes: row.handling_notes ?? undefined,
      createdAt: row.created_at
    };
  }

  private relationName(value: RelationName): string {
    if (Array.isArray(value)) return String(value[0]?.name ?? '');
    return String(value?.name ?? '');
  }

  private displayStatus(value: string): DonationStatus {
    const values: Record<string, DonationStatus> = {
      available: 'Available', accepted: 'Accepted', picked_up: 'Picked Up', completed: 'Completed',
      expired: 'Expired', cancelled: 'Cancelled'
    };
    return values[value] ?? 'Available';
  }

  private subscribeToChanges(): void {
    const client = this.supabase.client;
    const session = this.auth.session();
    if (!client || !session || this.realtimeChannel) return;
    this.realtimeChannel = client
      .channel(`mealping-donations-${session.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => void this.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void this.loadNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => {
        // An organization sees its verification result without signing out and
        // back in again. Admins also keep their review queue up to date.
        void this.auth.refreshCurrentSession().catch(() => null);
        if (this.auth.session()?.role === 'admin') void this.loadOrganizations();
      })
      .subscribe();
  }

  private requireClient() {
    if (!this.supabase.client) throw this.fail('Connect your Supabase project before using this action.');
    return this.supabase.client;
  }

  private fail(message: string): Error { this.actionError.set(message); return new Error(message); }
  private message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
  private relativeTime(value: string): string {
    const difference = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.round(difference / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  private formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
}
