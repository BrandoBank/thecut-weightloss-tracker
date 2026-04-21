// Netlify function: fetch-recipe
// Proxies a URL fetch server-side to bypass CORS, strips HTML,
// and returns plain text content for Claude to parse as a recipe.

const MAX_CHARS = 12000; // ~3k tokens, enough for any recipe page

export default async (req) => {
  // Handle CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate it's an http/https URL
  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();
    const text = stripHtml(html).slice(0, MAX_CHARS);

    return new Response(JSON.stringify({ text, url: parsed.toString() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'Request timed out' : 'Failed to fetch URL';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

function stripHtml(html) {
  return html
    // Remove script/style/noscript blocks entirely
    .replace(/<(script|style|noscript|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const config = { path: '/api/fetch-recipe' };
