// Netlify function: summary
// Returns today's calorie/macro summary for a given user.
// Used by the Apple Watch Shortcut widget.
// Query: /api/summary?uid=<supabase-user-id>

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const uid = new URL(req.url).searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Fetch today's food log
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/food_log?user_id=eq.${uid}&date=eq.${today}&select=entry`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await res.json();

    // Fetch user settings for calorie target
    const sRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&select=settings`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const sRows = await sRes.json();
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
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/summary' };
