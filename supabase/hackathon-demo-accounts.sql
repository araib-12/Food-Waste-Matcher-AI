-- Food Waste Matcher AI hackathon demo-account setup.
-- Run only after registering these three accounts through the Food Waste Matcher AI app:
--   partner.demo@foodwastematcherai.test
--   ngo.demo@foodwastematcherai.test
--   admin.demo@foodwastematcherai.test
--
-- This script promotes the dedicated test admin and verifies the two test
-- organizations. It is intentionally limited to the exact demo email addresses
-- and can be run again safely.

do $$
declare
  v_admin_id uuid;
  v_partner_org_id uuid;
  v_ngo_org_id uuid;
  v_partner_previous public.organization_status;
  v_ngo_previous public.organization_status;
begin
  select id into v_admin_id
  from auth.users
  where email = 'admin.demo@foodwastematcherai.test';

  select p.organization_id into v_partner_org_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'partner.demo@foodwastematcherai.test';

  select p.organization_id into v_ngo_org_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'ngo.demo@foodwastematcherai.test';

  if v_admin_id is null or v_partner_org_id is null or v_ngo_org_id is null then
    raise exception 'Create the three Food Waste Matcher AI demo accounts before running this script.';
  end if;

  -- The admin account is first registered through the normal app so it has a
  -- safe Auth password; it is then promoted and detached from its placeholder organization.
  update public.profiles
  set role = 'admin', organization_id = null
  where id = v_admin_id;

  delete from public.organizations o
  where o.name = 'Food Waste Matcher AI Demo Operations'
    and not exists (select 1 from public.profiles p where p.organization_id = o.id);

  select status into v_partner_previous from public.organizations where id = v_partner_org_id;
  update public.organizations set status = 'verified', updated_at = now() where id = v_partner_org_id;

  select status into v_ngo_previous from public.organizations where id = v_ngo_org_id;
  update public.organizations set status = 'verified', updated_at = now() where id = v_ngo_org_id;

  insert into public.organization_review_logs (
    organization_id, reviewer_id, previous_status, new_status,
    location_confirmed, phone_confirmed, evidence_confirmed, note
  )
  select v_partner_org_id, v_admin_id, v_partner_previous, 'verified', true, true, true,
    'Hackathon demo account verified for judge testing.'
  where not exists (
    select 1 from public.organization_review_logs
    where organization_id = v_partner_org_id
      and note = 'Hackathon demo account verified for judge testing.'
  );

  insert into public.organization_review_logs (
    organization_id, reviewer_id, previous_status, new_status,
    location_confirmed, phone_confirmed, evidence_confirmed, note
  )
  select v_ngo_org_id, v_admin_id, v_ngo_previous, 'verified', true, true, true,
    'Hackathon demo account verified for judge testing.'
  where not exists (
    select 1 from public.organization_review_logs
    where organization_id = v_ngo_org_id
      and note = 'Hackathon demo account verified for judge testing.'
  );

  insert into public.notifications (user_id, title, body, tone)
  select p.id, 'Organization verified', 'Your hackathon demo organization is ready to use.', 'success'
  from public.profiles p
  where p.organization_id in (v_partner_org_id, v_ngo_org_id)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = p.id
        and n.title = 'Organization verified'
        and n.body = 'Your hackathon demo organization is ready to use.'
    );
end;
$$;

-- Public test credentials for judges. These accounts contain only dummy data.
-- Food Partner: partner.demo@foodwastematcherai.test / Demo@FoodWaste26
-- NGO:          ngo.demo@foodwastematcherai.test / Demo@FoodWaste26
-- Admin:        admin.demo@foodwastematcherai.test / Demo@FoodWaste26
