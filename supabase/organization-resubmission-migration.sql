-- Food waste matcher ai organization profile editing and resubmission.
-- Run this AFTER launch-readiness-migration.sql.

create or replace function public.update_my_organization(
  p_name text,
  p_full_name text,
  p_phone text,
  p_area text,
  p_address text,
  p_city text,
  p_state text,
  p_pincode text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_service_radius_km numeric default null,
  p_max_meals_per_pickup integer default null,
  p_accepts_non_vegetarian boolean default null,
  p_resubmission_note text default ''
) returns public.organizations
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v_organization public.organizations;
  v_updated public.organizations;
  v_note text := trim(coalesce(p_resubmission_note, ''));
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role not in ('partner', 'ngo') or v_profile.organization_id is null then
    raise exception 'Only an organization account can update these details';
  end if;
  select * into v_organization from public.organizations where id = v_profile.organization_id for update;
  if v_organization.id is null then raise exception 'Organization not found'; end if;

  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) not between 2 and 160
    or nullif(trim(p_full_name), '') is null or char_length(trim(p_full_name)) not between 2 and 120
    or nullif(trim(p_phone), '') is null or char_length(trim(p_phone)) not between 7 and 30
    or nullif(trim(p_area), '') is null or char_length(trim(p_area)) > 100
    or nullif(trim(p_address), '') is null or char_length(trim(p_address)) not between 3 and 500
    or nullif(trim(p_city), '') is null or char_length(trim(p_city)) > 100
    or nullif(trim(p_state), '') is null or char_length(trim(p_state)) > 100
  then raise exception 'Enter valid organization, contact, and address details'; end if;
  if trim(p_pincode) !~ '^[1-9][0-9]{5}$' then raise exception 'Enter a valid 6-digit Indian pincode'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Location coordinates must include both latitude and longitude'; end if;
  if p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then
    raise exception 'Location coordinates are invalid';
  end if;
  if v_profile.role = 'ngo' then
    if p_service_radius_km is null or p_service_radius_km not between 1 and 100 then raise exception 'Pickup radius must be between 1 and 100 km'; end if;
    if p_max_meals_per_pickup is null or p_max_meals_per_pickup not between 1 and 10000 then raise exception 'Maximum pickup must be between 1 and 10000 meals'; end if;
  end if;
  if char_length(v_note) > 1000 then raise exception 'Resubmission note is too long'; end if;
  if v_organization.status = 'suspended' and char_length(v_note) < 10 then
    raise exception 'Explain what you corrected in at least 10 characters before requesting another review';
  end if;

  update public.profiles
  set full_name = trim(p_full_name), phone = trim(p_phone)
  where id = auth.uid();

  update public.organizations set
    name = trim(p_name), area = trim(p_area), address = trim(p_address), city = trim(p_city),
    state = trim(p_state), pincode = trim(p_pincode), latitude = p_latitude, longitude = p_longitude,
    service_radius_km = case when v_profile.role = 'ngo' then p_service_radius_km else service_radius_km end,
    max_meals_per_pickup = case when v_profile.role = 'ngo' then p_max_meals_per_pickup else max_meals_per_pickup end,
    accepts_non_vegetarian = case when v_profile.role = 'ngo' then coalesce(p_accepts_non_vegetarian, false) else accepts_non_vegetarian end,
    status = case when status = 'suspended' then 'pending'::public.organization_status else status end,
    updated_at = now()
  where id = v_organization.id
  returning * into v_updated;

  if v_organization.status = 'suspended' then
    insert into public.organization_review_logs (
      organization_id, reviewer_id, previous_status, new_status,
      location_confirmed, phone_confirmed, evidence_confirmed, note
    ) values (
      v_organization.id, auth.uid(), 'suspended', 'pending', false, false, false,
      'Organization resubmission: ' || v_note
    );

    insert into public.notifications (user_id, title, body, tone)
    select p.id, 'Organization resubmitted for review',
      v_updated.name || ' updated its details and requested another verification review.', 'info'
    from public.profiles p where p.role = 'admin';

    insert into public.notifications (user_id, title, body, tone)
    values (auth.uid(), 'Details sent for review', 'Your corrected organization details were submitted. An admin will review them before restoring workspace access.', 'info');
  else
    insert into public.notifications (user_id, title, body, tone)
    values (auth.uid(), 'Organization details updated', 'Your account details were updated successfully.', 'success');
  end if;

  return v_updated;
end;
$$;

grant execute on function public.update_my_organization(text, text, text, text, text, text, text, text, double precision, double precision, numeric, integer, boolean, text) to authenticated;
