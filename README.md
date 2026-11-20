# VCF Voxel Secret Santa

A multi-event Christmas office Secret Santa experience. Current milestone: **PIN-only admin console and participant personal dashboard**, with the detailed 3D voxel office still in development.

## Access

- Admin console: `https://achallakiran.github.io/vcf-secret-santa-2027/?admin=1`. Enter the temporary administrator PIN chosen for this project. **No Supabase email or password is required.**
- Player: open the **event-specific** invitation URL, `https://achallakiran.github.io/vcf-secret-santa-2027/?event=<event-slug>`, then enter the organizer-provided four-digit invitation code. **No player registration or additional credentials.**
- From the admin console: create an event, add colleagues, record optional WhatsApp numbers and desk IDs, generate and share their codes, and lock randomized one-to-one Secret Santa assignments.
- Players can edit itemized wishlists, receive scheduled daily tasks without learning their Santa's identity, assign tasks to their own Secret Child and mark them complete, record gift status, and write a private finale message.

## Deployment

Enable **Settings → Pages → Deploy from branch → main / (root)** to serve `index.html`. The published Pages URL has not yet been independently confirmed live.

The frontend consists of `index.html`, `assets/app.js`, and `assets/styles.css` with no package build step; Supabase connectivity is required. The visual office is presently a placeholder.

## Backend

Supabase project: `fwrievuhudjkeffmszqf` (the owner's existing project).

- Eight application tables under the `ss_` prefix, plus security-only `ss_auth_guard` for verifier/lockout state.
- Active Edge Function: `supabase/functions/ss-gateway/index.ts` (`verify_jwt=false`, **custom server-side authentication**).
- Old email-based Edge Function: `supabase/functions/ss-organizer/index.ts`, retired (returns HTTP 410).
- Admin PIN verifier: salted PBKDF2; short-lived server-signed admin sessions and rate-limited attempts.
- Player code verifier: server-keyed fingerprint; event-scoped sessions, date-aware tasks, code rotation, and server-filtered player data.
- Public frontend contains only the Supabase **publishable key**, not the service-role key.
- Existing unrelated tables, project-wide Auth settings, and data have not been changed.

**Security note:** A common four-digit admin PIN is a weak temporary credential for a low-stakes prototype. Change it to a longer PIN inside the admin console before sharing widely. This build currently has **one global administrator role for all Secret Santa events**; per-office organizers will need event-scoped admin permissions before separate offices are onboarded.

## Verification status

Database registration, assignment generation and login-attempt functions were tested in rollback-only transactions. Frontend JavaScript syntax and DOM element references were checked. The Edge Function is deployed. **Live browser login, end-to-end API requests and GitHub Pages availability have not yet been independently tested.**

## Remaining development

- Visual 3D voxel office and detailed character customization.
- NPC movement, tap-to-walk interactions and daily shared office snapshots.
- Truthful personalized daily hints.
- Organizer-controlled final Christmas stage and reveal.
