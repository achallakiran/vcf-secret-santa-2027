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
- PIN-based organizer interface: create events, register participants with an optional desk, create or rotate four-digit codes, open WhatsApp invitations, generate/lock one-to-one Secret Santa pairings, and change the admin PIN.
- Participant code redemption: signed event-scoped sessions, personal dashboard, editable itemized wishlist.
- Santa-side interface: see only your Secret Child, read the Child's wishlist, assign dated tasks, tick tasks complete, record gift purchase, write private ceremony message.
- Child-side interface: read tasks assigned up to the current day, including completion status, without revealing their Santa's identity.
- Minimal two-icon player HUD (pause, hint) and pause menu with **Character** and **Personal** tabs.
- Supabase database: 8 `ss_*` game tables, plus one restricted `ss_auth_guard` table for PIN verification/lockout, and three privileged transaction helpers.
- Supabase functions: `ss-gateway` is the current API; `ss-organizer` is retired and returns HTTP 410.

**Not implemented yet:** Detailed editable voxel avatar customizer and persistent wardrobe settings, published office/day scene generation, truthful daily hints, or organizer-controlled final reveal. The new 3D office is an initial playable procedural prototype, not yet confirmed to match the reference image's level of polish.

## Optional WhatsApp sharing: no phone-number storage

- Organizer entry asks for a **10-digit number** (optional) with a country-code dropdown defaulting to **India (+91)**. Do not enter +91 into the number field.
- The field is strictly for WhatsApp sharing: after registering a person, a temporary sharing dialog displays the number locally. The number is never sent to the Supabase API and is cleared when the dialog closes.
- If the number was omitted, the organizer can still generate a code and copy the invitation or use the WhatsApp button and enter a number in the temporary dialog.
- The database table `ss_participant_private` has **no phone-number column**, and the `ss-gateway` Edge Function never accepts phone values. The legacy phone-capable registration function has been dropped.
- The app does not store phone numbers in cookies, browser local/session storage, PostgreSQL or Supabase logs. Opening the WhatsApp link necessarily shares the destination number with WhatsApp/the browser, which have their own privacy practices.


## Phase 2A — first explorable voxel Christmas office (November 2026)

The participant-code flow now opens a new procedural Three.js 3D office scene instead of the former Christmas tree placeholder. The organizer console, invitation-code login, private wishlists and task API remain unchanged.

**Public art preview without a participant account:** `https://achallakiran.github.io/vcf-secret-santa-2027/?preview=1`. This preview contains fictional coworkers and does not use or expose real event data. GitHub Pages must be enabled for the URL to work.

**Player controls:** click/tap a free patch of floor to walk there; click/tap a coworker to approach and wave; the lower-right hand icon opens one selector with exactly four emotes (Hi, Dance, Clap, Cheer); the top-right pause icon opens Character / Personal and camera settings. There is no joystick, chat or online icon.

**Camera options:** elevated three-quarter follow (default), closer follow, and wide overview. Selected camera mode is saved locally in the browser. Personal data stays in Supabase, not in the camera preferences.

**Geometry:** one single-sided wall-facing row and one double-sided benching island, both perpendicular to the north window; each desk’s long edge faces its employee. The north window starts at the west corner and stops shortly after the double-sided island. Office length grows with 3 workstations per north–south bay, with a minimum of four bays. Spawn is close to the first workstations, not at the celebration stage. The main Christmas tree and reveal zone are at the far end, with a smaller tree near spawn. Desks have ordinary office props—no monument pictures.

**Visuals:** authored procedural voxel avatars with modeled faces, layered hair, body rigs, multiple outfit presets and movement/sitting/Hi/Dance/Clap/Cheer animations; festive interior furnishings, hanging lights, trees, plants, wrapped gifts, office furniture, tile flooring, shadows and windows. Near NPCs use articulated character meshes; distant NPCs use low-detail stand-ins to limit mobile GPU workload.

**Code organization:**

```
assets/game/
  avatar.js        # authored articulated procedural character geometry
  office.js        # scalable workstations, walls, window, decorations and celebration area
  main.js          # rendering, camera, A* navigation, actions and nearby NPC details
```

The Three.js module is loaded at a pinned CDN version via an import map. This new game scene requires network access and WebGL; the previous static login/backend screens remain as before. We have checked module syntax, DOM references, a mocked run of scalable office generation, avatar animation-rig calls, and representative navigation routes. **Full browser rendering, visual fidelity relative to the reference image, performance on real mobile phones, and end-to-end GitHub Pages gameplay still require live verification.**

**Next milestone:** improve the actual 3D lighting, silhouettes, textures and animations based on in-browser feedback; then deliver full Indian wardrobe/face/body customization and secure avatar-save support. Existing menu text indicates which features are pending.

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
- **The new 3D office has not yet been run in a real browser here.** It should be tested after GitHub Pages is accessible, along with rate limiting, wrong-PIN handling, token rotation, privacy, and mobile Safari.
