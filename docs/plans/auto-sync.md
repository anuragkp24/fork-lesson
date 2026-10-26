# Auto sync

Status: plan only (Oct 25). Nothing built. Draft for the planner; open questions at the end.

**Problem.** Today a teacher has to click **Sync and publish** on My lessons for anything to happen: new assignments don't reach the Library, new library copies aren't made, card pictures aren't fetched. Nobody will do that. The Library should just stay current.

**What "sync" does now** (`lib/sync/run.ts`, `lib/publish/run.ts`, run together by `syncAction`):
1. `runSync`: reads the teacher's classes, topics and published whole-class assignments from Classroom (read-only), updates Supabase, recognizes forks, removes lessons that are gone.
2. `publishLibrary`: copies each shared lesson's Drive files into the teacher's "Fork Lesson library" folder (**writes to Drive**, create-only) and shares the folder with the domain.
3. `fetchCardThumbnails`: saves a picture per Drive file (read-only on Google), 25 per run. Then, once: for library copies made in this same run that still have no picture, wait ~20 s and retry just those (max 10 files; never fails the sync). Drive takes about a minute to make a picture for a new copy; anything still missing is picked up by the next visit sync.

All of it uses the teacher's own refresh token (encrypted at rest, `lib/google/access-token.ts`), so it can run without the teacher present.

## Two triggers

**A. Sync when the teacher opens the app (the main one).**
- On a signed-in page load (Library, My lessons, a lesson page), if `sync_state.last_finished_at` finished more than **2 minutes** ago (or is null), start a sync in the background. (Was 30 minutes; localhost testing showed a just-posted lesson stayed hidden and new Drive copies kept "Preview coming" until the next sync. Syncs are cheap when nothing changed.) Use Next's `after()` so the page renders first and the sync runs after the response.
- One at a time per teacher: skip if `last_started_at` is within the last 5 minutes and `last_finished_at` is older than it (a sync is running). This is the only locking needed.
- My lessons shows "Syncing…" while it runs, and "Last synced 12 minutes ago" otherwise. The **Sync and publish** button stays, relabelled **Sync now**, for impatient moments and for debugging.
- Failures never block a page. The existing `sync_state.last_error` line shows them.

**B. A nightly sweep for everyone (the backstop).**
- A Vercel Cron job hits `/api/cron/sync` once a day (early morning, district time). It syncs teachers whose `last_finished_at` is older than 24 hours.
- Each call syncs one or a few teachers (the oldest first) and stays well under the function time limit; it re-queues the rest by simply being called again, or by chaining a second call. Hobby plan: crons run at most daily and functions time out near 60 seconds, so this means a small batch per night at first, which is fine for a pilot district.
- Protected with a secret header (`CRON_SECRET`), same-origin checks don't apply.
- Why have it at all: a teacher who hasn't opened the app in a week still has lessons colleagues want to fork.

Not now: Classroom push notifications (Pub/Sub registrations). They'd make updates near-instant but need extra Google Cloud setup and verification. Revisit after the app is verified.

## What can go wrong (and what the app does)

| Case | Behaviour |
|---|---|
| **Refresh token expired.** While the Google OAuth app is in *Testing*, Google expires refresh tokens after 7 days. | Background sync records `last_error = "Google needs you to sign in again."` and stops. My lessons shows the existing "Sign out and sign in again" message. The nightly sweep skips that teacher until they sign in. This goes away only when the app is verified and published. |
| **New class appears.** `courses.shared` defaults to `true` today, so a new class would be published automatically. | Decision needed (open question 1). |
| **Large first sync / slow Drive.** | Thumbnails are capped at 25 per run and copies are done in order, so later runs finish the job. Auto-sync never blocks a page. Show "Syncing… more files are on the way" if work remains. |
| **Two syncs overlap** (two tabs, or cron plus a visit). | The running-check above. A duplicate that slips through is harmless: copies are skipped when `library_file_id` is set, pictures when `thumbnail_path` is set. |
| **Teacher deletes the library folder in Drive.** | Already handled by `folderUsable` (a new folder is created and files are re-copied on the next sync). |
| **Google rate limits (429/5xx).** | Treated as a failed run with a plain message; the next trigger retries. No tight retry loops. |

## Data

- `sync_state` already has `last_started_at`, `last_finished_at`, `last_error`, counts. Add one column: `last_trigger text` (`'manual' | 'visit' | 'nightly'`) so we can see in the data what actually runs. Migration `0008_auto_sync.sql` (renumber if H5 takes 0008; teacher notes would move to 0009).
- No new tables. No student data is read, as before.

## Build steps

1. `lib/sync/schedule.ts` (pure, tested): `needsSync({ lastFinishedAt, lastStartedAt, now, maxAgeMinutes })` → `"run" | "fresh" | "running"`; `pickTeachersForNightly(rows, now, limit)`.
2. `lib/sync/auto.ts`: `syncIfStale(userId, domain, trigger)` = check, then `runSync` + `publishLibrary`. Used by both triggers and by the manual button (`syncAction` becomes a thin caller).
3. Visit trigger: call it from a shared signed-in layout helper using `after()`. My lessons status line ("Syncing…", "Last synced …").
4. `app/api/cron/sync/route.ts` + `vercel.json` cron entry + `CRON_SECRET` env var (Raj adds it in Vercel).
5. Migration 0008 (one column), written, applied by Raj.

**Tests:** `needsSync` (never synced, fresh, stale, running, stuck-running after 5 minutes); `pickTeachersForNightly` (oldest first, limit, skips teachers whose last error needs a sign-in).

**Check (after build).** Setup: Raj applies 0008 and adds `CRON_SECRET`. 1. Sofia adds a new assignment in Classroom and opens Library: a few minutes later, as Henry, the lesson appears with no click. 2. Open My lessons twice within 2 minutes: the second open does not start a sync (check `last_trigger` / `last_started_at`). 3. Call `/api/cron/sync` without the secret: 401; with it: syncs the stalest teacher. 4. A teacher with an expired token: shows the sign-in message, nightly skips them.

## Open questions for the planner

1. **New classes: auto-share or ask?** Product decision says onboarding asks once per class (checked by default). Onboarding isn't built, and `courses.shared` currently defaults to `true`, so with auto-sync a brand-new class would publish its Drive files to the domain with no prompt. Option: add `courses.share_decided boolean default false`; auto-sync skips **publishing** for undecided classes (still reads them) until the teacher answers, and My lessons shows a "Share this class?" prompt. Or accept the default-shared behaviour for the demo.
2. **Freshness window.** ~~30 minutes~~ 2 minutes on visit (changed after localhost test), 24 hours nightly.
3. **Hobby cron limits.** Fine for a few demo teachers; for a real district we'd need Vercel Pro (more frequent crons, longer functions) or a queue.
4. **Who sees "Syncing…"?** Only the teacher, on My lessons; nothing on the Library. Agree?
