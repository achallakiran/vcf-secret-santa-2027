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
| **Multi-Team Registration** | 📋 Planned | Allow new teams to self-register and generate unique office rooms |

---

## 5. Recent Log of Fixes & Decisions

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
