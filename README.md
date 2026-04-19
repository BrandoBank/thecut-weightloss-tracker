# The Cut — Weight Loss Tracker

A personal food and weight tracker I built to break through a weight-loss plateau. Single-file vanilla JavaScript, backed by Supabase (Postgres + auth + row-level security), with Apple Health integration via an iOS Shortcut.

**Live app:** [thecutweightlosstracker.netlify.app](https://thecutweightlosstracker.netlify.app)

---

## What It Does

- **Daily food log** — breakfast, lunch, dinner, snack categories with calorie and macro tracking
- **AI nutrition lookup** — type a food name and get instant calorie/macro estimates via Claude API (Haiku)
- **Barcode / nutrition label scan** — camera captures a label, Claude reads it and fills the form
- **Exercise logging** — manual or AI-estimated calories burned by activity description
- **Weight tracking** — daily weigh-ins with a 21-day trend graph and goal projection
- **Apple Watch integration** — iOS Shortcut pushes active calories and weight from Apple Health automatically
- **Water tracking** — daily fluid intake log
- **Progress photos** — stored per-date, visible in a timeline
- **Weekly stats** — avg calories, deficit days, logged streak, weight delta
- **AI plateau coach** — when weight stalls, pulls recent data and gives a plain-language breakdown

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Vanilla JS, no framework | No build step — edit and deploy one file |
| Auth | Supabase Auth (email magic link) | No passwords to store or hash |
| Database | Supabase Postgres | Managed, free tier, SQL |
| Security | Row Level Security | DB enforces access control, not just app code |
| AI | Claude Haiku (Anthropic API) | Fast, cheap, accurate nutrition estimation |
| Hosting | Netlify | Free, drag-and-drop deploy |
| Health data | iOS Shortcuts + URL bridge | No HealthKit entitlement required |

---

## Security Design

### Row Level Security

Every table in Postgres has RLS enabled with policies that enforce `auth.uid() = user_id` on every read, insert, update, and delete. This means:

- **The database itself rejects cross-user queries** — a bug in app code that accidentally omits a `.eq('user_id', id)` filter doesn't leak data, because Postgres won't return rows that don't belong to the authenticated user.
- The Supabase client attaches the user's JWT on every request. The `anon` (publishable) key in the source code only allows operations that RLS permits — it cannot bypass policies.
- Even if someone extracted the publishable key, they could only access data for the account they're authenticated as.

See [`supabase-schema.sql`](./supabase-schema.sql) for the full table definitions and RLS policy declarations.

### What the App Explicitly Does Not Trust

- **URL parameters** — the Apple Health bridge reads query params, but range-validates all numeric inputs, drops unrecognized keys, and clears the query string after processing. Parameters are never eval'd or rendered as raw HTML.
- **AI responses** — nutrition and exercise estimates from Claude are parsed as JSON and individual fields are cast to integers. Malformed responses are caught and surfaced as a user-facing error, not silently swallowed.
- **User input in the DOM** — all user-supplied strings pass through an `esc()` HTML-escaping function before being inserted via template literals. No `innerHTML` with raw user input.
- **The Anthropic API key** — stored only in `localStorage` on the user's own device, never synced to Supabase, never sent anywhere except the Anthropic API endpoint.

### Threat Model Notes

| Threat | Mitigation |
|--------|-----------|
| Another user reading your food log | RLS policy: `auth.uid() = user_id` enforced at DB layer |
| Credential leakage from source | Publishable (anon) key only; service role key never touches the client |
| URL bridge replay attack | Query string cleared via `history.replaceState()` after processing; auth required |
| XSS via food name input | All user strings escaped through `esc()` before DOM insertion |
| AI response injection | JSON-parsed and field-cast; not rendered as markup |
| API key exposure | Anthropic key stored in `localStorage`, user-supplied, never committed |

### Apple Health URL Bridge

The iOS Shortcut integration uses URL parameters to push data from Apple Health into the app. See [`docs/apple-health-integration.md`](./docs/apple-health-integration.md) for a full breakdown of the trust boundary, input validation, and query-string clearing behavior.

---

## Self-Hosting

### 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Run [`supabase-schema.sql`](./supabase-schema.sql) in the SQL Editor
3. Enable **Email** auth in Authentication → Providers
4. Copy your **Project URL** and **anon/public key** from Project Settings → API

### 2. Configure the app

Open `index.html` and replace the placeholders near line 244:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

### 3. Deploy

Drag `index.html` into [netlify.com/drop](https://netlify.com/drop) — done. No build step.

### 4. Claude API (optional)

The AI features (nutrition lookup, label scan, exercise estimation, plateau coach) require an Anthropic API key. Enter it in the app's Settings tab — it's stored in your browser's `localStorage` only and never leaves your device except in direct calls to `api.anthropic.com`.

---

## Project Structure

```
thecut-weightloss-tracker/
├── index.html                        # Entire app — ~2,800 lines of HTML/CSS/JS
├── supabase-schema.sql               # Postgres schema with RLS policies
├── docs/
│   └── apple-health-integration.md  # iOS Shortcut setup + security notes
├── .gitignore
├── LICENSE
└── README.md
```

---

## Why I Built This

Existing trackers (MyFitnessPal, Cronometer) are good at logging but bad at helping you understand *why* you're not losing. I wanted something that combined the log with trend analysis, plateau detection, and an AI coach — and that I actually owned and controlled. Built and iterated over several weeks of daily use.

---

## License

MIT
