-- Run this once in Supabase SQL Editor for an existing Food Waste Matcher AI project.
-- It gives only authenticated admins access to the complete organization directory.

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

grant execute on function public.get_admin_organizations() to authenticated;
