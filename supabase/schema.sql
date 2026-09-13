-- Food waste matcher ai shared-database schema for a new Supabase project.
-- Run this file once in the Supabase SQL editor.

create schema if not exists extensions;
create schema if not exists private;
revoke create on schema public from public, anon, authenticated;
revoke all on schema private from public;
create extension if not exists pgcrypto;
create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('partner', 'ngo', 'admin');
create type public.organization_status as enum ('pending', 'verified', 'suspended');
create type public.donation_status as enum ('available', 'accepted', 'picked_up', 'completed', 'expired', 'cancelled');
create type public.donation_response as enum ('accepted', 'declined');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  role public.app_role not null check (role in ('partner', 'ngo')),
  area text not null check (char_length(area) between 1 and 100),
  address text not null check (char_length(address) between 3 and 500),
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  pincode text not null check (pincode ~ '^[1-9][0-9]{4}$'),
  latitude double precision,
  longitude double precision,
  location extensions.geography(Point, 4326),
  service_radius_km numeric(5, 2) not null default 10 check (service_radius_km between 1 and 100),
  max_meals_per_pickup integer not null default 100 check (max_meals_per_pickup between 1 and 10000),
  accepts_non_vegetarian boolean not null default false,
  accepting_donations boolean not null default true,
  status public.organization_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_coordinates_paired check ((latitude is null) = (longitude is null)),
  constraint organization_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint organization_longitude_range check (longitude is null or longitude between -180 and 180)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  role public.app_role not null,
  phone text not null check (char_length(phone) between 7 and 30),
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  partner_organization_id uuid not null constraint donations_partner_organization_id_fkey references public.organizations(id),
  created_by uuid not null references auth.users(id),
  accepted_by uuid constraint donations_accepted_by_fkey references public.organizations(id),
  status public.donation_status not null default 'available',
  food_name text not null check (char_length(food_name) between 2 and 200),
  estimated_meals integer not null check (estimated_meals between 1 and 100000),
  category text not null check (char_length(category) between 2 and 80),
  dietary text not null check (dietary in ('Vegetarian', 'Non-vegetarian', 'Mixed')),
  prepared_at timestamptz not null,
  pickup_by timestamptz not null,
  prepared_at_text text,
  pickup_by_text text,
  outlet_name text not null check (char_length(outlet_name) between 2 and 160),
  address text not null check (char_length(address) between 3 and 500),
  area text not null check (char_length(area) between 1 and 100),
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  pincode text not null check (pincode ~ '^[1-9][0-9]{4}$'),
  pickup_latitude double precision,
  pickup_longitude double precision,
  pickup_location extensions.geography(Point, 4326),
  handling_notes text check (handling_notes is null or char_length(handling_notes) <= 2000),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_coordinates_paired check ((pickup_latitude is null) = (pickup_longitude is null)),
  constraint donation_latitude_range check (pickup_latitude is null or pickup_latitude between -90 and 90),
  constraint donation_longitude_range check (pickup_longitude is null or pickup_longitude between -180 and 180),
  constraint donation_pickup_after_preparation check (pickup_by > prepared_at)
);

create table public.donation_responses (
  donation_id uuid not null references public.donations(id) on delete cascade,
  ngo_organization_id uuid not null references public.organizations(id) on delete cascade,
  response public.donation_response not null,
  responded_by uuid not null references auth.users(id),
  responded_at timestamptz not null default now(),
  primary key (donation_id, ngo_organization_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 1000),
  tone text not null default 'info' check (tone in ('info', 'success', 'warning')),
  donation_id uuid references public.donations(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Internal-only accounting for AI usage. It is intentionally outside the API schema.
create table private.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index organizations_location_gix on public.organizations using gist(location);
create index organizations_pincode_status_idx on public.organizations(pincode, status, accepting_donations);
create index donations_location_gix on public.donations using gist(pickup_location);
create index donations_pincode_status_idx on public.donations(pincode, status, created_at desc);
create index donations_pickup_deadline_idx on public.donations(status, pickup_by);
create index donations_partner_idx on public.donations(partner_organization_id, created_at desc);
create index donations_ngo_idx on public.donations(accepted_by, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index ai_usage_events_user_created_idx on private.ai_usage_events(user_id, created_at desc);

create or replace function public.sync_organization_location() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.area := trim(new.area);
  new.city := trim(new.city);
  new.state := trim(new.state);
  new.pincode := trim(new.pincode);
  new.location := case
    when new.latitude is not null and new.longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(new.longitude, new.latitude), 4326)::extensions.geography
    else null
  end;
  new.updated_at := now();
  return new;
end;
$$;

create trigger sync_organization_location_before_write
  before insert or update of latitude, longitude, area, city, state, pincode on public.organizations
  for each row execute procedure public.sync_organization_location();

create or replace function public.sync_donation_location() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.area := trim(new.area);
  new.city := trim(new.city);
  new.state := trim(new.state);
  new.pincode := trim(new.pincode);
  new.pickup_location := case
    when new.pickup_latitude is not null and new.pickup_longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(new.pickup_longitude, new.pickup_latitude), 4326)::extensions.geography
    else null
  end;
  new.updated_at := now();
  return new;
end;
$$;

create trigger sync_donation_location_before_write
  before insert or update of pickup_latitude, pickup_longitude, area, city, state, pincode on public.donations
  for each row execute procedure public.sync_donation_location();

create or replace function private.json_number(p_data jsonb, p_key text) returns double precision
language plpgsql immutable set search_path = public as $$
declare v_value text;
begin
  v_value := nullif(p_data ->> p_key, '');
  if v_value is null then return null; end if;
  return v_value::double precision;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role public.app_role;
  new_organization_id uuid;
  v_latitude double precision := private.json_number(new.raw_user_meta_data, 'latitude');
  v_longitude double precision := private.json_number(new.raw_user_meta_data, 'longitude');
  v_pincode text := trim(new.raw_user_meta_data ->> 'pincode');
begin
  safe_role := case when requested_role = 'ngo' then 'ngo'::public.app_role else 'partner'::public.app_role end;
  if (v_latitude is null) <> (v_longitude is null) then v_latitude := null; v_longitude := null; end if;
  if v_pincode is null or v_pincode !~ '^[1-9][0-9]{4}$' then raise exception 'A valid 5-digit postal code is required'; end if;
  if nullif(trim(new.raw_user_meta_data ->> 'organization'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'address'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'city'), '') is null
    or nullif(trim(new.raw_user_meta_data ->> 'state'), '') is null
  then raise exception 'Complete organization and location details are required'; end if;

  insert into public.organizations (
    name, role, area, address, city, state, pincode, latitude, longitude,
    service_radius_km, max_meals_per_pickup, accepts_non_vegetarian, accepting_donations
  ) values (
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization'), ''), 'New organization'),
    safe_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'area'), ''), 'Unspecified'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'address'), ''), 'Address pending'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 'Unspecified'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'state'), ''), 'Unspecified'),
    v_pincode,
    v_latitude,
    v_longitude,
    least(100, greatest(1, coalesce(private.json_number(new.raw_user_meta_data, 'service_radius_km'), 10))),
    least(10000, greatest(1, coalesce(private.json_number(new.raw_user_meta_data, 'max_meals_per_pickup'), 100)))::integer,
    safe_role = 'ngo' and coalesce((new.raw_user_meta_data ->> 'accepts_non_vegetarian')::boolean, false),
    safe_role = 'ngo'
  ) returning id into new_organization_id;

  insert into public.profiles (id, organization_id, full_name, role, phone)
  values (
    new.id,
    new_organization_id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Food Waste Matcher AI member'),
    safe_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 'Not provided')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create or replace function private.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function private.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.current_org_is_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.status = 'verified'
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = auth.uid()
  ), false)
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.current_org_declined(p_donation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.donation_responses
    where donation_id = p_donation_id
      and ngo_organization_id = private.current_org_id()
      and response = 'declined'
  )
$$;

create or replace function private.is_donation_eligible_for_ngo(p_donation_id uuid, p_ngo_organization_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
    from public.donations d
    join public.organizations o on o.id = p_ngo_organization_id
    join public.organizations donor on donor.id = d.partner_organization_id
    where d.id = p_donation_id
      and o.role = 'ngo'
      and o.status = 'verified'
      and donor.status = 'verified'
      and o.accepting_donations
      and d.status = 'available'
      and d.pickup_by > now()
      and d.estimated_meals <= o.max_meals_per_pickup
      and (d.dietary = 'Vegetarian' or o.accepts_non_vegetarian)
      and (
        (
          d.pickup_location is not null and o.location is not null
          and extensions.st_dwithin(d.pickup_location, o.location, o.service_radius_km * 1000)
        )
        or (
          (d.pickup_location is null or o.location is null)
          and d.pincode = o.pincode
        )
      )
  )
$$;

create or replace function private.current_ngo_can_access_donation(p_donation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_donation_eligible_for_ngo(p_donation_id, private.current_org_id())
$$;

create or replace function private.can_view_organization(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin()
    or p_organization_id = private.current_org_id()
    or exists (
      select 1 from public.donations d
      where (
        private.current_app_role() = 'partner'
        and d.partner_organization_id = private.current_org_id()
        and d.accepted_by = p_organization_id
      ) or (
        private.current_app_role() = 'ngo'
        and d.partner_organization_id = p_organization_id
        and (
          d.accepted_by = private.current_org_id()
          or (
            private.is_donation_eligible_for_ngo(d.id, private.current_org_id())
            and not private.current_org_declined(d.id)
          )
        )
      )
    )
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.donation_responses enable row level security;
alter table public.notifications enable row level security;
alter table private.ai_usage_events enable row level security;

create policy "participants read relevant organizations"
  on public.organizations for select to authenticated using (private.can_view_organization(id));
create policy "users read own profile or admins read all"
  on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin());
create policy "role and location aware donation visibility"
  on public.donations for select to authenticated using (
    private.is_admin()
    or partner_organization_id = private.current_org_id()
    or (
      private.current_app_role() = 'ngo'
      and (
        accepted_by = private.current_org_id()
        or (
          private.current_ngo_can_access_donation(donations.id)
          and not private.current_org_declined(donations.id)
        )
      )
    )
  );
create policy "ngos read their own responses"
  on public.donation_responses for select to authenticated using (
    private.is_admin() or ngo_organization_id = private.current_org_id()
  );
create policy "users read own notifications"
  on public.notifications for select to authenticated using (user_id = auth.uid() or private.is_admin());

create or replace function public.create_donation(
  p_food_name text,
  p_estimated_meals integer,
  p_category text,
  p_dietary text,
  p_prepared_at timestamptz,
  p_pickup_by timestamptz,
  p_outlet_name text,
  p_address text,
  p_city text,
  p_state text,
  p_pincode text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_handling_notes text default null
) returns public.donations
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_organization public.organizations;
  v_donation public.donations;
  v_recent_posts integer;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'partner' then raise exception 'Only food partners can post food'; end if;
  select * into v_organization from public.organizations where id = v_profile.organization_id;
  if v_organization.status <> 'verified' then raise exception 'Your organization must be verified before posting food'; end if;
  if p_estimated_meals is null or p_estimated_meals not between 1 and 100000 then raise exception 'Meal quantity must be between 1 and 100000'; end if;
  if nullif(trim(p_food_name), '') is null or char_length(trim(p_food_name)) > 200
    or nullif(trim(p_category), '') is null or char_length(trim(p_category)) > 80
    or nullif(trim(p_outlet_name), '') is null or char_length(trim(p_outlet_name)) > 160
    or nullif(trim(p_address), '') is null or char_length(trim(p_address)) > 500
    or nullif(trim(p_city), '') is null or char_length(trim(p_city)) > 100
    or nullif(trim(p_state), '') is null or char_length(trim(p_state)) > 100
    or char_length(coalesce(p_handling_notes, '')) > 2000
  then raise exception 'Food or pickup details are missing or too long'; end if;
  if trim(p_pincode) !~ '^[1-9][0-9]{4}$' then raise exception 'Enter a valid 5-digit postal code'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Pickup coordinates must include both latitude and longitude'; end if;
  if p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then raise exception 'Pickup coordinates are invalid'; end if;
  if p_pickup_by <= p_prepared_at or p_pickup_by <= now() or p_pickup_by > now() + interval '30 days'
    then raise exception 'Pickup deadline must be after preparation, in the future, and within 30 days'; end if;
  if p_dietary is null or p_dietary not in ('Vegetarian', 'Non-vegetarian', 'Mixed') then raise exception 'Invalid dietary type'; end if;

  -- Serialize posting for this organization so concurrent requests cannot bypass the quota.
  perform pg_advisory_xact_lock(hashtextextended(v_profile.organization_id::text, 0));
  select count(*) into v_recent_posts
  from public.donations
  where partner_organization_id = v_profile.organization_id
    and created_at >= now() - interval '1 hour';
  if v_recent_posts >= 30 then raise exception 'Posting limit reached. Please try again later'; end if;

  insert into public.donations (
    public_id, partner_organization_id, created_by, food_name, estimated_meals,
    category, dietary, prepared_at, pickup_by, prepared_at_text, pickup_by_text,
    outlet_name, address, area, city, state, pincode, pickup_latitude, pickup_longitude, handling_notes
  ) values (
    'MP-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    v_profile.organization_id, auth.uid(), trim(p_food_name), p_estimated_meals,
    trim(p_category), p_dietary, p_prepared_at, p_pickup_by,
    to_char(p_prepared_at at time zone 'Asia/Karachi', 'DD Mon, HH12:MI AM'),
    to_char(p_pickup_by at time zone 'Asia/Karachi', 'DD Mon, HH12:MI AM'),
    trim(p_outlet_name), trim(p_address),
    case when trim(p_pincode) = v_organization.pincode then v_organization.area else trim(p_city) end,
    trim(p_city), trim(p_state), trim(p_pincode),
    p_latitude, p_longitude, nullif(trim(p_handling_notes), '')
  ) returning * into v_donation;

  insert into public.notifications (user_id, title, body, tone, donation_id)
  select p.id, 'New food available near you',
    p_estimated_meals || ' ' || lower(p_dietary) || ' meals from ' || trim(p_outlet_name) || ' in ' || trim(p_city),
    'info', v_donation.id
  from public.profiles p
  where p.role = 'ngo'
    and private.is_donation_eligible_for_ngo(v_donation.id, p.organization_id);

  return v_donation;
end;
$$;

create or replace function public.accept_donation(p_public_id text) returns public.donations
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_donation public.donations;
  v_ngo_name text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'ngo' then raise exception 'Only NGOs can accept food'; end if;

  select * into v_donation from public.donations where public_id = p_public_id for update;
  if v_donation.id is null then raise exception 'Food post not found'; end if;
  if v_donation.status <> 'available' then raise exception 'This food is no longer available'; end if;
  if v_donation.pickup_by <= now() then
    raise exception 'The pickup deadline has passed';
  end if;
  if not private.is_donation_eligible_for_ngo(v_donation.id, v_profile.organization_id) then raise exception 'This pickup no longer fits your organization settings'; end if;

  update public.donations set status = 'accepted', accepted_by = v_profile.organization_id,
    accepted_at = now(), updated_at = now()
  where id = v_donation.id returning * into v_donation;

  insert into public.donation_responses (donation_id, ngo_organization_id, response, responded_by)
  values (v_donation.id, v_profile.organization_id, 'accepted', auth.uid())
  on conflict (donation_id, ngo_organization_id) do update
    set response = 'accepted', responded_by = auth.uid(), responded_at = now();

  select name into v_ngo_name from public.organizations where id = v_profile.organization_id;
  insert into public.notifications (user_id, title, body, tone, donation_id)
  values (v_donation.created_by, v_ngo_name || ' accepted your food', 'Contact details are now available to coordinate pickup.', 'success', v_donation.id);
  return v_donation;
end;
$$;

create or replace function public.reject_donation(p_public_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_donation public.donations;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'ngo' then raise exception 'Only NGOs can decline food'; end if;
  select * into v_donation from public.donations where public_id = p_public_id;
  if v_donation.id is null or v_donation.status <> 'available' then raise exception 'This food is no longer available'; end if;
  if not private.is_donation_eligible_for_ngo(v_donation.id, v_profile.organization_id) then raise exception 'This food is not an eligible opportunity for your NGO'; end if;

  insert into public.donation_responses (donation_id, ngo_organization_id, response, responded_by)
  values (v_donation.id, v_profile.organization_id, 'declined', auth.uid())
  on conflict (donation_id, ngo_organization_id) do update
    set response = 'declined', responded_by = auth.uid(), responded_at = now();
end;
$$;

create or replace function public.mark_donation_picked_up(p_public_id text) returns public.donations
language plpgsql security definer set search_path = public as $$
declare v_donation public.donations;
begin
  if not private.current_org_is_verified() then raise exception 'Your organization is not verified'; end if;
  update public.donations set status = 'picked_up', picked_up_at = now(), updated_at = now()
  where public_id = p_public_id and status = 'accepted' and accepted_by = private.current_org_id()
  returning * into v_donation;
  if v_donation.id is null then raise exception 'Only the accepting NGO can mark this pickup'; end if;
  insert into public.notifications (user_id, title, body, tone, donation_id)
  values (v_donation.created_by, 'Food collected', 'Please confirm the handoff to complete this donation.', 'success', v_donation.id);
  return v_donation;
end;
$$;

create or replace function public.complete_donation(p_public_id text) returns public.donations
language plpgsql security definer set search_path = public as $$
declare v_donation public.donations;
begin
  if not private.current_org_is_verified() then raise exception 'Your organization is not verified'; end if;
  update public.donations set status = 'completed', completed_at = now(), updated_at = now()
  where public_id = p_public_id and status = 'picked_up' and partner_organization_id = private.current_org_id()
  returning * into v_donation;
  if v_donation.id is null then raise exception 'Only the food partner can complete this handoff'; end if;
  insert into public.notifications (user_id, title, body, tone, donation_id)
  select p.id, 'Pickup completed', v_donation.estimated_meals || ' meals were added to your impact.', 'success', v_donation.id
  from public.profiles p where p.organization_id = v_donation.accepted_by;
  return v_donation;
end;
$$;

create or replace function public.cancel_donation(p_public_id text) returns public.donations
language plpgsql security definer set search_path = public as $$
declare v_donation public.donations;
begin
  update public.donations set status = 'cancelled', updated_at = now()
  where public_id = p_public_id and status in ('available', 'accepted') and partner_organization_id = private.current_org_id()
  returning * into v_donation;
  if v_donation.id is null then raise exception 'This donation cannot be cancelled'; end if;
  if v_donation.accepted_by is not null then
    insert into public.notifications (user_id, title, body, tone, donation_id)
    select p.id, 'Pickup cancelled by food partner', v_donation.outlet_name || ' cancelled this pickup. Please do not travel to the outlet.', 'warning', v_donation.id
    from public.profiles p where p.organization_id = v_donation.accepted_by;
  end if;
  return v_donation;
end;
$$;

create or replace function public.get_donation_contact(p_public_id text)
returns table (full_name text, organization_name text, phone text, email text, role public.app_role)
language plpgsql security definer set search_path = public, auth as $$
declare
  v_donation public.donations;
  v_other_org uuid;
begin
  select * into v_donation from public.donations where public_id = p_public_id;
  if v_donation.id is null or v_donation.accepted_by is null then return; end if;
  if not private.current_org_is_verified() then raise exception 'Your organization is not verified'; end if;
  if private.current_org_id() = v_donation.partner_organization_id then v_other_org := v_donation.accepted_by;
  elsif private.current_org_id() = v_donation.accepted_by then v_other_org := v_donation.partner_organization_id;
  else raise exception 'Contact details are available only to participants';
  end if;

  return query
  select p.full_name, o.name, p.phone, u.email::text, p.role
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  join auth.users u on u.id = p.id
  where p.organization_id = v_other_org
  order by p.created_at
  limit 1;
end;
$$;

create or replace function public.get_my_session_profile()
returns table (
  user_id uuid,
  organization_id uuid,
  full_name text,
  app_role public.app_role,
  phone text,
  organization_name text,
  area text,
  address text,
  city text,
  state text,
  pincode text,
  latitude double precision,
  longitude double precision,
  organization_status public.organization_status,
  accepting_donations boolean,
  service_radius_km numeric,
  max_meals_per_pickup integer,
  accepts_non_vegetarian boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.organization_id, p.full_name, p.role, p.phone,
    o.name, o.area, o.address, o.city, o.state, o.pincode, o.latitude, o.longitude,
    o.status, o.accepting_donations, o.service_radius_km, o.max_meals_per_pickup,
    o.accepts_non_vegetarian
  from public.profiles p
  left join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid()
$$;

-- Deliberately use a security-definer function instead of granting the address
-- column directly: organization addresses are visible only in the admin directory.
create or replace function public.get_admin_organizations()
returns table (
  id uuid,
  name text,
  role public.app_role,
  area text,
  address text,
  city text,
  state text,
  pincode text,
  status public.organization_status,
  accepting_donations boolean,
  service_radius_km numeric,
  max_meals_per_pickup integer,
  accepts_non_vegetarian boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.role, o.area, o.address, o.city, o.state, o.pincode,
    o.status, o.accepting_donations, o.service_radius_km, o.max_meals_per_pickup,
    o.accepts_non_vegetarian, o.created_at
  from public.organizations o
  where private.is_admin()
  order by o.created_at desc
$$;

create or replace function public.get_my_donation_distances()
returns table (donation_id uuid, distance_km numeric, match_basis text)
language sql stable security definer set search_path = public, extensions as $$
  select d.id,
    case when d.pickup_location is not null and o.location is not null
      then round((extensions.st_distance(d.pickup_location, o.location) / 1000)::numeric, 1)
      else null
    end as distance_km,
    case when d.pickup_location is not null and o.location is not null then 'distance' else 'pincode' end as match_basis
  from public.donations d
  join public.organizations o on o.id = private.current_org_id() and o.role = 'ngo'
  where d.accepted_by = o.id
    or (
      private.is_donation_eligible_for_ngo(d.id, o.id)
      and not private.current_org_declined(d.id)
    )
$$;

create or replace function public.set_ngo_availability(p_accepting boolean) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare v_organization public.organizations;
begin
  if private.current_app_role() <> 'ngo' then raise exception 'Only NGOs can change pickup availability'; end if;
  if not private.current_org_is_verified() then raise exception 'Your organization is not verified'; end if;
  update public.organizations set accepting_donations = p_accepting, updated_at = now()
  where id = private.current_org_id() and role = 'ngo'
  returning * into v_organization;
  if v_organization.id is null then raise exception 'NGO organization not found'; end if;
  return v_organization;
end;
$$;

create or replace function public.set_organization_status(p_organization_id uuid, p_status public.organization_status) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare v_organization public.organizations;
begin
  if not private.is_admin() then raise exception 'Only admins can verify or suspend organizations'; end if;
  update public.organizations set status = p_status, updated_at = now()
  where id = p_organization_id
  returning * into v_organization;
  if v_organization.id is null then raise exception 'Organization not found'; end if;
  return v_organization;
end;
$$;

create or replace function public.refresh_expired_donations() returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.donations set status = 'expired', updated_at = now()
  where status = 'available' and pickup_by <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.consume_ai_quota() returns boolean
language plpgsql security definer set search_path = public, private as $$
declare
  v_user_id uuid := auth.uid();
  v_usage integer;
begin
  if v_user_id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  delete from private.ai_usage_events
  where user_id = v_user_id and created_at < now() - interval '7 days';
  select count(*) into v_usage
  from private.ai_usage_events
  where user_id = v_user_id and created_at >= now() - interval '1 hour';
  if v_usage >= 20 then return false; end if;
  insert into private.ai_usage_events (user_id) values (v_user_id);
  return true;
end;
$$;

-- Default Supabase grants are deliberately narrowed. RLS remains the second line of defence.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant select (id, name, role, area, city, state, pincode, service_radius_km,
  max_meals_per_pickup, accepts_non_vegetarian, accepting_donations, status, created_at)
  on table public.organizations to authenticated;
grant select on table public.profiles, public.donations,
  public.donation_responses, public.notifications to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_org_declined(uuid) to authenticated;
grant execute on function private.current_ngo_can_access_donation(uuid) to authenticated;
grant execute on function private.can_view_organization(uuid) to authenticated;

grant execute on function public.create_donation(text, integer, text, text, timestamptz, timestamptz, text, text, text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.accept_donation(text) to authenticated;
grant execute on function public.reject_donation(text) to authenticated;
grant execute on function public.mark_donation_picked_up(text) to authenticated;
grant execute on function public.complete_donation(text) to authenticated;
grant execute on function public.cancel_donation(text) to authenticated;
grant execute on function public.get_donation_contact(text) to authenticated;
grant execute on function public.get_my_session_profile() to authenticated;
grant execute on function public.get_admin_organizations() to authenticated;
grant execute on function public.get_my_donation_distances() to authenticated;
grant execute on function public.set_ngo_availability(boolean) to authenticated;
grant execute on function public.set_organization_status(uuid, public.organization_status) to authenticated;
grant execute on function public.refresh_expired_donations() to authenticated;
grant execute on function public.consume_ai_quota() to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations'
  ) then
    alter publication supabase_realtime add table public.donations;
  end if;
end $$;
