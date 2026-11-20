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

## WhatsApp invitations — temporary recipient prompt

- Organizer participant registration asks only for **Name** and optional **Desk**.
- Each row has a **WhatsApp** shortcut that opens a temporary recipient-number dialog. The organizer enters an Indian 10-digit mobile number (automatically prefixed with +91) or a full international number including its country code. The dialog previews the participant's event URL and four-digit invitation code, then opens `wa.me/<number>?text=<encoded invitation>` on demand. WhatsApp pre-fills the recipient and message; **the organizer must tap Send in WhatsApp**—browser links cannot silently send messages. Numbers are never saved to participant records, Supabase or browser storage and are cleared on close.
- Event details show a selectable full URL immediately beside the **Copy URL** icon. Per-row **Copy** and **Open player** buttons and the redundant code-count metric were removed.
- Active participant codes are visible to a signed-in organizer; the server keeps encrypted retrievable copies in addition to the one-way login verifiers.

## Phase 2A — first explorable voxel Christmas office (November 2026)

The participant-code flow now opens a new procedural Three.js 3D office scene instead of the former Christmas tree placeholder. The organizer console, invitation-code login, private wishlists and task API remain unchanged.

**No generated demo participants:** The former `?preview=1` fake player and fictional coworker roster have been removed. Only authenticated event participants enter the office; the organizer manages people in `?admin=1`.

**Player controls:** click/tap a free patch of floor to walk; click/tap a coworker to approach and greet. **One tap of the only action button performs a randomly selected Hi, Dance, Clap or Cheer**, immediately, without any action dropdown, cycling control or long-press gesture. It avoids repeating the immediately previous animation. Top-right Pause opens the Character / Personal tabs and three camera settings. There is no joystick, chat or online icon.

**Camera options:** elevated three-quarter follow (default), closer follow, and wide overview. All three now use a **free-orbit camera**: tap the floor to walk, single-finger or mouse-drag to rotate horizontally and tilt vertically, two-finger pinch (or mouse wheel) to zoom, and **Reset view** in Pause to restore the original angle. Switching presets preserves the current yaw/rotation instead of snapping toward a wall. The wide view uses event-sized framing; perimeter walls are removed as single cutaway sections only when they would obscure the camera, keeping office interiors visible. Camera mode is a local browser preference, independent of Supabase personal data.

**Geometry:** one single-sided wall-facing workstation row and one double-sided benching island, both perpendicular to the finite north window. Each person's chair faces the LONG desk edge. Desk pitch is **2.42 m** with roughly **90 cm** between 1.52 m desk lengths, plus an additional **2.15 m cross-passage after every fourth desk**. The west wall has a **plain dark structural passage** at those breaks: no door leaf, frame, bathroom, modeled side room, or playable interior. Characters remain in the main office. The hall grows southward in proportion to the participant count; the player spawns close to the first desks. A festive tree by spawn previews the Christmas atmosphere. No monument artwork.

**Visuals:** authored procedural cute voxel Indian adults with detailed layered hairstyles, expressive eyes and faces, articulated rigs, salwar-suit embroidery and dupatta, jeans seams, formal suit lapels, modeled bottoms and distinct silhouettes. Original furniture includes monitors, typing stations, mugs, plants, work accessories and windows. The celebration is now a **large, unmistakable staged destination** with a sculpted red-and-gold backdrop, readable SECRET SANTA sign, stepped reveal podium, warm festive rug, ornamented voxel Christmas tree with star, many wrapped gifts, a snowman, festive gift table and string lights. A larger secondary tree sits near spawn. The camera has been reoriented southward so players look toward the celebration, not away from it. Overhead hanging bars and their visibly glitchy hide/show behavior have been **removed entirely**. Wall-mounted accent lights remain; cutaway visibility applies only to architectural wall groups. All coworkers use full sculpted articulated avatars at every distance; static office props still use geometry instancing where appropriate.

**Mobile viewport stability:** the game pins to the stable `100svh` viewport on touch devices, disables browser scroll and pinch-to-zoom only over the gameplay canvas, preserves scroll in Pause/Character/Personal panels, and uses 16px input fonts to prevent iOS Safari focus zoom. Rotating the phone still recalculates aspect ratio. The organizer console is unaffected.

**Avatar atelier (visual creator v3):** Pause → Character now uses the reference-driven cream/rose/plum layout: category icon rail at left, **large draggable live 3D model** in the center, and **real 3D option thumbnails** at right. Gender, hairstyle, outfit, bottoms, spectacles and footwear use clickable image tiles—**no appearance dropdowns**. Height and build retain sliders. Skin, hair and clothing use **unnamed color swatches**, including pure black and pure white. Color indices previously saved remain compatible. Options are rendered using the **same full-quality procedural avatar**, not a reduced preview mesh. Thumbnails are cached and rendered through the existing studio's single WebGL renderer; updates preview live on the in-game character. Save/Reset continue using the signed player-scoped Supabase `ss-gateway` with optimistic avatar version checks. The avatar studio remains accessible after real participant login, where customizations may be saved. The accidental pre-office wizard remains removed.

**Hi and gesture animation:** The right-arm Hi previously used a large negative shoulder-Z rotation that moved the hand across/behind the face. This was replaced by an **outward raised arm, bent elbow and independently rotating wrist** with smooth raise/lower timing. Clap now brings hands inward instead of moving them apart; Dance/Cheer remain rigged. All coworkers use the same full-resolution character model.

**Shared color validation:** The dedicated `ss-gateway` Edge Function (version 6) validates the enlarged color choices and a `footwear` field using the existing server-side avatar ownership/version workflow. No unrelated Supabase tables, authentication settings or other functions were changed.

**Code organization:**

```
assets/game/
  avatar.js          # authored articulated procedural character geometry and shared rig
  avatar-parts.js    # expressive face, layered hair, modeled footwear
  artisan-voxels.js # true high-density voxel face, hair, fabric and shoe detailing
  wardrobe.js        # actual contemporary Indian garment sculptures and detailing
  palette.js         # shared indexed colors including pure black and white
  visual-materials.js# authored procedural garment fabrics and textile patterns
  avatar-editor.js   # visual avatar option cards and unnamed color swatches
  office.js          # scalable workstations, walls, window, decorations and celebration area
  environment-art.js # original screens, workstations, posters and wall details
  art-surfaces.js    # warm tile materials and furnished collaboration nooks
  interior-finishes.js # reusable wood, upholstery, cabinet, carpet and brass surfaces
  main.js            # rendering, camera, A* navigation, actions and nearby NPC details
  studio.js          # high-detail rotatable character stage, lighting and orbit controls
```

The Three.js module is loaded at a pinned CDN version via an import map. This new game scene requires network access and WebGL; the previous static login/backend screens remain as before. We have checked module syntax, DOM references, a mocked run of scalable office generation, avatar animation-rig calls, and representative navigation routes. **Full browser rendering, visual fidelity relative to the reference image, performance on real mobile phones, and end-to-end GitHub Pages gameplay still require live verification.**

### Artisan voxel sculpture v5 — higher-density full-detail characters

The character factory now builds **real extra box voxels**, not merely surface textures or cosmetic labels. The new `assets/game/artisan-voxels.js` creates instanced, individually shaded microvoxels for the expression, layered frontal crown and back of all four hairstyles, front/back clothing embroidery, cuffs, shoulder seams and shoes.

- All player, office coworker and avatar-studio characters use the **same** `createAvatar` factory, now integrating `sculptFaceVoxels`, `sculptHairVoxels`, `sculptGarmentVoxels`, `sculptSleeveVoxels` and `sculptShoeVoxels`.
- The hairstyle changes silhouette and voxel count: short cropped hair, layered shoulder-length locks, longer back curtain, and a braided ponytail are modeled as distinct volumes.
- Outfit-specific details: salwar trim and dupatta stitching, suit tailoring and pinstripes, knit snowflake patterns, dress pleats, shirt cuffs and sneaker/formal/shoe eyelets.
- Each microvoxel is actual 3D geometry, batched into `THREE.InstancedMesh` within its **original articulated parent** (head, torso, arms, legs) to preserve the motion, while reducing draw calls. No distant character impostor, simplified LOD or photo asset is added.
- Scripted mock-construction tests across six full character variants returned **475–803 additional individual 3D detail voxels** per avatar, grouped into **nine instanced batches**, on top of the preexisting 136–215 sculpted mesh components. The increase varies with haircut and clothing.
- The pause-menu styling preview, existing avatar saves, swatch choices, Hi/Clap/Dance/Cheer animations, cameras, controls, office environment and Supabase backend are preserved.
- Game and studio imports now request `voxel-art-v5` through versioned module URLs to avoid stale client caches.

**Verification is technical only:** full character creation and action calls passed scripted geometry tests and JavaScript syntax checks. Browser screenshot quality, iPhone frame rates, and head/hand clipping under live WebGL have **not yet been measured**, especially for events containing many fully sculpted coworkers.

### Environment polish v1 — implemented in the real 3D office

The last concept image was **not** an actual gameplay screenshot or an implemented visual upgrade. This pass changes the live scene source, not concept art:

- New `assets/game/interior-finishes.js`: reusable procedurally drawn wood-grain desk veneer, cream cabinetry, woven chair upholstery, fabric partition panels, warm brass, emissive desk-edge inlays, and patterned celebration carpet. Shared finishes avoid per-workstation texture duplication.
- `assets/game/office.js` now applies those finishes to existing workstations, adds shaped drawer faces and real brass-colored handles, and refines lumbar cushions and armrests on office chairs. The long desk edge still faces each employee; no desk positions or aisles are changed.
- The far Christmas zone now has two upholstered visitor sofas, cushions, a wooden low coffee table with decor, and ribbed timber feature panels with festive wall artwork and brass edging. These are modeled 3D objects, not a background screenshot.
- Additional furniture has explicit collision boxes outside the main aisle, preserving tap-to-walk navigation to the ceremony.
- `main.js` and `app.js` use versioned import URLs `environment-polish-v1` to bypass stale GitHub Pages module caching. Existing character full-quality meshes, camera modes, mobile controls, actions, participant login, and organizer console are unchanged.

**Verification:** JavaScript syntax checks passed; scripted office geometry construction and pathfinding passed for 1, 12, 48 and 150 participants. **Not verified:** screenshots from a real WebGL browser or fidelity to the supplied concept image; no claim that the game currently looks identical to the generated reference.

### Visual atelier v3 — implementation status

Implemented on `main`:
- Reference-style full visual avatar editor (category navigation, central 3D preview, true 3D option thumbnails, selected checkmarks), with no appearance dropdowns.
- Black and white swatches for skin, hair and clothing, alongside existing colors; no named complexion categories.
- Footwear cards and real footwear geometry; existing avatar save pathway supports the new validated field.
- Hi wave corrected to keep the right hand outside the face silhouette; wrist animation is independent.
- Clap arm movement revised to converge inward; wardrobe fabrics now include reusable weave/embroidery patterns.
- Indoor plants and wall garlands refined with layered leaves, ribbon bows and brighter wall lighting. No roof bars added.

Static syntax, data-flow and geometry checks do **not** prove the image-reference standard has been reached. Real browser screenshots, iPhone/desktop GPU tests and recorded animated poses still need to be inspected before claiming the complete art-quality milestone.

### Full-detail visual sculpture v3 — reference-led character and office art

**All visible employees use the same full 3D sculpted articulated avatar as the player.** The unrequested `crowd.js` low-detail/distance-substitute system was removed from the runtime **and deleted from the repository**. There is no NPC quality downgrade, simplified stand-in or automatic model replacement. Every participant retains their own hairstyle, outfit and saved avatar settings. The absence of model LOD means rendering many fully detailed avatars (especially near the 150-person capacity) needs hardware QA; no unverified FPS is promised.

**Substantive visible changes** rather than tiny detail additions:

- `avatar-parts.js`: larger angular toy-like faces, high-contrast square eyes and pupils, catchlights, dimensional cheek geometry, shaped eyebrows, smiles, optional eyewear and adult male facial hair. Short styles, thick shoulder-length layered locks, dramatic long hair and a trailing ponytail have visibly different sides, front and backs.
- `avatar.js`: revised shoulder/torso/head proportions, distinct sleeves, articulated palms/fingers, stronger trouser silhouettes, deeper shoe geometry and the same rigged Hi/Dance/Clap/Cheer actions.
- `wardrobe.js`: rebuilt front **and rear** garment identities with embroidered salwar hems and trailing dupatta, layered dress backs, suit shoulders and seams, and knitwear patterns. These details remain visible from the follow camera rather than only in the character editor.
- `office.js`: fuller volumetric stepped Christmas trees, warm micro-lights and ornaments, luminous star toppers, light-framed Secret Santa celebration backdrop, and a layered skyline with building-window detail visible through the finite north window.
- Existing `environment-art.js` and `art-surfaces.js` retain polished desks, soft furniture, warm tile finishes, greenery and seasonal office accessories. Approved desk orientation, dark non-playable wall passages, walking routes, existing camera and minimalist HUD remain unchanged.

**Tested:** modules parse; six full-detail outfit configurations instantiate and animate; scripted geometry generation for offices from 1 to 150 participants; navigation to the celebration zone. **Not tested:** production browser screenshots, actual mobile GPU performance, final fidelity to supplied reference images. This is a new source build, not an assertion of reference-equivalent visual quality.

### Art Hero v1 — first implemented character & environment overhaul

This revision is **implemented in `main`**, rather than a future plan. It is the first art milestone, **not a claim that the visual benchmark has already been met**.

- **Original character sculpture:** `avatar-parts.js` creates softer voxel face contours, layered eyes/sclera/iris/catchlights, eyebrows, cheeks, short smiling mouth, sculpted ears, optional earrings, eyewear, hairstyle-specific layered locks, long hair and ponytail, conditional adult facial hair, and modelled sneaker/formal/ethnic shoes. Male and female bodies share the existing articulated rig and animation pivots.
- **Fashion construction:** `wardrobe.js` adds garment geometry for contemporary shirts, T-shirts, suits, salwar suits, dresses and festive knitwear: hems, embroidered trim, shaped dupatta, blazer panels/lapels, collars, cuffs, fabric detail, lanyards, seams and sculpted accessories. All previously saved avatar JSON schema fields remain valid and personal avatar saving remains through the existing Supabase function.
- **Workstation art:** `environment-art.js` creates original Christmas monitor wallpapers with multiple looks, shaped desk stationery, planters, paper stacks, small gifts, framed office posters and wall accent lighting. No monument graphics or unverified external models are used.
- **Furniture silhouettes:** Desk tops, partitions, swivel-chair backs and seating now have cached beveled voxel geometry instead of being entirely hard-edged boxes. Repeated pieces still support office instancing.
- **Character quality:** Every coworker and the player now share the full detailed articulated model; the former lightweight crowd variants were removed. Full-population mobile performance still requires device verification.
- **Preserved behavior:** camera presets, drag-to-orbit, pinch-to-zoom, tap-to-walk, HUD, blackbox passages, organizer console, invitation login, private data and existing stage remain unchanged.

**Verified in this turn:** syntax of the updated modules and scripted construction/animation of six garment variants; office generation at 1, 12 and 45 participants. Actual fidelity to the supplied screenshots, iPhone Safari performance, live browser rendering and animation appeal remain **unverified** until testing.

**Next milestone:** real-device visual QA of the new touch camera, wide-office cutaways, stable mobile viewport, celebration, wall passages, avatar studio and action animations; compare mobile Safari and desktop against the user's rich voxel reference, then refine body/head silhouettes, footwear, clothing accessories and office lighting/reflections. These visual enhancements are implemented but **the rendering has not yet been tested in a live browser in this session**, so do not treat the richness target as certified. Once accepted, continue to daily frozen office/hint logic and finale.

### Organizer roster and invitation code visibility

The `?admin=1` console automatically opens the most recently created event after successful organizer authentication. The roster shows complete participant names, including on narrow mobile screens with labeled responsive cards rather than clipping names in a wide table.

Invitation codes remain visible as four digits **only to the signed-in organizer** after refresh. The server verifies the organizer token before returning codes. One-way event-specific fingerprints remain the participant-login verifier; separate AES-GCM encrypted envelopes in `ss_access_codes.code_vault` allow authorized repeat display. An organizer-only compatibility path restores old codes without changing those already shared. Codes must remain confidential and are never included in another participant's dashboard.

The `?preview=1` fictional coworker mode has been removed. Without a real event-scoped invitation code, the home screen does not enter the office. The organizer must share the event link containing `?event=...` alongside each player's code.

### Organizer character styling and mobile game stability

- **Edit (✎)** on any employee opens the **same full-detail 3D styling panel** found in Pause → Character: actual rendered hairstyle/outfit options, unnamed color swatches including black/white, spectacles, shoes, height/build sliders, rotate and zoom controls, Reset and Save.
- Organizer can update the employee's Name and Desk in that dialog. Once assignments have been locked, the backend continues to disallow name/desk edits, but avatar styling remains possible.
- The dialog reuses the real player character styling DOM/renderer and preserves admin session context. Closing with ✕ or Escape always returns to the organizer roster; it never opens the playable office.
- New organizer-only server action `admin_save_avatar` verifies the admin session, event, participant and avatar_version before saving. The participant's game profile uses the same saved appearance.
- The admin participant list renders readable full names and compact icon actions, switching to stacked labeled cards on phone/tablet widths without horizontal scrolling.
- The mobile game uses a stable `100svh` canvas size. The Three.js renderer applies the desired pixel ratio **before** allocating the framebuffer, and only resizes when the CSS width/height/DPR actually change, preventing sudden size jumps when interacting with buttons.
- The old **Organizer unlocked** message, contact fields, obsolete explanations and participant-code count have been removed from the admin screen.

**Verification:** source syntax, DOM-control wiring and authorization checks have passed. Full interactive browser rendering and responsive device QA remain outstanding.

### Living Office update — routines, space, social actions and music

This release implements the requested gameplay behavior in actual scene modules:

- **Workstations:** desk surface expanded from 0.73 m × 1.52 m to 0.99 m × 3.36 m (approximately **3× tabletop area**). Workstation row pitch grows from 2.42 m to 4.80 m, leaving about 1.44 m between the end partitions of neighboring desks. Each desk has **left and right end partitions** and a rear privacy partition, second monitor, document tray and lamp. Desk and chair collision volumes match the larger furniture.
- **Real-roster coworker life:** `assets/game/office-life.js` schedules typing, coffee breaks, eating apples, short walks between workstations, and two-person desk conversations. Each NPC remains a full-quality, articulated character from the authenticated event roster. Walking and greeting use the same A* walkable floor as the player, never a straight-line teleport through desks.
- **Interaction distance:** coworker-to-coworker and player-to-coworker approaches choose navigable points about **1.55 m apart**, with a dynamic minimum separation of approximately 0.86–0.91 m while moving. NPC visitors reserve their conversation partner before walking over. Approaching an NPC turns both characters face-to-face and triggers reciprocal **Hi** gestures, an on-scene **Hello!** speech bubble and the existing office toast. A nearby colleague also mimics the player's Hi, Dance, Clap, or Cheer button action.
- **Animated props:** the coffee mug and apple are modeled 3D meshes attached to the avatar wrist, shown only while the coworker performs the associated routine. All routines use the existing skeletal/voxel arms, wrists, head, hips and walking legs.
- **Music:** `assets/game/christmas-music.js` produces a looping, synthesized, public-domain **Jingle Bells** melody directly in Web Audio, with no streamed or copied commercial recording. A speaker icon in the gameplay screen mutes/unmutes and remembers the setting. Browser autoplay restrictions are respected: sound is unlocked on participant interaction rather than playing before consent to interact.
- **Mobile layouts:** the game remains inside its stable `100svh` viewport with responsive canvas and inset controls; the admin console has contained widths, vertically scrolling roster cards and 16px input fields to prevent Safari focus zoom.

**Automated checks:** authored JavaScript parsed successfully. Procedural geometry and A* paths were tested for 1, 12, 48 and 150 participants; desk gaps and stage routes remained passable. In 14-coworker real-floor simulation, voluntary visits led to reciprocal greetings without observed overlap. The synthesized audio loop, mute/unmute, and disposal were tested with a Web Audio test double. **Still required:** visual and frame-rate checks on real iOS/Android/desktop browsers, particularly the long 150-person office and 3D character animation aesthetics.

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
