// Netlify function: fetch-recipe
// Proxies a URL fetch server-side to bypass CORS, strips HTML,
// and returns plain text content for Claude to parse as a recipe.

const MAX_CHARS = 12000; // ~3k tokens, enough for any recipe page
const ALLOWED_ORIGIN = 'https://thecutweightlosstracker.netlify.app';

// ── Rate limiting (in-memory, per IP, resets on cold start) ──────────────────
const _rateMap = new Map(); // ip → { count, windowStart }
const RATE_LIMIT = 20;      // max requests
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

// ── Domain allowlist for recipe imports ──────────────────────────────────────
const ALLOWED_RECIPE_DOMAINS = new Set([
  'allrecipes.com', 'www.allrecipes.com',
  'food.com', 'www.food.com',
  'foodnetwork.com', 'www.foodnetwork.com',
  'cooking.nytimes.com', 'nytimes.com',
  'seriouseats.com', 'www.seriouseats.com',
  'epicurious.com', 'www.epicurious.com',
  'bonappetit.com', 'www.bonappetit.com',
  'tasty.co', 'www.tasty.co',
  'delish.com', 'www.delish.com',
  'bbcgoodfood.com', 'www.bbcgoodfood.com',
  'thekitchn.com', 'www.thekitchn.com',
  'simplyrecipes.com', 'www.simplyrecipes.com',
  'skinnytaste.com', 'www.skinnytaste.com',
  'budgetbytes.com', 'www.budgetbytes.com',
  'halfbakedharvest.com', 'www.halfbakedharvest.com',
  'minimalistbaker.com', 'www.minimalistbaker.com',
  'sallysbakingaddiction.com', 'www.sallysbakingaddiction.com',
  'tasteofhome.com', 'www.tasteofhome.com',
  'myrecipes.com', 'www.myrecipes.com',
  'recipetineats.com', 'www.recipetineats.com',
  'pinchofyum.com', 'www.pinchofyum.com',
  'cookingclassy.com', 'www.cookingclassy.com',
  'downshiftology.com', 'www.downshiftology.com',
  'mealplannerpro.com', 'www.mealplannerpro.com',
  'yummly.com', 'www.yummly.com',
  'spoonacular.com', 'www.spoonacular.com',
  'healthyeating.nhlbi.nih.gov',
  'choosemyplate.gov',
]);

function isAllowedDomain(hostname) {
  if (ALLOWED_RECIPE_DOMAINS.has(hostname)) return true;
  // Allow any subdomain of an allowlisted root
  for (const allowed of ALLOWED_RECIPE_DOMAINS) {
    if (hostname.endsWith('.' + allowed)) return true;
  }
  return false;
}

function corsHeaders(origin) {
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Validate protocol and domain
  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowedDomain(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not in allowlist. Use a supported recipe site.' }), {
      status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TheCutRecipeImporter/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const text = stripHtml(html).slice(0, MAX_CHARS);

    return new Response(JSON.stringify({ text, url: parsed.toString() }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'Request timed out' : 'Failed to fetch URL';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
};

function stripHtml(html) {
  return html
    .replace(/<(script|style|noscript|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const config = { path: '/api/fetch-recipe' };
