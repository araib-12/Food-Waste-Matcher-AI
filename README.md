# Food Waste Matcher AI

**Ping surplus. Rescue meals.**

Food Waste Matcher AI is an AI-assisted food-rescue network for Food Partners, NGOs and network operators. A restaurant can type a surplus-food description; AI structures it; a person confirms it; AI can prepare a human-reviewable pickup handoff brief; deterministic rules rank eligible nearby NGOs; and both organizations track pickup and delivery.


## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200`. Useful demo routes:

- `/partner/dashboard` — Food Partner workspace
- `/partner/donations/new` — typed description → AI extraction → confirmation → publish
- `/ngo/dashboard` — ranked rescue opportunities
- `/ngo/opportunities/MP-24071` — acceptance flow
- `/ngo/rescues/MP-24071` — pickup OTP and delivery flow
- `/admin/dashboard` — live network operations

Every workspace route is login-protected. Use the role-specific login tabs with:

| Workspace | Email | Password |
| --- | --- | --- |
| Food Partner | `partner@mealping.demo` | `mealping123` |
| NGO | `ngo@mealping.demo` | `mealping123` |
| Admin | `admin@mealping.demo` | `mealping123` |

Each account can open only its own workspace. The registration form also creates a reusable local account in demo mode. When Supabase is configured and `demoMode` is disabled, login and registration use Supabase Auth instead.

## Hackathon judge accounts

The hosted Supabase demo includes three intentionally fake, ready-to-test accounts. They are for product review only — do not use them with real people, food, or personal information.

| Workspace | Email | Password | What a reviewer can check |
| --- | --- | --- | --- |
| Food Partner | `partner.demo@foodwastematcherai.test` | `Demo@FoodWaste26` | Verified restaurant workspace and surplus-food posting |
| NGO | `ngo.demo@foodwastematcherai.test` | `Demo@FoodWaste26` | Verified NGO workspace, opportunities and rescue workflow |
| Network Admin | `admin.demo@foodwastematcherai.test` | `Demo@FoodWaste26` | Organization review and network operations |

The partner and NGO profiles use fictional Thane data and are already verified so reviewers can reach the main product flows immediately. The seed steps are retained in [`supabase/hackathon-demo-accounts.sql`](supabase/hackathon-demo-accounts.sql) for a fresh Supabase project.

## What is implemented

- Premium responsive public site, authentication and registration screens
- Role-specific desktop sidebar and mobile bottom navigation
- Login guards, role authorization, persisted sessions and logout
- Partner dashboards, multi-step donation flow, details, history, outlets and profile
- NGO opportunities, transparent matching reasons, acceptance, pickup and delivery
- Admin network health, organizations, donations, matches, exceptions and rule settings
- PWA manifest/service-worker configuration
- Supabase schema with Row Level Security policies
- Secure Supabase Edge Function for Gemini extraction and NGO-ready handoff briefs
- Demo services that make the full product story usable before backend setup

## Connect Supabase and Gemini

1. In the Supabase SQL editor, run `supabase/schema.sql`, then run `supabase/launch-readiness-migration.sql`, then run `supabase/organization-resubmission-migration.sql`.
   These add recorded admin reviews, read-state for notifications, missed-pickup handling, organization profile editing, and suspended-account resubmission.
2. The included environment files already point to the Food Waste Matcher AI Supabase project. For a different project, change only the URL and **anon key** in both `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
   Production builds automatically use `environment.prod.ts`.
3. Keep the Gemini key server-side and deploy the AI function:

   ```bash
   supabase secrets set GEMINI_API_KEY=your_gemini_key GEMINI_MODEL=gemini-3.5-flash
   supabase functions deploy extract-donation
   ```

   AI is an assistive shortcut, never a requirement: people can continue with the manual form whenever Gemini is busy or unavailable. The handoff brief summarizes confirmed pickup facts, flags missing operational information, and drafts a coordination message. It never certifies food safety, approves an organization, or chooses the receiving NGO.

   The `extract-donation` deployment must be refreshed after pulling code changes; it handles both form extraction and the AI handoff brief. The product labels this helper as a pilot and keeps the manual workflow available at every point.

4. Schedule deadline housekeeping so expired posts are closed even when nobody has the website open. No Edge Function deployment is needed for this option:

   - In Supabase, open **Integrations → Cron** (or **Cron → Jobs**).
   - Choose **Create job**, name it `expire-donations-every-5-minutes`, and set the schedule to `*/5 * * * *`.
   - Choose **Database function**, then select `refresh_expired_donations` and save.

   The included `expire-donations` Edge Function is only an optional alternative for an external scheduler; you can ignore it for now.

5. GPS pins are optional. When a user allows location access, Food Waste Matcher AI stores only the coordinates for distance matching; the user still enters and confirms their address, city, state and pincode.

The Supabase anon key is intended for browser use when Row Level Security is enabled. Never put the Supabase service-role key or Gemini key in Angular environment files.

## Matching boundary

AI only extracts fields and identifies missing details. It never declares food safe and does not choose the receiving NGO. Matching should remain deterministic and auditable:

1. Filter by verified status, service radius, food policy, capacity and pickup window.
2. Rank eligible NGOs by configurable distance, timing, reliability and fairness weights.
3. Alert in ranked waves and record every outcome.

Before a real pilot, complete legal review, food-safety policy, organization verification, consent and incident-response procedures.
