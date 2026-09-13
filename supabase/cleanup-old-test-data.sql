-- Remove the previous experimental Food Waste Matcher AI test data while retaining only the
-- three intentional hackathon review accounts created on 19 July 2026.
--
-- Kept accounts:
--   partner.demo@mealping.test
--   ngo.demo@mealping.test
--   admin.demo@mealping.test
--
-- This deletes only the old Auth users and their dependent sample activity.

begin;

-- Review records use a restrictive reviewer foreign key, so remove those first.
with target_users as (
  select id
  from auth.users
  where email in (
    'mejitu99@gmail.com',
    'mejitu99+2@gmail.com',
    'mejitu99+3@gmail.com',
    'mejitu99+9@gmail.com'
  )
)
delete from public.organization_review_logs log
using target_users target
where log.reviewer_id = target.id;

-- Clear activity tied to old test users. Donation notifications and related
-- responses cascade when their donation is removed.
with target_users as (
  select id
  from auth.users
  where email in (
    'mejitu99@gmail.com',
    'mejitu99+2@gmail.com',
    'mejitu99+3@gmail.com',
    'mejitu99+9@gmail.com'
  )
)
delete from public.donation_responses response
using target_users target
where response.responded_by = target.id;

with target_users as (
  select id
  from auth.users
  where email in (
    'mejitu99@gmail.com',
    'mejitu99+2@gmail.com',
    'mejitu99+3@gmail.com',
    'mejitu99+9@gmail.com'
  )
)
delete from public.donations donation
using target_users target
where donation.created_by = target.id;

-- The profile is deleted explicitly for clarity; Auth would also cascade it.
with target_users as (
  select id
  from auth.users
  where email in (
    'mejitu99@gmail.com',
    'mejitu99+2@gmail.com',
    'mejitu99+3@gmail.com',
    'mejitu99+9@gmail.com'
  )
)
delete from public.profiles profile
using target_users target
where profile.id = target.id;

with target_users as (
  select id
  from auth.users
  where email in (
    'mejitu99@gmail.com',
    'mejitu99+2@gmail.com',
    'mejitu99+3@gmail.com',
    'mejitu99+9@gmail.com'
  )
)
delete from auth.users account
using target_users target
where account.id = target.id;

-- Remove only leftover organizations that no longer belong to any profile.
-- The two active hackathon organizations have profiles and are not affected.
delete from public.organizations organization
where not exists (
  select 1 from public.profiles profile
  where profile.organization_id = organization.id
);

commit;

-- Expected remaining Auth accounts:
-- partner.demo@mealping.test, ngo.demo@mealping.test, admin.demo@mealping.test
