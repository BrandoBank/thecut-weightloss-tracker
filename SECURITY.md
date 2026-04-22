# Security Policy

## Supported Versions

| Component | Status |
|-----------|--------|
| `index.html` (current) | ✅ Actively maintained |
| `netlify/functions/*` (current) | ✅ Actively maintained |

## Architecture Summary

The Cut is a client-side PWA backed by Supabase (Postgres + Auth). Understanding the architecture helps scope what's in and out of scope for vulnerability reports.

- **Frontend:** Vanilla JS, single HTML file, hosted on Netlify
- **Auth:** Supabase email magic link — no passwords stored anywhere
- **Database:** Supabase Postgres with Row Level Security enforced at the DB layer
- **AI features:** Direct browser calls to `api.anthropic.com` using a user-supplied API key stored in Supabase `user_settings` (encrypted at rest via Supabase) and `localStorage`
- **Server functions:** Two Netlify Edge Functions — `fetch-recipe` (URL proxy) and `summary` (Apple Watch widget)
- **Health integration:** URL parameter bridge that writes Apple Health data to Supabase after auth and input validation

---

## Security Controls

### Transport & Headers

All responses include:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Allowlist: self, jsdelivr CDN (SRI-pinned), Supabase, Anthropic, Open Food Facts |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera/mic/geo/payment/USB/Bluetooth restricted to minimum necessary |

### Subresource Integrity

The only external script (`@supabase/supabase-js`) is loaded with a pinned version and `integrity` hash, preventing CDN-level supply chain attacks.

### API Function Hardening

Both Netlify functions (`fetch-recipe`, `summary`) implement:

- **CORS lockdown** — `Access-Control-Allow-Origin` restricted to the production domain only
- **Rate limiting** — per-IP request throttle (20 req/min for fetch-recipe, 60 req/min for summary) with `429` + `Retry-After` response
- **Input validation** — uid validated against UUID regex before any Supabase query; URL validated for protocol before fetch
- **Domain allowlist** — `fetch-recipe` only proxies requests to an explicit allowlist of known recipe sites; all others receive `403`

### Client-side Hardening

- **API key format validation** — `callClaude()` rejects keys that don't match the `sk-ant-api\d{2}-` pattern before making any network request
- **XSS mitigation** — all user-controlled strings pass through `esc()` (HTML entity encoding) before DOM insertion; no `innerHTML` with unescaped user data
- **No `eval` or dynamic `Function()`** — all logic is static

---

## Scope

### In scope

- **RLS bypass** — any technique that allows one authenticated user to read or write another user's data
- **XSS** — unsanitized user input reaching the DOM
- **SSRF via fetch-recipe** — bypassing the domain allowlist to proxy internal/private network addresses
- **URL bridge abuse** — the Apple Health `?logWeight=` / `?addExercise=` parameter bridge accepting malformed or malicious input that bypasses validation
- **Auth issues** — session fixation, token leakage, improper session handling
- **Rate limit bypass** — techniques that defeat the per-IP throttle on API functions
- **Credential exposure** — if a real Supabase key or Anthropic key were somehow reintroduced to the source

### Out of scope

- Supabase infrastructure itself (report to [Supabase](https://supabase.com/docs/guides/platform/going-into-prod#security))
- Anthropic API infrastructure (report to [Anthropic](https://www.anthropic.com/security))
- Netlify hosting infrastructure (report to [Netlify](https://www.netlify.com/security/))
- Attacks requiring physical access to the user's device
- Self-inflicted issues from a user entering their own malicious API key
- The anon/publishable Supabase key being visible in source — this is intentional; RLS is the control
- In-memory rate limiting being reset on function cold start — known limitation of serverless

---

## Reporting a Vulnerability

Please report privately before disclosing publicly.

**Preferred:** Open a [GitHub Security Advisory](../../security/advisories/new) on this repository. It's private by default — only you and the maintainer can see it.

**Alternative:** Reach out via GitHub profile contact.

Include:
- Description of the vulnerability and potential impact
- Steps to reproduce (browser, OS, any test payloads)
- Whether you confirmed actual data access or only a theoretical path
- Suggested fix if you have one

**Response SLA:**
- Acknowledgment: within **3 business days**
- Confirmed fix or status update: within **14 days**

## Disclosure Policy

This project follows coordinated disclosure. I'll work with you on a timeline before anything goes public, and I'll credit you in the fix commit if you'd like.

Thank you for taking the time to report responsibly.
