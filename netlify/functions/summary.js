// Netlify function: summary
// Returns today's calorie/macro summary for a given user.
// Used by the Apple Watch Shortcut widget.
// Query: /api/summary?uid=<supabase-user-id>

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGIN = 'https://thecutweightlosstracker.netlify.app';

// ── Rate limiting (in-memory, per IP, resets on cold start) ──────────────────
const _rateMap = new Map(); // ip → { count, windowStart }
const RATE_LIMIT = 60;      // max requests (higher for Watch polling)
const RATE_WINDOW = 60_000; // per 60 seconds

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
  // Allow the app origin AND direct Watch/Shortcut calls (no origin header)
  const allowedOrigin = (!origin || origin === ALLOWED_ORIGIN) ? (origin || '*') : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

// Basic UUID-format validation for uid param
function isValidUid(uid) {
  return typeof uid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid);
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

  const uid = new URL(req.url).searchParams.get('uid');
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
      return { cal: a.cal + (e.calories || 0), p: a.p + (e.protein || 0), c: a.c + (e.carbs || 0), f: a.f + (e.fat || 0) };
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
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/summary' };
