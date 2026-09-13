# Food Waste Matcher AI database setup

Food Waste Matcher AI now uses Supabase Auth and Postgres as the shared source of truth. The Angular app never receives the service-role key.

## 1. Create the database

1. Create a Supabase project.
2. Open **SQL Editor** in that project.
3. Run [`schema.sql`](./schema.sql) once in a new project, then run [`launch-readiness-migration.sql`](./launch-readiness-migration.sql), then [`organization-resubmission-migration.sql`](./organization-resubmission-migration.sql).

The schema creates organizations, user profiles, food posts, NGO responses, notifications, realtime updates, PostGIS location matching, and row-level security.

`schema.sql` is the location-aware schema for a fresh project. If you already ran the older prototype schema containing only a free-text `area` field, use a fresh Supabase project while there is no production data. Old records do not contain trustworthy pincodes or coordinates, so guessing their location would create unsafe matches.

## 2. Connect Angular

Copy the project URL and public anon key from **Project Settings → API**, then update both local and production files:

`src/environments/environment.ts` and `src/environments/environment.prod.ts`

```ts
export const environment = {
  production: false,
  demoMode: false,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY',
  mapDefault: { lat: 19.2183, lng: 72.9781 }
};
```

The anon key is intended for browser use. Never place the service-role key in Angular.

## 3. Create the admin account

1. Create a normal user in Supabase Auth.
2. Replace `YOUR_ADMIN_EMAIL` in [`bootstrap-admin.sql`](./bootstrap-admin.sql).
3. Run that file once in SQL Editor.
4. Log in through the Food Waste Matcher AI Admin tab.

## 4. Optional AI extraction

The database workflow works without AI because the food form supports manual entry. To enable AI extraction, deploy `functions/extract-donation` and configure these Edge Function secrets:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional)
- `ALLOWED_ORIGINS` (required in production; comma-separated origins such as `https://mealping.example`)

The AI function requires a real signed-in user, accepts only approved browser origins, limits request/image size, and consumes a database-backed quota of 20 requests per user per hour. The Gemini key remains server-side and is sent in a request header, not in the URL.

## 5. Production security settings

Before inviting real organizations:

1. In **Auth → Providers → Email**, keep email confirmation enabled and set the production Site URL and redirect allow-list.
2. In **Auth → Attack Protection**, enable CAPTCHA (Cloudflare Turnstile or hCaptcha) for sign-up/sign-in and review the built-in Auth rate limits.
3. Set the minimum password length to 6 in the Supabase password policy. Food Waste Matcher AI also requires an uppercase letter, number, and special character during registration. Require MFA for every admin account before a real pilot.
4. Deploy only over HTTPS. This repository includes `public/_headers` for hosts that support a headers file and `public/.htaccess` for Apache hosting. Confirm the live response actually contains CSP, HSTS, frame protection, MIME sniffing protection, referrer policy and permissions policy headers.
   After the Supabase project is chosen, replace the CSP wildcard `https://*.supabase.co` / `wss://*.supabase.co` in `src/index.html`, `public/_headers`, and `public/.htaccess` with that exact project host.
5. Keep `private` out of the Supabase exposed-schema list. Never grant browser roles access to the service-role key, `private.ai_usage_events`, or internal helper functions.
6. Enable database backups, review Auth/database/function logs, define retention, and test account suspension plus incident response before storing real contact/location data.
7. Restrict the Gemini key to the Generative Language API and set a provider-side daily budget/quota as a second cost-control layer.

## Working role flow

- New Food Partner and NGO accounts start as `pending`; an admin verifies them from the Organizations page.
- Food Partner: creates a time-bound food post with an actual pickup address, pincode, and optional GPS pin.
- NGO: sees only posts inside its pickup radius that also fit its availability, meal capacity, and dietary preference.
- If either side has no GPS pin, matching safely falls back to an exact 6-digit pincode. Free-text area names are display-only.
- Accepted participants: receive the other organization’s contact through a protected database function.
- NGO: marks food as collected.
- Food Partner: confirms the handoff as completed.
- Expired pickup deadlines are closed automatically whenever the app refreshes. Before a real pilot, also open **Integrations → Cron** (or **Cron → Jobs**), create a job with schedule `*/5 * * * *`, and choose the database function `refresh_expired_donations`. This keeps expiry reliable when no browser is open. The `functions/expire-donations` folder is only an optional external-scheduler alternative.
- Admin: sees all organizations, verifies or suspends them, and sees every donation status.

## Launch-readiness additions

- Every verification/suspension is recorded with the admin decision, timestamp, three completed checks (location, phone, supporting evidence), and an optional internal note.
- Only the recorded review function can change organization status; the old direct status helper is revoked by the migration.
- An organization that is verified while logged in refreshes automatically and immediately sees its usable workspace.
- Notifications open the related food post and are marked as read.

## Matching rule

The database uses PostGIS `ST_DWithin` with the NGO's configured service radius. This is straight-line geographic distance, not a promise about driving time. The query is spatially indexed and enforced in row-level security, so a Pune NGO cannot request a Mumbai donation merely by changing the Angular client.

No AI is used to decide eligibility. AI can structure the donor's message, but deterministic database rules control visibility and acceptance.
