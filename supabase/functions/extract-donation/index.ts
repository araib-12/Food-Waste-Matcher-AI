import { createClient } from 'npm:@supabase/supabase-js@2';

const maxRequestCharacters = 6_000_000;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const extractionSystemPrompt = `You extract structured fields from a food donor's message for Food Waste Matcher AI.
Return JSON only with: foodName, meals, category, dietary, preparedAt, pickupBy, outlet, address, notes, missing, confidence.
dietary must be Vegetarian, Non-vegetarian, or Mixed. meals is a positive integer.
Do not decide that food is safe. Do not invent missing values; list their field names in missing.
Keep times in the user's phrasing when a timezone/date cannot be established.
Always include every field. Use an empty string for an unavailable text field, 0 for unknown meals, and keep notes concise.`;

const handoffSystemPrompt = `You prepare a human-reviewable food-pickup coordination brief for Food Waste Matcher AI.
Use only the supplied donation facts. Return JSON only with: pickupSummary, checklist, missing, ngoMessage.
pickupSummary: concise factual pickup summary, maximum two sentences.
checklist: 3 to 5 practical pickup-coordination actions. Do not state a fact unless it was supplied.
missing: only field names that are genuinely absent from the supplied facts, maximum 6.
ngoMessage: a concise draft message the food partner may copy after a verified NGO accepts.
Never say food is safe, fresh, approved, eligible, matched, or guaranteed. Never choose or rank an NGO. Never add allergens, packaging, contact information, dates, times, or food facts that were not supplied.`;

const extractionResponseSchema = {
  type: 'object',
  properties: {
    foodName: { type: 'string' },
    meals: { type: 'integer' },
    category: { type: 'string' },
    dietary: { type: 'string', enum: ['Vegetarian', 'Non-vegetarian', 'Mixed'] },
    preparedAt: { type: 'string' },
    pickupBy: { type: 'string' },
    outlet: { type: 'string' },
    address: { type: 'string' },
    notes: { type: 'string' },
    missing: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' }
  },
  required: ['foodName', 'meals', 'category', 'dietary', 'preparedAt', 'pickupBy', 'outlet', 'address', 'notes', 'missing', 'confidence']
};

const handoffResponseSchema = {
  type: 'object',
  properties: {
    pickupSummary: { type: 'string' },
    checklist: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' } },
    ngoMessage: { type: 'string' }
  },
  required: ['pickupSummary', 'checklist', 'missing', 'ngoMessage']
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin);

  if (!originAllowed(origin)) return json({ error: 'Origin is not allowed.' }, 403, headers);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);

  try {
    const authorization = request.headers.get('Authorization') ?? '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: 'Authentication is required.' }, 401, headers);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) throw new Error('Supabase function environment is incomplete');

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Invalid or expired session.' }, 401, headers);

    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    if (contentLength > maxRequestCharacters) return json({ error: 'Request is too large.' }, 413, headers);
    const rawBody = await request.text();
    if (rawBody.length > maxRequestCharacters) return json({ error: 'Request is too large.' }, 413, headers);

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON request.' }, 400, headers);
    }

    const mode = body.mode === 'handoff' ? 'handoff' : 'extract';
    if (mode === 'handoff') {
      const donation = readHandoffDonation(body.donation);
      if (!donation.foodName || Number(donation.meals) < 1 || !donation.outlet || !donation.address || !donation.pincode || !donation.pickupBy) {
        return json({ error: 'Complete the food and pickup details before preparing a handoff.' }, 400, headers);
      }

      const { data: quotaAvailable, error: quotaError } = await supabase.rpc('consume_ai_quota');
      if (quotaError) throw new Error('AI quota check failed');
      if (quotaAvailable !== true) return json({ error: 'AI usage limit reached. Please try again later.' }, 429, headers);

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('GEMINI_MODEL is invalid');

      const source = JSON.stringify(donation);
      let parsed: Record<string, unknown>;
      try {
        parsed = await requestExtractionFromGemini(apiKey, model, [{ text: `${handoffSystemPrompt}\n\nConfirmed donation facts:\n${source}` }], handoffResponseSchema);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Gemini returned malformed structured data') throw error;
        parsed = await requestExtractionFromGemini(apiKey, model, [{ text: `${handoffSystemPrompt}\n\nConfirmed donation facts:\n${source}\n\nReturn one compact, complete JSON object only. Do not add explanation or markdown.` }], handoffResponseSchema);
      }

      return json({
        pickupSummary: safeString(parsed.pickupSummary, 700),
        checklist: safeStringArray(parsed.checklist, 5, 180),
        missing: safeStringArray(parsed.missing, 6, 80),
        ngoMessage: safeString(parsed.ngoMessage, 700)
      }, 200, headers);
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    if (!text && !imageBase64) return json({ error: 'Provide text or an image.' }, 400, headers);
    if (text.length > 4000) return json({ error: 'Text is too long.' }, 413, headers);
    if (imageBase64.length > 5_600_000) return json({ error: 'Image is too large.' }, 413, headers);
    if (imageBase64 && !allowedImageTypes.has(mimeType)) return json({ error: 'Unsupported image type.' }, 415, headers);

    const { data: quotaAvailable, error: quotaError } = await supabase.rpc('consume_ai_quota');
    if (quotaError) throw new Error('AI quota check failed');
    if (quotaAvailable !== true) return json({ error: 'AI usage limit reached. Please try again later.' }, 429, headers);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('GEMINI_MODEL is invalid');

    const parts: Array<Record<string, unknown>> = [{ text: `${extractionSystemPrompt}\n\nDonor input:\n${text}` }];
    if (imageBase64) parts.push({ inlineData: { mimeType, data: imageBase64 } });
    let parsed: Record<string, unknown>;
    try {
      parsed = await requestExtractionFromGemini(apiKey, model, parts);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Gemini returned malformed structured data') throw error;
      // A single retry protects users from a rare incomplete response without
      // making the page ask them to type the donation again.
      parsed = await requestExtractionFromGemini(apiKey, model, [
        ...parts,
        { text: 'Return one compact, complete JSON object only. Do not add explanation or markdown.' }
      ]);
    }
    const extractedMeals = Number(parsed.meals ?? 0);
    const extractedConfidence = Number(parsed.confidence ?? 0);
    const result = {
      foodName: safeString(parsed.foodName, 200),
      meals: Number.isFinite(extractedMeals) ? Math.min(100_000, Math.max(0, Math.round(extractedMeals))) : 0,
      category: safeString(parsed.category, 80),
      dietary: ['Vegetarian', 'Non-vegetarian', 'Mixed'].includes(String(parsed.dietary)) ? String(parsed.dietary) : 'Mixed',
      preparedAt: safeString(parsed.preparedAt, 100),
      pickupBy: safeString(parsed.pickupBy, 100),
      outlet: safeString(parsed.outlet, 160),
      address: safeString(parsed.address, 500),
      notes: safeString(parsed.notes, 2000),
      missing: Array.isArray(parsed.missing) ? parsed.missing.slice(0, 20).map((value) => safeString(value, 50)) : [],
      confidence: Number.isFinite(extractedConfidence) ? Math.min(1, Math.max(0, extractedConfidence)) : 0
    };
    return json(result, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Donation extraction failed', message);
    if (message.includes('Gemini request failed with status 429')) {
      return json({ error: 'AI is temporarily busy because the Gemini free limit was reached. Wait about one minute and try again, or use the manual form.' }, 429, headers);
    }
    return json({ error: 'Unable to structure this donation. Please enter the details manually.' }, 500, headers);
  }
});

function configuredOrigins(): Set<string> {
  const configured = Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:4200,http://127.0.0.1:4200';
  return new Set(configured.split(',').map((value) => value.trim()).filter(Boolean));
}

function originAllowed(origin: string | null): boolean {
  return origin === null || configuredOrigins().has(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
  if (origin && originAllowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => safeString(item, maxLength)).filter(Boolean)
    : [];
}

function readHandoffDonation(value: unknown): Record<string, string | number> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const meals = Number(source.meals ?? 0);
  return {
    foodName: safeString(source.foodName, 200),
    meals: Number.isFinite(meals) ? Math.max(0, Math.min(100_000, Math.round(meals))) : 0,
    category: safeString(source.category, 80),
    dietary: safeString(source.dietary, 40),
    outlet: safeString(source.outlet, 160),
    address: safeString(source.address, 500),
    city: safeString(source.city, 100),
    state: safeString(source.state, 100),
    pincode: safeString(source.pincode, 6),
    preparedAt: safeString(source.preparedAt, 100),
    pickupBy: safeString(source.pickupBy, 100),
    notes: safeString(source.notes, 2000)
  };
}

async function requestExtractionFromGemini(
  apiKey: string,
  model: string,
  parts: Array<Record<string, unknown>>,
  responseSchema: Record<string, unknown> = extractionResponseSchema
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        temperature: 0,
        maxOutputTokens: 2048
      }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    // Gemini's error payload identifies actionable configuration issues (such as
    // billing, region availability, or an invalid key). Log only its bounded
    // response text; credentials and donor input are never included here.
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 1_000);
    throw new Error(`Gemini request failed with status ${response.status}: ${detail || 'No error details returned'}`);
  }

  const payload = await response.json();
  const responseParts = payload?.candidates?.[0]?.content?.parts;
  const raw = Array.isArray(responseParts)
    ? responseParts
      .filter((part) => typeof part?.text === 'string' && part.thought !== true)
      .map((part) => part.text)
      .join('')
    : '';
  if (!raw || raw.length > 20_000) throw new Error('Gemini returned an invalid extraction');
  return parseExtractionJson(raw);
}

function parseExtractionJson(raw: string): Record<string, unknown> {
  const withoutFence = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  const candidate = firstBrace >= 0 && lastBrace >= firstBrace
    ? withoutFence.slice(firstBrace, lastBrace + 1)
    : withoutFence;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error('Gemini returned malformed structured data');
  }
}

function json(value: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
