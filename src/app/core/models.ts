export type AppRole = 'partner' | 'ngo' | 'admin';
export type DonationStatus = 'Draft' | 'AI Extracted' | 'Human Confirmed' | 'Available' | 'Accepted' | 'Picked Up' | 'Completed' | 'Expired' | 'Cancelled';

export interface Donation {
  dbId: string;
  id: string;
  foodName: string;
  meals: number;
  category: string;
  dietary: 'Vegetarian' | 'Non-vegetarian' | 'Mixed';
  preparedAt: string;
  pickupBy: string;
  outlet: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  distanceKm?: number;
  matchBasis?: 'distance' | 'pincode';
  status: DonationStatus;
  partner: string;
  partnerOrganizationId: string;
  acceptedOrganizationId?: string;
  acceptedAt?: string;
  ngo?: string;
  notes?: string;
  createdAt: string;
}

export interface DonationExtraction {
  foodName: string;
  meals: number;
  category: string;
  dietary: Donation['dietary'];
  preparedAt: string;
  pickupBy: string;
  outlet?: string;
  address?: string;
  notes: string;
  missing: string[];
  confidence: number;
}

/** A human-reviewable coordination draft. It never certifies food safety or chooses an NGO. */
export interface DonationHandoff {
  pickupSummary: string;
  checklist: string[];
  missing: string[];
  ngoMessage: string;
}

export interface DonationHandoffInput {
  foodName: string;
  meals: number;
  category: string;
  dietary: Donation['dietary'];
  outlet: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  preparedAt: string;
  pickupBy: string;
  notes: string;
}

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: 'info' | 'success' | 'warning';
  unread: boolean;
  donationId?: string;
}

export interface DonationContact {
  fullName: string;
  organizationName: string;
  phone: string;
  email: string;
  role: AppRole;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  role: Exclude<AppRole, 'admin'>;
  contactName: string;
  contactPhone: string;
  area: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  acceptingDonations: boolean;
  serviceRadiusKm: number;
  maxMealsPerPickup: number;
  acceptsNonVegetarian: boolean;
  status: 'pending' | 'verified' | 'suspended';
  createdAt: string;
}

export interface OrganizationReview {
  id: string;
  previousStatus: OrganizationSummary['status'];
  newStatus: OrganizationSummary['status'];
  locationConfirmed: boolean;
  phoneConfirmed: boolean;
  evidenceConfirmed: boolean;
  note: string;
  createdAt: string;
}
