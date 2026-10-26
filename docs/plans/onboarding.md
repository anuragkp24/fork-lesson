# Onboarding

Status: plan only (Oct 25). Nothing built. Draft for the planner; open questions at the end.
Follows the agreed flow in `.claude/handoffs/2026-10-25-onboarding.md` and the mockup `scratch/onboarding-clickthrough.html` (screens 1–4; its Library screen is step 3, not this step).

**Goal.** A new teacher signs in and, in under a minute, says where she teaches, what each class is (subject + grade) and which classes to share. She lands on lessons that match what she teaches. Nothing is copied to Drive until she has chosen, and she never sees progress bars.

**What exists today.**
- `/login` → Google → `app/auth/callback/route.ts` (saves user + encrypted refresh token) → redirect `/lessons`.
- `AppHeader` (Library, My lessons, lesson page) runs `after(() => syncIfStale(..., "visit"))`.
- `runSync` inserts classes it hasn't seen with `shared=false, share_decided=false`; `publishLibrary` and `fetchCardThumbnails` only touch classes with `shared AND share_decided`. So for a brand-new teacher, a sync before her choices already copies nothing. Existing classes all have `share_decided=true` (0008).
- My lessons shows `SharePrompt` ("Share this class…? Yes / Not now") for undecided classes.

## Screens and routes

All four screens use one narrow centred card (mockup `.stage`, max ~560px), logo top-left, "Step N of 4" top-right, no app nav. Mobile: same card, 16px gutter.

| # | Route | Signed in? | What it shows | Saves |
|---|---|---|---|---|
| 1 | `/login` (rewritten; stays the sign-in page) | no | Headline "Use lessons your colleagues already taught", one line, the "What Fork Lesson does with your Google account" box (3 bullets, mockup copy), **Sign in with Google**. Existing error messages (`?error=`, `?reconnect=`) stay above the button. | – |
| 2 | `/welcome/school` | yes | "Hi <first name>, which school are you at?" One option per school known in her domain (A–Z), then "My school isn't listed…" which opens a text field. **Continue** (disabled until one is picked or a name typed). Small print: "Schools other teachers in your district picked show up here." | `users.school_id` (creates the school row if typed) |
| 3 | `/welcome/classes` | yes | "Your classes" + the mockup intro line. One row per active class: name + section, "N assignments", subject select, grade select (hidden when subject = "Not a subject"), share toggle. Prefilled selects get the soft green style; missing ones show "Pick grade" / "Pick subject" in the yellow style. Button **Share N classes and continue** (or **Continue without sharing** when N = 0). | per class `subject`, `grade`, `shared`, `share_decided=true`; `users.onboarded_at` |
| 4 | `/welcome/done` | yes | Payoff (see below). Button **See them in the Library** → `/library`. Line "Your own lessons are in My lessons." | – |

- Back links: screen 3 has "← Change school"; screen 2 has none (sign-out is in a small "Not you? Sign out" link on screens 2–3).
- `/welcome` alone redirects to the right step (`welcomeStep()` below).
- Add `/welcome` to `PROTECTED_ROUTES` in `proxy.ts`.
- Screen 3 while the first read hasn't produced any classes yet: the list area shows "Finding your classes…" with a small spinner, and the page refreshes itself every 3 s (reuse `app/lessons/auto-refresh.tsx`). Classes appear as soon as `courses` rows exist. This is the only loading text in the flow, and it is about what's on screen, not background work (see open question 2). If the read failed: "We couldn't read your classes from Google. Try again" (button re-runs the read sync). If she has no active classes: "No active classes found where you're a teacher." + **Continue** (straight to screen 4).
- Assignment counts: `lessons` rows of kind `original` per class. While the read is still on later classes, a count can lag for a few seconds; the auto-refresh keeps going until the read sync finishes.

### Who goes where (the gate)

`lib/onboarding/gate.ts`, pure + tested:

```
welcomeStep({ onboardedAt, schoolId }) → "school" | "classes" | "done"
```
- `onboardedAt` set → "done" (onboarding is over; never shown again).
- no school → "school", else → "classes".

Used in three places:
1. **Auth callback**: after the token is saved, redirect to `/welcome/<step>` if not onboarded, else `/lessons` as today. Keep a safe `next` (relative path only, starts with `/`, not `//`) so a deep link to `/lesson/<id>` survives sign-in and onboarding.
2. **Signed-in pages** (Library, My lessons, lesson page): a small server helper `requireOnboarded()` called at the top of each page (before `AppHeader`, so no visit sync starts for a teacher still onboarding) → `redirect("/welcome/<step>?next=…")`. One `users` select per page load; the header already does that query, so the helper returns the profile and `AppHeader` takes it as a prop instead of querying again.
3. **Welcome pages**: an onboarded teacher who opens `/welcome/school` or `/welcome/classes` is sent to `/library`. `/welcome/done` stays viewable (harmless, nice to reload).

Not in `proxy.ts`: the proxy only knows auth, and a DB read on every request (images, API) isn't worth it.

## What runs when

| Moment | What runs | Google writes? |
|---|---|---|
| Screen 1 | Nothing. | no |
| Callback (sign-in done) | `after(() => syncNow(userId, domain, "onboarding", { publish: false }))`: `runSync` only (classes, topics, assignments, forks recognised). No `publishLibrary`, no pictures. | no |
| Screens 2–3 | Nothing new. No `AppHeader` → no visit sync. If screen 3 finds no sync running and no classes, it starts the same read-only sync once (covers a callback whose `after()` died). | no |
| Screen 3 **submit** | Server action saves the choices, sets `onboarded_at`, then `after(() => syncNow(userId, domain, "onboarding"))`: full sync (read again + copies + pictures), which now only touches classes she shared. | yes, create-only copies into her "Fork Lesson library" folder, as today |
| Screen 4 and later | Normal visit syncs from `AppHeader` (2-minute rule). | as today |

Why `publish: false` is still needed even though new classes start undecided: an **existing** demo teacher's classes are already `share_decided=true`, so a normal sync would copy before she has re-confirmed. With `publish: false` the rule is simple and the same for everyone: no copies or pictures before screen 3 is submitted.

The submit's full sync starts immediately even if the first read is still running (it calls `syncNow`, not `syncIfStale`). Overlap is harmless (auto-sync plan: upserts by Google id, copies skipped when `library_file_id` is set). The class rows already exist by then, so the second `runSync` keeps her answers.

Code changes in sync: `syncNow(userId, domain, trigger, { publish = true } = {})`; `SyncTrigger` gains `"onboarding"`; `runSync` also stores `course.subject` / `course.levels` (below).

## Data model — migration `0009_onboarding.sql`

```sql
begin;

-- Schools in a district. Picked on screen 2; any teacher can add one by typing.
create table schools (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create unique index schools_domain_name on schools (domain, lower(trim(name)));
alter table schools enable row level security;
create policy schools_read on schools for select to authenticated using (domain = my_domain());
grant select on schools to authenticated;          -- writes: server routes, secret key

alter table users
  add column school_id uuid references schools on delete set null,
  add column onboarded_at timestamptz;

-- Per class: what Google says (refreshed every sync) and what the teacher chose.
alter table courses
  add column classroom_subject text,                -- Course.subject, raw
  add column classroom_levels text,                 -- Course.levels, raw
  add column subject text check (subject in
    ('math','science','ela','social_studies','world_languages','arts','music',
     'pe_health','computer_science','other','none')),          -- 'none' = Not a subject
  add column grade text check (grade in
    ('K','1','2','3','4','5','6','7','8','9','10','11','12','mixed'));

alter table sync_state drop constraint sync_state_last_trigger_check;
alter table sync_state add constraint sync_state_last_trigger_check
  check (last_trigger in ('manual','visit','nightly','onboarding'));

commit;
```

- **Nobody is marked onboarded** by the migration: every existing teacher sees onboarding once (see "Existing demo teachers").
- **PostgREST embeds.** One new foreign key only: `users.school_id → schools`. There is exactly one path between `users` and `schools`, so `teacher:users!lessons_owner_id_fkey(name, email, school:schools(name))` is unambiguous. Deliberately **no** `schools.created_by → users` (it would make `users ↔ schools` ambiguous). No new links on `lessons`, `courses`, `forks`. Existing hinted embeds are unchanged.
- `courses.subject/grade` are visible to colleagues through the existing `courses_read` policy (shared classes only). Not student data.
- `runSync`'s course upsert adds `classroom_subject: c.subject ?? null, classroom_levels: c.levels ?? null` (`ClassroomCourse` type gains both). It never writes `subject`/`grade`, so the teacher's choice is never overwritten. Upsert only updates the columns it sends.
- **Seed** (for the demo): `supabase/seed/quillmont-schools.sql`, Raj runs it after 0009, with the demo domain filled in:
  ```sql
  insert into schools (domain, name) values
    ('<demo domain>', 'Central Middle School'),
    ('<demo domain>', 'Westview Middle School'),
    ('<demo domain>', 'Quillmont High School')
  on conflict do nothing;
  ```
  (Names from the mockup; Raj to confirm the real Quillmont list, open question 5.)

Labels live in `lib/onboarding/labels.ts` (`math` → "Math", `ela` → "ELA", `K` → "K", `7` → "Grade 7", `mixed` → "Mixed grades", `none` → "Not a subject").

## Prefill: subject and grade

Verified in Google's Classroom API reference (`developers.google.com/workspace/classroom/reference/rest/v1/courses`, read Oct 25): the Course resource has
- `subject`: string, optional, free text ("Subject" in the Classroom create-class dialog).
- `levels`: string, optional, free text, under 1,000 chars; Google's examples: "9th grade", "Middle school", "K-2", "3000".
- No structured grade field. Both are free text, often empty. `courses.list` returns them by default (we don't pass `fields`), and they need no new scope (`classroom.courses.readonly` already covers the Course resource). Raj to confirm with one read on a Quillmont class whether they're set (open question 4).

`lib/onboarding/prefill.ts`, pure + tested:

```
guessSubject(classroomSubject, name, section) → { value: Subject | null, source: "classroom" | "name" | null }
guessGrade(classroomLevels, name, section)   → { value: Grade | null,   source: "classroom" | "name" | null }
```
1. Try the Classroom field first, then `name + " " + section`.
2. **Subject**: keyword table, word-boundary, case-insensitive. Math (math, algebra, geometry, calculus, precalc, statistics, pre-algebra), Science (science, biology, bio, chemistry, chem, physics, earth, life science), ELA (english, ela, language arts, reading, writing, literature), Social studies (history, social studies, civics, government, geography, economics), World languages (spanish, french, german, chinese, mandarin, latin, world language), Arts (art, drawing, ceramics, theatre, drama), Music (music, band, choir, orchestra, chorus), PE/Health (pe, physical education, health, gym), Computer science (computer, coding, cs, programming), **Not a subject** (homeroom, advisory, study hall, office hours, staff, plc, club). No match → null ("Pick subject").
3. **Grade**: "K", "kindergarten", "grade 7", "7th grade", "gr 7", "g7", "year 7" → that grade; a range ("K-2", "6–8") or "mixed"/"multi" → `mixed`; "Middle school" / "High school" / course numbers ("3000") / anything else → null ("Pick grade"). A bare number counts only if 1–12 and it's the whole Classroom `levels` value (a bare "2" in a class name is too often a period or section).
4. **Share default**: on, except subject = `none` → off (Homeroom). Existing teachers: their current `shared` value (below).
5. Highlight: `source = null` → yellow "Pick…"; prefilled → soft green; the teacher changes anything.

Demo expectations (mockup): "Math · Section A" → Math (name), grade from `levels` if set, else "Pick grade". "Geometry · Section C" → Math (name). Homeroom → Not a subject, share off.

**Submit rule.** A shared class needs both subject and grade (the Library and step 3 depend on them): the button stays enabled, but submitting with a missing one scrolls to it and shows "Pick a grade for Math · Section E" (no silent save). An unshared class may stay blank. Saved per class: `subject`, `grade` (null when subject = none), `shared`, `share_decided = true`. All classes on the screen are saved in one action; any class that appears later still gets the My lessons share prompt.

Server action `saveClassesAction(rows)`: validates against the allowed values (same lists as the check constraints), updates only `courses` where `owner_id = user.id` (admin client, like `shareClassAction`), sets `users.onboarded_at = now()`, starts the full sync, redirects to `/welcome/done`.

## Payoff screen (`/welcome/done`)

`lib/onboarding/payoff.ts`, pure + tested:

```
pickPayoff({ candidates, myClasses, mySchoolId }) →
  | { mode: "match", lessons: Lesson[3], total, fromMySchool, label }
  | { mode: "district", lessons: Lesson[1..3] }
  | { mode: "empty" }
```

**Candidates** (one query, signed-in client so RLS applies, same rules as the Library): `kind = original`, not hidden, `owner_id ≠ me`, `hasForkableAttachment` (`lib/library/qualifies.ts`), with `course:courses(subject, grade, name, section)`, `teacher:users!lessons_owner_id_fkey(name, email, school_id, school:schools(name))`, plus `lesson_fork_counts` for the fork count. Limit 300, newest first.

**What she teaches**: her classes with a subject other than `none` and other than null, as (subject, grade) pairs, **shared or not** (an unshared class is still what she teaches).

**Match**: a candidate matches when its class has the same subject and (same grade, or either side is `mixed`). Candidates whose class has no subject/grade yet (teachers who haven't onboarded) never match.

**Order**: her school first, then fork count, then newest. Take 3.

- **≥ 3 matches → "match"**: "You're all set, <first name>" · "<total> <label> lessons are waiting for you" where label is "Grade 7 Math" when she teaches one pair, else "lessons for what you teach" ("<total> lessons for what you teach are waiting for you"). Sub-line "Taught by teachers in your district." plus " <fromMySchool> are from <school>." only when fromMySchool ≥ 1. 3 mini cards (picture via `CardPicture`, title, "<teacher> · <school>", "Forked N times" or "Not forked yet").
- **< 3 matches, Library not empty → "district"** (Raj's fallback, no "you're the first" wording): "You're all set, <first name>" · "Here's what teachers in your district are sharing" · top 3 candidates by fork count, then newest (matches, if any, are not singled out). Button "Go to the Library".
- **No candidates → "empty"**: "You're all set, <first name>" + **Go to the Library**. Nothing else.
- Mini cards link to `/lesson/<id>`; the main button goes to `/library` (step 3 adds "For you" ordering; today's Library is unchanged).
- Short school name on cards: the school name as stored ("Westview Middle School"); trimming to "Westview" is a step-3 nicety.

No background status here or anywhere: copies and pictures run silently after screen 3. A mini card whose lesson has no picture yet uses the existing soft subject cover, as on the Library.

## Existing demo teachers

`onboarded_at` is null for everyone after 0009, so each demo teacher sees onboarding **once**, on the next signed-in page load (the gate), not only on next sign-in:
- Screen 2: pick their school (seeded list).
- Screen 3: every class shows its **current** `shared` value (not the default), with subject/grade prefilled. Classes that are still undecided (`share_decided=false`) show the normal default.
- Submit: saves subject/grade/share, sets `onboarded_at`. If a teacher turns a class **off** that was shared, it disappears from colleagues' Library at once (RLS). Its existing library copies stay in her Drive folder; nothing is deleted, as with the per-lesson hide today.
- Their lessons, forks, shout-outs, saves are untouched.
- The payoff for the first demo teachers will mostly be "district" mode until colleagues have set subject/grade.

## Files (for the build session)

New: `supabase/migrations/0009_onboarding.sql`, `supabase/seed/quillmont-schools.sql`, `app/welcome/layout.tsx` (stage + step header), `app/welcome/page.tsx` (redirect), `app/welcome/school/page.tsx` + `school-form.tsx`, `app/welcome/classes/page.tsx` + `classes-form.tsx` (client: selects, toggles, button label), `app/welcome/done/page.tsx`, `app/welcome/actions.ts` (`saveSchoolAction`, `saveClassesAction`, `retryReadAction`), `lib/onboarding/{gate,prefill,payoff,labels}.ts` + tests, `lib/onboarding/require.ts` (`requireOnboarded`).
Edited: `app/login/page.tsx` (screen 1 copy), `app/auth/callback/route.ts` (read-only sync + redirect), `proxy.ts` (`/welcome`), `lib/sync/{auto,run,schedule}.ts` (`publish` option, `onboarding` trigger, store subject/levels), `lib/google/classroom.ts` (type), `components/app-header.tsx` (take profile as prop), `app/library/page.tsx`, `app/lessons/page.tsx`, `app/lesson/[id]/page.tsx` (call `requireOnboarded`).
Not touched: Library ranking, the share prompt, fork flow.

## Tests (vitest, pure functions)

- `gate`: not onboarded + no school → school; school set → classes; onboarded → done; `safeNext` rejects `//evil`, `https://…`, accepts `/lesson/abc`.
- `prefill`: Classroom field beats name; each subject keyword incl. "Geometry", "AP Bio", "Band"; Homeroom/Advisory → none; grade forms ("7th grade", "Grade 7", "gr7", "K", "Kindergarten") → value; "K-2", "6-8", "Mixed" → mixed; "Middle school", "3000", "Period 2", "Section 2" → null; bare "7" only from `levels`; share default off for none.
- `payoff`: ≥3 matches → match with correct total, fromMySchool, label (one pair vs several); school-first then forks then newest; `mixed` on either side matches; unsubjected candidates never match; my own lessons excluded upstream (assert the caller filter in a small integration-free helper); 2 matches → district with top-forked; 0 candidates → empty; `none` classes don't count as taught.
- `saveClassesAction` validation helper (`parseClassChoices`): rejects unknown subject/grade, requires grade for shared non-none classes, nulls grade for none.
- `syncNow` with `publish: false` never calls `publishLibrary` (mock), and records trigger `onboarding`.
- `npm test`, lint, build clean.

## Click-through check for Raj (localhost, after the build)

Setup: Raj applies 0009 ("Success"), runs the schools seed with the demo domain. Verify by text and counts; no screenshots of Classroom.

1. **Signed out** → `/library` redirects to `/login`: screen 1 copy and the 3-bullet box; sign in as a Quillmont teacher.
2. Lands on `/welcome/school` (not My lessons). The three seeded schools + "My school isn't listed…". Pick one → Continue.
   `select name, school_id is not null, onboarded_at from users;` → this teacher has a school, `onboarded_at` null.
3. **Read-only check** (right after sign-in, before submitting screen 3): `select last_trigger, last_finished_at, courses_count, lessons_count, published_count from sync_state;` → `onboarding`, counts filled, `published_count` unchanged (0 for a new teacher); `select count(*) from attachments a join lessons l on l.id = a.lesson_id where l.owner_id = '<her id>' and a.library_file_id is not null;` → unchanged.
4. `/welcome/classes`: one row per active class with assignment counts matching My lessons; subject/grade prefilled where expected, yellow "Pick grade" where not; Homeroom-type class off. Leave one shared class without a grade → submit → "Pick a grade for …" message, nothing saved. Fix it; toggle one class off; button reads "Share N classes and continue".
5. Submit → `/welcome/done`. `select name, subject, grade, shared, share_decided from courses where owner_id = <her id>;` matches the screen. Within ~1–2 min: library copies appear only for shared classes (`published_count` grows), none for the class turned off.
6. Payoff text: with fewer than 3 matching Library lessons → "Here's what teachers in your district are sharing" + up to 3 cards; with an empty Library → just "You're all set" + button. Button → Library.
7. Open `/welcome/classes` again → redirected to `/library`. Sign out / in → lands on My lessons, no onboarding.
8. **Existing demo teacher** (Teacher A): next page load of Library → `/welcome/school`. On screen 3 each class's toggle matches what it was before. Submit unchanged → Library for Teacher B still shows the same Teacher A lessons (count before/after).
9. **Deep link**: signed out, open `/lesson/<id>` as a not-yet-onboarded teacher → after sign-in and screens 2–3, the payoff button reads "Open the lesson" and goes to that lesson (`next`); without `next` it goes to the Library.
10. New class created in Classroom after onboarding → My lessons still shows "Share this class?" for it.

## Open questions for the planner

1. **Shared class without a grade**: block submit with a message (planned), or allow blank and nag later? Blocking keeps step 3's data complete.
2. **"Finding your classes…" on screen 3**: the mockup shows it, and the class list can't render without it on a slow first read. It's about the screen's content, not background copying, so I kept it. OK?
3. **Subject list**: the 11 values above (incl. Other, Not a subject). Enough for the pilot, or does the district have a fixed list?
4. **Are `course.subject` / `course.levels` set in Quillmont?** Docs confirm both fields exist. One read-only `courses.list` as a demo teacher (Raj runs) tells us whether prefill will come from Classroom or mostly from class names.
5. **Seeded school names**: Central Middle School, Westview Middle School, Quillmont High School (from the mockup). Is that the full demo list?
6. **New classes after onboarding**: the My lessons share prompt asks only "share?". Such a class then has no subject/grade. Add subject + grade selects to that prompt now, or leave it for Settings (later)?
7. **Typed schools**: anyone in the domain can add a school, so duplicates like "Central MS" vs "Central Middle School" will happen. OK for the pilot (an admin merge later), or fuzzy-match ("Did you mean…") now?
8. **Payoff "match" headline when she teaches several subject/grade pairs**: "N lessons for what you teach are waiting for you" (planned), or name the largest pair ("12 Grade 7 Math lessons…")?
9. **Turning off a previously shared class during re-onboarding** hides it from colleagues immediately but leaves forks and library copies alone. Fine, or warn on the toggle ("3 teachers forked from this class")?
