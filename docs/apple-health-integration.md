# Apple Health Integration via iOS Shortcuts

The Cut accepts weight and exercise data pushed directly from Apple Health using an iOS Shortcut and a custom URL parameter scheme. This lets your Apple Watch activity and morning weigh-ins land in the app automatically — no manual entry.

---

## How It Works

The app's `handleUrlParams()` function runs on every page load. It reads specific query parameters from the URL, writes the data to Supabase, then **immediately clears the query string** using `history.replaceState()` so that reloading the page doesn't re-trigger the same write.

```
https://thecutweightlosstracker.netlify.app/?logWeight=185.4
  └─ app loads → reads logWeight param → saves to weights table → clears URL
```

The iOS Shortcut opens this URL via Safari, the app runs its startup logic, and the user sees their data already logged.

---

## Supported URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `logWeight` | float | Today's weight in lbs. Validated: must be between 50–600. |
| `addExercise` | float | Calories burned to log as an exercise entry. |
| `name` | string | Name for the exercise entry. Defaults to `"Apple Watch activity"`. |
| `duration` | float | Duration in minutes. Optional, defaults to 0. |
| `replace` | `"1"` | If present, deletes any existing entry with the same name before inserting. Prevents duplicate Apple Watch totals when the Shortcut runs multiple times per day. |

### Example URLs

```
# Log a morning weigh-in
?logWeight=184.2

# Log Apple Watch activity (idempotent — safe to run multiple times)
?addExercise=420&name=Apple+Watch+activity&duration=60&replace=1

# Log both at once
?logWeight=184.2&addExercise=420&name=Apple+Watch+activity&replace=1
```

---

## iOS Shortcut Setup

1. Open the **Shortcuts** app on your iPhone or Apple Watch
2. Create a new Shortcut with these actions:

```
[Get Contents of Health — Active Energy Burned — Today]
[Get Contents of Health — Weight — Most Recent Sample]
[Open URL]
  URL: https://thecutweightlosstracker.netlify.app/
       ?logWeight=[Weight Sample]
       &addExercise=[Active Energy]
       &name=Apple Watch activity
       &replace=1
```

3. Add the Shortcut to an **Automation** — e.g. trigger at 9:00 PM daily, or on Apple Watch complication tap.

> **Tip:** Use the Shortcuts URL builder to construct the URL — it handles encoding automatically. Don't URL-encode the `?` and `&` characters in the Shortcuts UI.

---

## Security Considerations

### Trust Boundary

The URL parameter bridge is an **unauthenticated write path** — anyone who can construct the URL can attempt to push data. The app mitigates this in layers:

1. **Auth gate:** `handleUrlParams()` only runs after `sb.auth.getSession()` resolves with a valid user. Unauthenticated calls are silently dropped.
2. **Input validation:** `logWeight` is range-checked (50–600 lbs). `addExercise` is checked to be a positive number. Invalid values are ignored — no error is surfaced that could leak app state.
3. **RLS enforcement:** All writes go through the Supabase client, which attaches the user's JWT. The database RLS policies reject any write where `auth.uid() != user_id`, regardless of what the client sends.
4. **No secrets in the URL:** The URL contains only data values — no API keys, tokens, or user identifiers are passed as parameters.

### Query String Clearing

After a successful write, the app calls:

```js
const url = new URL(window.location);
url.search = '';
window.history.replaceState({}, '', url.toString());
```

This removes the parameters from the browser history entry and prevents:
- Re-submission on page reload
- Parameters appearing in browser history or server access logs
- Parameters leaking via the `Referer` header if the user navigates to an external link

### What the App Does Not Trust

- The `name` parameter is stored as a string but **never evaluated or rendered as HTML** — it passes through `esc()` (an HTML-escaping utility) before any DOM insertion.
- `duration` and `calories` values are cast with `parseFloat()` and `Math.round()` — malformed strings become `NaN` and are dropped by the `isNaN()` guard.
- The `replace` flag only matches entries by **name equality** for the authenticated user — it cannot affect other users' data.

---

## Limitations

- The bridge only works when the user is signed in on the device that opens the URL. If you're signed out, the write is silently skipped.
- Apple Watch complications that open URLs do so in a background Safari session — verify your Shortcut is set to open in the foreground if you want visual confirmation.
- There is no HMAC or token on the URL, so a malicious actor who knows your app URL and is on the same device session could craft a write. Acceptable for a personal-use app; a production version would add a short-lived signed token.
