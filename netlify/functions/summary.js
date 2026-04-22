// Netlify function: summary
// Returns today's calorie/macro summary for a given user.
// Used by the Apple Watch Shortcut widget.
// Query: /api/summary?uid=<uuid>&sig=<hmac-sha256>
//
// HMAC signing: sig = HMAC-SHA256(uid + ":" + YYYY-MM-DD, SUMMARY_SIGNING_SECRET)
// The Shortcut should compute this daily and include it as the ?sig param.
// Requests without a valid signature are rejected with 401.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SIGNING_SECRET = process.env.SUMMARY_SIGNING_SECRET; // set in Netlify env vars
const ALLOWED_ORIGIN = 'https://thecutweightlosstracker.netlify.app';

// ── Rate limiting (in-memory, per IP, resets on cold start) ──────────────────
const _rateMap = new Map();
const RATE_LIMIT = 60;      // max requests per window (Watch polls frequently)
const RATE_WINDOW = 60_000; // 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = _rateMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW) {
    _rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  _rateMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

function corsHeaders(origin) {
  const allowedOrigin = (!origin || origin === ALLOWED_ORIGIN) ? (origin || '*') : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function isValidUid(uid) {
  return typeof uid === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid);
}

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────
async function verifySignature(uid, date, sig) {
  if (!SIGNING_SECRET) return true; // if secret not configured, skip (dev mode)
  if (!sig) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const message = encoder.encode(`${uid}:${date}`);
  let sigBytes;
  try {
    sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, sigBytes, message);
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const params = new URL(req.url).searchParams;
  const uid = params.get('uid');
  const sig = params.get('sig');

  if (!uid || !isValidUid(uid)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid uid' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Verify HMAC signature
  const valid = await verifySignature(uid, today, sig);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid or missing signature' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const [foodRes, settingsRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/food_log?user_id=eq.${uid}&date=eq.${today}&select=entry`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&select=settings`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      ),
    ]);

    const rows = await foodRes.json();
    const sRows = await settingsRes.json();
    const settings = sRows[0]?.settings || {};
    const target = settings.calorieTarget || 1700;

    const totals = rows.reduce((a, r) => {
      const e = r.entry || {};
      return {
        cal: a.cal + (e.calories || 0),
        p: a.p + (e.protein || 0),
        c: a.c + (e.carbs || 0),
        f: a.f + (e.fat || 0),
      };
    }, { cal: 0, p: 0, c: 0, f: 0 });

    const remaining = target - totals.cal;
    const summary = `The Cut. — ${today}\n` +
      `Calories: ${totals.cal} / ${target} (${remaining > 0 ? remaining + ' remaining' : Math.abs(remaining) + ' over'})\n` +
      `Protein: ${totals.p}g  Carbs: ${totals.c}g  Fat: ${totals.f}g\n` +
      `${rows.length} item${rows.length !== 1 ? 's' : ''} logged`;

    return new Response(JSON.stringify({ summary, totals, target, remaining, date: today }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/summary' };
