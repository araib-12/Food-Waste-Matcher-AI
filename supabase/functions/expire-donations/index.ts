import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Server-only pickup-deadline housekeeping.
 *
 * Deploy it after setting CRON_SECRET, then call it every five minutes from a
 * scheduler with `x-mealping-cron-secret`. The browser also invokes the same
 * database routine as a safety net, but this function makes expiry reliable
 * when nobody has the app open.
 */
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const expectedSecret = Deno.env.get('CRON_SECRET');
  const receivedSecret = request.headers.get('x-mealping-cron-secret') ?? '';
  if (!expectedSecret || !safeEqual(receivedSecret, expectedSecret)) {
    return response({ error: 'Unauthorized.' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return response({ error: 'Function environment is incomplete.' }, 500);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.rpc('refresh_expired_donations');
  if (error) {
    console.error('Donation expiry failed', error.message);
    return response({ error: 'Unable to refresh expired donations.' }, 500);
  }
  return response({ expired: Number(data ?? 0) });
});

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// Compare every position before returning so a timing response cannot reveal
// how much of the schedule secret matched.
function safeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let result = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return result === 0;
}
