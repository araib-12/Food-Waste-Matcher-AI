-- Food waste matcher ai launch-readiness migration.
-- Run this once in the Supabase SQL Editor AFTER schema.sql.
-- It is safe for the current pilot schema and adds review accountability,
-- notification acknowledgement, and missed-pickup handling.

create table if not exists public.organization_review_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  previous_status public.organization_status not null,
  new_status public.organization_status not null,
  location_confirmed boolean not null default false,
  phone_confirmed boolean not null default false,
  evidence_confirmed boolean not null default false,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists organization_review_logs_organization_idx
  on public.organization_review_logs(organization_id, created_at desc);

alter table public.organization_review_logs enable row level security;
drop policy if exists "admins read organization review logs" on public.organization_review_logs;
create policy "admins read organization review logs"
  on public.organization_review_logs for select to authenticated
  using (private.is_admin());

create or replace function public.review_organization(
  p_organization_id uuid,
  p_status public.organization_status,
  p_location_confirmed boolean,
  p_phone_confirmed boolean,
  p_evidence_confirmed boolean,
  p_note text default ''
) returns public.organizations
language plpgsql security definer set search_path = public as $$
declare
  v_organization public.organizations;
  v_previous_status public.organization_status;
  v_note text := trim(coalesce(p_note, ''));
  v_notification_title text;
  v_notification_body text;
  v_notification_tone text;
  v_recipient record;
begin
  if not private.is_admin() then raise exception 'Only admins can review organizations'; end if;
  if p_status not in ('verified', 'suspended') then raise exception 'Choose a valid review decision'; end if;
  if char_length(v_note) > 2000 then raise exception 'Review note is too long'; end if;
  if p_status = 'verified' and not (p_location_confirmed and p_phone_confirmed and p_evidence_confirmed) then
    raise exception 'Complete the location, phone, and evidence checks before verifying this organization';
  end if;
  if p_status = 'suspended' and v_note = '' then
    raise exception 'Add a reason before suspending an organization';
  end if;
  if p_status = 'verified' then
    v_notification_title := 'Organization verified';
    v_notification_body := 'Your organization is verified. You can now use its workspace.';
    v_notification_tone := 'success';
  else
    v_notification_title := 'Organization review updated';
    v_notification_body := 'Review needs changes: ' || v_note;
    v_notification_tone := 'warning';
  end if;

  select * into v_organization from public.organizations where id = p_organization_id for update;
  if v_organization.id is null then raise exception 'Organization not found'; end if;
  v_previous_status := v_organization.status;

  update public.organizations set status = p_status, updated_at = now()
  where id = p_organization_id
  returning * into v_organization;

  insert into public.organization_review_logs (
    organization_id, reviewer_id, previous_status, new_status,
    location_confirmed, phone_confirmed, evidence_confirmed, note
  ) values (
    p_organization_id, auth.uid(), v_previous_status, p_status,
    p_location_confirmed, p_phone_confirmed, p_evidence_confirmed, v_note
  );

  for v_recipient in
    select id from public.profiles where organization_id = p_organization_id
  loop
    insert into public.notifications (user_id, title, body, tone)
    values (v_recipient.id, v_notification_title, v_notification_body, v_notification_tone);
  end loop;

  return v_organization;
end;
$$;

create or replace function public.get_organization_review_history(p_organization_id uuid)
returns table (
  id uuid,
  previous_status public.organization_status,
  new_status public.organization_status,
  location_confirmed boolean,
  phone_confirmed boolean,
  evidence_confirmed boolean,
  note text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, r.previous_status, r.new_status, r.location_confirmed,
    r.phone_confirmed, r.evidence_confirmed, r.note, r.created_at
  from public.organization_review_logs r
  where r.organization_id = p_organization_id and private.is_admin()
  order by r.created_at desc
$$;

create or replace function public.mark_notifications_read(p_notification_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_notification_ids is null or id = any(p_notification_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Close missed pickup windows even when food had already been accepted, and
-- notify both participants so no one travels after the deadline.
create or replace function public.refresh_expired_donations() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_donation public.donations;
begin
  for v_donation in
    update public.donations
      set status = 'expired', updated_at = now()
    where status in ('available', 'accepted') and pickup_by <= now()
    returning *
  loop
    v_count := v_count + 1;
    insert into public.notifications (user_id, title, body, tone, donation_id)
    values (
      v_donation.created_by,
      case when v_donation.accepted_by is null then 'Food post expired' else 'Pickup window missed' end,
      case when v_donation.accepted_by is null
        then v_donation.outlet_name || ' was not accepted before its pickup deadline.'
        else v_donation.outlet_name || ' was not confirmed before the pickup deadline. Please contact the NGO before taking further action.' end,
      'warning', v_donation.id
    );
    if v_donation.accepted_by is not null then
      insert into public.notifications (user_id, title, body, tone, donation_id)
      select p.id, 'Pickup window missed', v_donation.outlet_name || ' is now closed. Please do not travel without contacting the food partner.', 'warning', v_donation.id
      from public.profiles p where p.organization_id = v_donation.accepted_by;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on public.organization_review_logs from anon, authenticated;
-- The old helper had no audit requirements. Removing access ensures every
-- new review goes through review_organization and leaves a record.
revoke execute on function public.set_organization_status(uuid, public.organization_status) from authenticated;
grant execute on function public.review_organization(uuid, public.organization_status, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.get_organization_review_history(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.refresh_expired_donations() to authenticated;
