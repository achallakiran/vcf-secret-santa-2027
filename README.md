# VCF Voxel Secret Santa

Festive browser-based Secret Santa experience for multiple offices and annual events.

## Current build — Phase 1 organizer foundation

This repository currently contains:
- A responsive black-background Christmas landing page with animated snowfall, voxel-inspired title lettering, clear gift-giving rules, and the four-digit code UI.
- An authenticated organizer console for creating an event, adding/editing employees, assigning workstations, issuing and regenerating four-digit invitation codes, and opening prefilled WhatsApp invitations.
- A transactionally generated one-to-one Secret Santa assignment cycle; each participant gives to exactly one different participant and receives from exactly one.
- Supabase Edge Function source under `supabase/functions/ss-organizer/`.
- The eight existing, isolated Secret Santa database tables, created under the `ss_` prefix in Supabase project `fwrievuhudjkeffmszqf`.

**Not yet implemented:** Participant-code redemption, playable voxel office, customizable avatars in the UI, wishlists and daily tasks UI, personalized hints, or final-stage reveal. The landing page clearly explains that player entry is not enabled. Do not send invitations to participants as if the game were ready to play.

## Deployment

GitHub repository: https://github.com/achallakiran/vcf-secret-santa-2027

To publish with GitHub Pages:
1. Open the repository's **Settings → Pages**.
2. Select **Deploy from a branch**, branch **main**, directory **/(root)** and save.
3. The expected site address is `https://achallakiran.github.io/vcf-secret-santa-2027/`. This URL should not be advertised as live until GitHub Pages has been enabled and verified.
4. Visit `?admin=1` on the published site to reach the organizer console.

Only `index.html`, `assets/app.js`, and `assets/styles.css` are required for this static frontend. An internet connection is required for organizer authentication and Supabase operations.

## Organizer workflow

1. Visit the organizer console; create a Supabase email/password account or sign in. If the shared project's authentication settings require email confirmation, follow the verification email before signing in.
2. Create an event; the server generates a unique event slug for a shareable event URL.
3. Add each participant, optionally with an international WhatsApp number (`+91...`) and desk ID.
4. Upon registration, the new four-digit code is displayed **once** in the organizer's current browser tab. Use WhatsApp or Copy while the code is still visible. After a refresh, use **New code** to rotate it; rotation invalidates the previous code.
5. When the roster is final, generate and lock assignments. The organizer console can see the pairings, while the participant interface (to be built later) must never expose the complete assignment table.

**Security:** The four-digit codes are not stored in plaintext in the database. The Edge Function calculates a keyed HMAC; credential verification and rate-limited redemption are still outstanding. Client-to-table reads are disabled by default, and only the authorized Edge Function operates on the new tables. Do not expose `service_role` secrets in the browser.

## Architecture

- Frontend: plain HTML/CSS/JavaScript, GitHub Pages, no build system.
- Auth: existing Supabase Auth email/password for organizers, without changing other applications' Auth settings.
- Backend: Supabase `ss-organizer` Edge Function with authenticated user checks and organizer ownership checks for every event operation.
- Database: eight `public.ss_*` tables with foreign keys, uniqueness constraints, and RLS enabled.
- Assignment/registration functions: `ss_register_participant`, `ss_rotate_access_code`, `ss_lock_assignments`. These are invoker-security functions executable only by `service_role`.

Existing Supabase tables belonging to other apps were not modified. This project intentionally shares the existing database without changing project-wide authentication configuration.

### Next engineering milestones

- Secure, rate-limited participant code redemption and device session binding, with explicit privacy tests.
- Full profile/wishlist/daily task APIs with role-dependent disclosures.
- Reusable, detailed voxel avatar editor and office scene with wall desks, double-sided workstations, single far-end window and Christmas decorations.
- NPC greeting and tap-to-move gameplay, daily deterministic desk-object scenes, truthful personalized hints.
- Organizer-controlled Christmas stage and Secret Santa reveal.

## Notes

- The branding on the initial landing page says **Secret Santa 2026**, matching the original brief, although this repository is named `vcf-secret-santa-2027`. Event titles are configurable in the organizer console.
- The static frontend includes the Supabase **publishable** key (safe to ship by design), never the secret/service-role key.
- This is an initial organizer foundation, not yet a complete playable game.
