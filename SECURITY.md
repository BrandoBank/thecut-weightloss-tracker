# Security Policy

## Supported Versions

| Component | Status |
|-----------|--------|
| `index.html` (current) | ✅ Actively maintained |

## Architecture Summary

The Cut is a client-side web app backed by Supabase (Postgres + Auth). Understanding the architecture helps scope what's in and out of scope for vulnerability reports.

- **Frontend:** Vanilla JS, single HTML file, hosted on Netlify
- **Auth:** Supabase email magic link — no passwords stored anywhere
- **Database:** Supabase Postgres with Row Level Security enforced at the DB layer
- **AI features:** Direct browser calls to `api.anthropic.com` using a user-supplied API key stored only in `localStorage`
- **Health integration:** URL parameter bridge that writes Apple Health data to Supabase after auth and input validation

## Scope

### In scope

- **RLS bypass** — any technique that allows one authenticated user to read or write another user's data
- **XSS** — unsanitized user input reaching the DOM
- **URL bridge abuse** — the Apple Health `?logWeight=` / `?addExercise=` parameter bridge accepting malformed or malicious input that bypasses validation
- **Auth issues** — session fixation, token leakage, improper session handling
- **Credential exposure** — if a real Supabase key or Anthropic key were somehow reintroduced to the source

### Out of scope

- Supabase infrastructure itself (report to [Supabase](https://supabase.com/docs/guides/platform/going-into-prod#security))
- Anthropic API infrastructure (report to [Anthropic](https://www.anthropic.com/security))
- Netlify hosting infrastructure (report to [Netlify](https://www.netlify.com/security/))
- Attacks requiring physical access to the user's device
- Self-inflicted issues from a user entering their own malicious API key
- The anon/publishable Supabase key being visible in source — this is intentional; RLS is the control

## Reporting a Vulnerability

Please report privately before disclosing publicly.

**Preferred:** Open a [GitHub Security Advisory](../../security/advisories/new) on this repository. It's private by default — only you and the maintainer see it.

**Alternative:** Reach out via GitHub profile contact.

Include:
- Description of the vulnerability and potential impact
- Steps to reproduce (include browser, OS, any test payloads)
- Whether you were able to confirm actual data access or only a theoretical path
- Suggested fix if you have one

**Response SLA:**
- Acknowledgment: within **3 business days**
- Confirmed fix or status update: within **14 days**

## Disclosure Policy

This project follows coordinated disclosure. I'll work with you on a timeline before anything goes public, and I'll credit you in the fix commit if you'd like.

Thank you for taking the time to report responsibly.
