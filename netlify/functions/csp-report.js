// Netlify function: csp-report
// Receives Content-Security-Policy violation reports from the browser.
// Logs them for review; in production you'd forward to a SIEM or alerting system.
// Endpoint: /api/csp-report (set as report-uri in CSP header)

const ALLOWED_ORIGIN = 'https://thecutweightlosstracker.netlify.app';

// ── Rate limiting ─────────────────────────────────────────────────────────────
const _rateMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

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

export default async (req) => {
  // CSP reports are always POST
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) return new Response(null, { status: 429 });

  try {
    const body = await req.json();
    const report = body?.['csp-report'] || body;

    // Structured log — visible in Netlify function logs
    console.log(JSON.stringify({
      type: 'csp-violation',
      ts: new Date().toISOString(),
      blockedUri: report?.['blocked-uri'] || report?.blockedURL,
      violatedDirective: report?.['violated-directive'] || report?.effectiveDirective,
      documentUri: report?.['document-uri'] || report?.documentURL,
      disposition: report?.disposition,
      ip,
    }));
  } catch {
    // Malformed report — ignore silently
  }

  // CSP report endpoints must return 2xx
  return new Response(null, { status: 204 });
};

export const config = { path: '/api/csp-report' };
