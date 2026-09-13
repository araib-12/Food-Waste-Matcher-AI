-- Replace the email, create that user in Supabase Auth, then run this once.
-- The app reads the role from public.profiles, not editable browser metadata.

update public.profiles
set role = 'admin', organization_id = null
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');

delete from public.organizations o
where not exists (select 1 from public.profiles p where p.organization_id = o.id);
