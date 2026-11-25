# 🎄 Secret Santa 3D & Office Space — Project Memory & Progress Tracker

> **Persistent Context File**: This document tracks the complete architecture, features, database schemas, active work, and roadmap for the Secret Santa 3D game. Use this file across sessions to seamlessly resume work without context loss.

---

## 1. Executive Summary & Product Vision
The application is an interactive 3D holiday office space and multi-team Secret Santa game designed for office celebrations. It combines:
1. **Real-time 3D Voxel Office Environment** (Three.js): Desks for each participant with interactive nameplates, customizable props (mini-tree, snowglobe, coffee mug, holiday cat), personal photo badges, and wayfinding.
2. **Secret Santa Core Mechanics**:
   - Wishlist creation (up to 3 prioritized wishes under ₹500 budget).
   - Secret Santa assignment: each user is Santa for a "child" and has a secret Santa gifting them.
   - **Task-Driven Mystery Clues**: 3 tasks set by Santa; each task completed by the Child unlocks 1 mystery clue (1 Task = 1 Clue).
   - **Overdue Task Tracking**: Target due dates for each task; friendly reminders and overdue notification banner/toasts sent to the Child if not completed by the due date.
   - Christmas Tree gift unwrap & identity reveal ceremony once all 3 clues are discovered.
3. **Break-Room Arcade Games**: Retro voxel arcade machines running embedded games (`Voxel Racers` and `Voxel Bikes`) playable directly inside the office.
4. **Custom 3D Avatar Atelier & Live Camera Face Matcher**: Generates voxel look-alikes from photos and attaches photo badges to 3D office desks.

---

## 2. Architecture & File Structure

```
├── index.html                   # Single Page Application entrypoint (HUD, Modals, Menus, 3D Canvas)
├── assets/
│   ├── app.js                   # Client controller: Supabase API, UI tabs, modals, webcam, arcade launcher
│   ├── styles.css               # Global glassmorphism, responsive HUD, modals, arcade styles
│   └── game/
│       ├── main.js              # Three.js 3D Office Space runtime (scene, lighting, character, desks, props)
│       └── ...
├── games/
│   ├── voxel-racers/            # Standalone 3D retro racing arcade game
│   └── voxel-bike/              # Standalone 3D retro bike race game
├── supabase/
│   └── ...                      # Postgres DB schemas, migrations, RPC functions
└── PROGRESS.md                  # This persistent ledger & project context
```

---

## 3. Database Schema & Supabase APIs
The app connects to Supabase Postgres with Row-Level Security (RLS) and RPC procedures:

| Table / RPC | Purpose | Key Fields |
|---|---|---|
| `ss_events` | Office event metadata | `id`, `slug`, `title`, `budget`, `timezone` |
| `ss_participants` | Team members & profiles | `id`, `name`, `email`, `role`, `team_id`, `avatar_config`, `desk_id` |
| `ss_assignments` | Santa ↔ Child pairings | `id`, `santa_id`, `child_id`, `santa_message`, `gift_purchased` |
| `ss_participant_private` | Private wishlists | `participant_id`, `wishlist`, `wishlist_version` |
| `ss_santa_tasks` | Tasks given to Child | `id`, `assignment_id`, `task_date`, `task_text`, `status` |
| `ss_unlock_hint` | RPC to reveal next clue | Reveals mystery hints based on task progress |

---

## 4. Feature Matrix & Implementation Status

| Feature | Status | Notes |
|---|---|---|
| **Top-Right Menu Button (`#office-pause`)** | ✅ Completed | Emerald & gold glassmorphic button styled as `☰ Menu` |
| **Unified 4-Tab Player Menu (`#player-menu`)** | ✅ Completed | Santa Hub, Character Atelier, Arcade & Activities, Guide & Rules |
| **Arcade Game Launchers** | ✅ Completed | Direct launch from menu tab for Voxel Racers & Voxel Bikes |
| **Live Selfie & Photo Badge** | ✅ Completed | Instant viewfinder teardown; live badge preview card in Desk Customizer |
| **3D Desk Nameplates & Props** | ✅ Completed | 3D desk nameplate with optional live selfie photo badge and customizable prop |
| **Wayfinding & Fast Travel** | ✅ Completed | Fast-travel to "My Desk", "Christmas Tree", and "Arcade Lounge" |
| **Holiday Lighting & Party Mode** | ✅ Completed | Dynamic ambient toggles (Day, Night, Party disco lights, snowfall) |
| **Task-Driven Clue Unlocks (1:1)** | ✅ Completed | Shifted from 24h timer to task progress: 1 completed task unlocks 1 clue (3 total) |
| **Overdue Task Notifications** | ✅ Completed | Overdue banner in Santa Hub + toast notification for overdue tasks past their due date |
| **Demo Mode Local Persistence** | ✅ Completed | Full `localStorage` persistence for tasks, wishlists, and clues without Supabase auth errors |
| **Multi-Team Self-Registration & Onboarding** | ✅ Completed | 1-step organizer registration, team event creation with custom budget/timezone, Slack/WhatsApp announcement copy, bulk-add teammates, 1-click links |

---

## 5. Recent Log of Fixes & Decisions

### Session (November 25, 2026 - Multi-Team Onboarding):
1. **Seamless Self-Service Team Organizer Onboarding**:
   - *Problem*: Previously, creating an organizer account strictly required a 40–80 char invitation code generated by an existing master admin (`ss_admin_invites`). Other team organizers could not register their teams independently.
   - *Solution*:
     - In `supabase/functions/ss-gateway/index.ts`: Made `invite_code` optional in `registerAdmin`. If provided, it validates and redeems the code; if omitted, it directly inserts into `ss_admin_accounts` using service role credentials. Relaxed PIN requirements to 4–12 digits (matching the login PIN validator).
     - Enhanced `create_event` to accept custom `budget` (e.g. ₹500, ₹1000) and `timezone` (e.g. Asia/Kolkata, America/New_York, Europe/London).
     - Enhanced `event_info` to return event title, slug, budget, and timezone.
2. **1-Step Team Office Launch Form**:
   - In `index.html` & `assets/app.js`: Created a unified "Launch Your Team's Office Space" flow:
     - Organizer Name
     - Team / Event Name (e.g. "Platform Engineering Secret Santa 2026")
     - Admin PIN (4–12 digits) & confirmation
     - Suggested Gift Budget (default ₹500)
     - Timezone selector
     - Optional organization invite code (collapsible)
     - On submission: registers the organizer account AND creates the team event in a single frictionless step, then immediately launches the team workspace.
3. **Resilient Local Storage Fallback (`handleLocalApi`)**:
   - Added full local simulation in `assets/app.js` (`vcf_ss_local_admins`, `vcf_ss_local_events`).
   - If Supabase is unreachable or offline during local evaluation on `http://localhost:8000`, the app seamlessly handles admin registration, event creation, participant bulk-add, and player login completely offline without network errors.
4. **Enhanced Team Share Hub & Announcements**:
   - Added dedicated **💬 Copy Slack Announcement** (Slack markdown formatting, bullets, emojis, budget, and 1-click join link).
   - Added dedicated **📱 Copy WhatsApp Announcement** (WhatsApp bolding `*...*`, festive emojis, and direct link).
   - **⚡ Bulk Add Teammates**: Automatically strips numbering (`1.`, `-`, `•`), trims names, registers participants, generates 4-digit codes, and auto-assigns desks (`Desk 1`, `Desk 2`, ...).
   - **🔗 Copy All 1-Click Login Links**: Generates full list of teammate names with direct auto-login links (`?event=slug&code=1234`) and codes.
5. **Team Landing Experience (`?event=slug`)**:
   - When teammates visit `?event=slug`: A festive glowing banner (`#welcome-team-banner`) displays the Team Event Title and Gift Budget.
   - If opened with direct link `?event=slug&code=1234`, it auto-populates the code and enters the team's 3D office automatically.
6. **Fixed "Invalid Session" Error on Player Login (4-Digit Code & 1-Click Link)**:
   - *Problem*: When logging in with a generated 4-digit code or direct 1-click link (`?event=<slug>&code=<code>`), `loadPlayer()` called `api("player_dashboard")`. Because `session.token` was a local player token (`local-player-token-...`), `api()` attempted to send this local bearer token to the remote Supabase gateway, which rejected it with 401 (`Invalid session.`). Line 113 intercepted this and executed `endSession()`, kicking the player back to the landing page.
   - *Solution*:
     - In `assets/app.js`: Added an immediate fast-path check in `api()` for `session?.token?.startsWith("local-")` to route directly to `handleLocalApi()`.
     - Implemented full `player_dashboard` in `handleLocalApi()` returning `me`, `colleagues`, `myChild`, `receivedTasks`, and `mystery` with 3D desk decoration coordinates and office clues.
     - Implemented all player write actions in `handleLocalApi()`: `save_wishlist`, `save_avatar`, `add_task`, `complete_task`, `gift_status`, `save_message`, `unlock_santa_hint`, `rotate_code`, `delete_participant`, and `edit_participant`.
7. **Fixed Participant/Teammates Table Layout & Button Spillage**:
   - *Problem*: In `assets/styles.css`, fixed percentages (`th:nth-child(1..5)`) totaled 100% across the first 5 columns, allocating 0% width to Column 6 (`WhatsApp`) and Column 7 (`Manage`). Furthermore, `#event-workspace .table-wrap { overflow-x: visible !important; }` caused WhatsApp and action buttons (`✎`, `↻`, `🗑`) to push completely outside the card border and stack vertically into the right margin.
   - *Solution*:
     - In `assets/styles.css`: Replaced the broken 5-column CSS with a balanced 7-column layout (Employee: 22%, Desk: 10%, 1-Click: 12%, Code: 12%, Wishlist: 14%, WhatsApp: 14%, Manage: 16%).
     - Set `.table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }` with `min-width: 720px` on the table to guarantee buttons never spill out of the card.
     - Adjusted the action buttons (`.roster-icon-button`) and WhatsApp invite button (`.roster-whatsapp`) with inline-flex alignment, hover transitions, and neat padding.
     - Updated mobile media query breakpoint to `<= 720px` so desktop and tablet screens render the full, spacious 7-column table.

### Session (November 25, 2026):
1. **Fixed Demo Mode Task Saving Kickout**:
   - *Bug*: User reported "couldnt do and enter a secret code" when saving a task in demo mode.
   - *Root Cause*: The generic `run()` error handler executed `endSession()` when catching unauthenticated API errors. If `loadPlayer()` was called, it also attempted to fetch `player_dashboard` from Supabase without credentials.
   - *Fix*:
     - In `run()`: Guarded session termination with `if (player?.me?.id !== "demo-guest" && ...)`.
     - In `loadPlayer()`: Intercepted demo mode so it renders local state without calling Supabase.
     - In `task-form`: Demo submissions are stored in `player.myChild.tasks` and `localStorage` (`vcf_ss_demo_child_tasks`) and immediately refreshed via `renderPersonalHub()`.
2. **Transitioned Clue System from 24h Cooldown to Task-Driven Unlocking**:
   - *Rule*: Parent assigns 3 tasks with completion dates. Each task completed by the Child unlocks exactly 1 mystery clue (3 tasks = 3 clues).
   - *Implementation*:
     - `getCompletedTasksCount()` tallies completed tasks in `player.receivedTasks`.
     - Clues in `renderHubClues()` show locked cards with `"Complete Task #X to unlock"` until the respective task is completed.
     - When all 3 tasks are finished, all 3 clues are unlocked and the Christmas Tree gift reveal ceremony is ready.
3. **Child Task Completion & Overdue Notifications**:
   - Added `"✓ Mark Completed"` button on received tasks for the Child. Clicking it marks the task complete, persists to storage, triggers celebration toast (`"🎉 Task completed! Clue #X unlocked!"`), and unlocks the corresponding clue.
   - Added `checkOverdueTasks()`: checks pending tasks against today's date (`task_date < today`). If overdue, displays a high-visibility warning banner in `#received-tasks-overdue-banner` and fires a friendly reminder toast on entry.
   - Tasks display color-coded status badges: `⏰ OVERDUE`, `⏳ DUE TODAY`, `📅 UPCOMING`, `✓ COMPLETED`.

---

## 6. Local Development Commands
To start local testing without committing:
```bash
# In the workspace root (/Users/pronow/Downloads/Games/SecretSanta):
python3 -m http.server 8000
```
Open in browser:
```
http://localhost:8000
```
*(Hard-refresh `Cmd+Shift+R` to load the latest scripts).*

---

## 7. Next Priority Focus
1. **User Local Verification**:
   - Test saving a new task for Secret Child in demo mode (verifying no login kickout).
   - Test viewing received tasks with overdue banner and due date badges.
   - Click `"✓ Mark Completed"` on a received task and verify that Clue 1 unlocks immediately in the Santa Hub.
2. **Multi-Team Onboarding Flow**:
   - Allow new team organizers to create isolated holiday offices and invite their teams.
