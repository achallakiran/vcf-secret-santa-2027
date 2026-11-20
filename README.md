# VCF Secret Santa — browser game

A holiday office Secret Santa experience, hosted as a static GitHub Pages frontend with an isolated Supabase backend.

## Access — no Supabase login for organizers or players

- **Organizer:** `?admin=1` on the deployed game URL. Enter the **temporary organizer PIN** supplied privately by the event owner. You can change the PIN in the organizer console, without changing Supabase Auth settings.
- **Player:** open the event-specific invitation link (`?event=<event-slug>`) shared by the organizer. Enter only the unique **four-digit invitation code**. No email, password or Supabase account is required.
- The four-digit values are checked by the dedicated **`ss-gateway` Edge Function**. Browser code contains only the Supabase public/publishable key, never the service-role secret.
- PINs are low entropy; this prototype uses server-side PBKDF2 verification for the administrator, keyed HMAC fingerprints for invitations, attempt lockouts, and expiring signed sessions. **Change the default PIN before inviting real colleagues.** Do not use this prototype to handle confidential company data.
- The administrator PIN is **global** for this initial single-organizer prototype: anyone with it can access all events. Future multi-office independent administrators will need per-event credentials and authorization.

## Current implementation

- Black Christmas entry screen with animated falling snow, festive title, rules including the suggested ₹500 gift budget and optional Santa tasks.
- PIN-based organizer interface: create events, register participants with optional phone and desk, create or rotate four-digit codes, share WhatsApp invitations, generate/lock one-to-one Secret Santa pairings, and change the admin PIN.
- Participant code redemption: signed event-scoped sessions, personal dashboard, editable itemized wishlist.
- Santa-side interface: see only your Secret Child, read the Child's wishlist, assign dated tasks, tick tasks complete, record gift purchase, write private ceremony message.
- Child-side interface: read tasks assigned up to the current day, including completion status, without revealing their Santa's identity.
- Minimal two-icon player HUD (pause, hint) and pause menu with **Character** and **Personal** tabs.
- Supabase database: 8 `ss_*` game tables, plus one restricted `ss_auth_guard` table for PIN verification/lockout, and three privileged transaction helpers.
- Supabase functions: `ss-gateway` is the current API; `ss-organizer` is retired and returns HTTP 410.

**Not implemented yet:** Detailed voxel avatar editor, playable office scene (currently a placeholder), persistent office/day scene generation, truthful daily hints, or organizer-controlled final reveal. Player hints correctly show a not-yet-available message until an office scene is published.

## Deployment

Repository: https://github.com/achallakiran/vcf-secret-santa-2027

Expected GitHub Pages address (requires GitHub Pages setup):

https://achallakiran.github.io/vcf-secret-santa-2027/

If this URL gives 404, set **Repository Settings → Pages → Deploy from a branch → main → /(root)**. The current session could not independently verify live GitHub Pages publication.

No build step: `index.html` references `assets/styles.css` and `assets/app.js` from the repo. Frontend logic needs an internet connection to communicate with Supabase and is not yet an offline-playable game.

## Repository structure

```
index.html
assets/
  app.js
  styles.css
supabase/
  functions/
    ss-gateway/
      index.ts
    ss-organizer/
      index.ts       # retired endpoint
README.md
```

## Database separation

Uses Supabase project `fwrievuhudjkeffmszqf` (the existing `achallakiran's Project`). Secret Santa tables/functions are prefixed `ss_`. Other applications' existing data, application tables, and Supabase Auth configuration were not modified.

Current `public.ss_events`, `public.ss_participants`, `public.ss_assignments` and code tables have **no live event/participant data** until the organizer creates the first event. The server-generated assignment cycle ensures every participating Santa has a different Child, and everyone receives exactly one Santa.

## Verification status

- Backend gateway deployed and reporting ACTIVE.
- Existing Supabase tables and revoked role privileges checked.
- GitHub files checked for syntax and DOM event wiring.
- The DB registration/assignment helper functions previously passed a rollback-only three-participant verification.
- **The new anonymous-PIN end-to-end network login has not yet been run in a real browser.** It should be tested after GitHub Pages is accessible, along with rate limiting, wrong-PIN handling, token rotation, privacy, and mobile Safari.
