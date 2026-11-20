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

**Not implemented yet:** Full production-quality facial morphs, all contemporary Indian wardrobe variations and footwear choices, published office/day scene generation, truthful daily hints, or organizer-controlled final reveal. Phase 2B now includes a working initial avatar editor and secure per-player save, but visual fidelity still needs real-browser review and further polishing.

## Optional WhatsApp sharing: no phone-number storage

- Organizer entry asks for a **10-digit number** (optional) with a country-code dropdown defaulting to **India (+91)**. Do not enter +91 into the number field.
- The field is strictly for WhatsApp sharing: after registering a person, a temporary sharing dialog displays the number locally. The number is never sent to the Supabase API and is cleared when the dialog closes.
- If the number was omitted, the organizer can still generate a code and copy the invitation or use the WhatsApp button and enter a number in the temporary dialog.
- The database table `ss_participant_private` has **no phone-number column**, and the `ss-gateway` Edge Function never accepts phone values. The legacy phone-capable registration function has been dropped.
- The app does not store phone numbers in cookies, browser local/session storage, PostgreSQL or Supabase logs. Opening the WhatsApp link necessarily shares the destination number with WhatsApp/the browser, which have their own privacy practices.


## Phase 2A — first explorable voxel Christmas office (November 2026)

The participant-code flow now opens a new procedural Three.js 3D office scene instead of the former Christmas tree placeholder. The organizer console, invitation-code login, private wishlists and task API remain unchanged.

**Public art preview without a participant account:** `https://achallakiran.github.io/vcf-secret-santa-2027/?preview=1`. This preview contains fictional coworkers and does not use or expose real event data. GitHub Pages must be enabled for the URL to work.

**Player controls:** click/tap a free patch of floor to walk; click/tap a coworker to approach and greet. **One tap of the only action button performs a randomly selected Hi, Dance, Clap or Cheer**, immediately, without any action dropdown, cycling control or long-press gesture. It avoids repeating the immediately previous animation. Top-right Pause opens the Character / Personal tabs and three camera settings. There is no joystick, chat or online icon.

**Camera options:** elevated three-quarter follow (default), closer follow, and wide overview. All three now use a **free-orbit camera**: tap the floor to walk, single-finger or mouse-drag to rotate horizontally and tilt vertically, two-finger pinch (or mouse wheel) to zoom, and **Reset view** in Pause to restore the original angle. Switching presets preserves the current yaw/rotation instead of snapping toward a wall. The wide view uses event-sized framing; perimeter walls are removed as single cutaway sections only when they would obscure the camera, keeping office interiors visible. Camera mode is a local browser preference, independent of Supabase personal data.

**Geometry:** one single-sided wall-facing workstation row and one double-sided benching island, both perpendicular to the finite north window. Each person's chair faces the LONG desk edge. Desk pitch is **2.42 m** with roughly **90 cm** between 1.52 m desk lengths, plus an additional **2.15 m cross-passage after every fourth desk**. The west wall has a **plain dark structural passage** at those breaks: no door leaf, frame, bathroom, modeled side room, or playable interior. Characters remain in the main office. The hall grows southward in proportion to the participant count; the player spawns close to the first desks. A festive tree by spawn previews the Christmas atmosphere. No monument artwork.

**Visuals:** authored procedural cute voxel Indian adults with detailed layered hairstyles, expressive eyes and faces, articulated rigs, salwar-suit embroidery and dupatta, jeans seams, formal suit lapels, modeled bottoms and distinct silhouettes. Original furniture includes monitors, typing stations, mugs, plants, work accessories and windows. The celebration is now a **large, unmistakable staged destination** with a sculpted red-and-gold backdrop, readable SECRET SANTA sign, stepped reveal podium, warm festive rug, ornamented voxel Christmas tree with star, many wrapped gifts, a snowman, festive gift table and string lights. A larger secondary tree sits near spawn. The camera has been reoriented southward so players look toward the celebration, not away from it. Overhead hanging bars and their visibly glitchy hide/show behavior have been **removed entirely**. Wall-mounted accent lights remain; cutaway visibility applies only to architectural wall groups. Distant NPCs use simple stand-ins; office blocks/bulbs are batched into spatially chunked `InstancedMesh` sets to reduce mobile GPU draw calls.

**Mobile viewport stability:** the game pins to the stable `100svh` viewport on touch devices, disables browser scroll and pinch-to-zoom only over the gameplay canvas, preserves scroll in Pause/Character/Personal panels, and uses 16px input fonts to prevent iOS Safari focus zoom. Rotating the phone still recalculates aspect ratio. The organizer console is unaffected.

**Avatar studio:** Pause → Character opens a **prominent, rotatable full-body 3D model** on a gold-trimmed pedestal, with warm studio lights and compact category tabs: Look, Hair, Fashion and Shape. Drag the model to rotate it or use the dedicated rotation arrows. Available wardrobes include contemporary Indian smart-casual clothes, salwar suits (no sarees or kurtas), tailored suits, dresses and holiday sweaters; hairstyles, skin tones, height/build, clothing colors, and spectacles remain available. Changes update both the 3D studio model and the player's game model. `See me in the office` shows the game character up close; Reset restores the last saved model. **Save look** uses the existing signed, player-scoped Supabase `ss-gateway` with validated appearance data and optimistic `avatar_version` concurrency. The public fictional preview does not save; no unrelated database tables are changed.

**Code organization:**

```
assets/game/
  avatar.js        # authored articulated procedural character geometry
  office.js        # scalable workstations, walls, window, decorations and celebration area
  main.js          # rendering, camera, A* navigation, actions and nearby NPC details
  studio.js        # high-detail rotatable character stage, lighting and orbit controls
```

The Three.js module is loaded at a pinned CDN version via an import map. This new game scene requires network access and WebGL; the previous static login/backend screens remain as before. We have checked module syntax, DOM references, a mocked run of scalable office generation, avatar animation-rig calls, and representative navigation routes. **Full browser rendering, visual fidelity relative to the reference image, performance on real mobile phones, and end-to-end GitHub Pages gameplay still require live verification.**

**Next milestone:** real-device visual QA of the new touch camera, wide-office cutaways, stable mobile viewport, celebration, wall passages, avatar studio and action animations; compare mobile Safari and desktop against the user's rich voxel reference, then refine body/head silhouettes, footwear, clothing accessories and office lighting/reflections. These visual enhancements are implemented but **the rendering has not yet been tested in a live browser in this session**, so do not treat the richness target as certified. Once accepted, continue to daily frozen office/hint logic and finale.

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
