# Fork lineage: the original lesson is the hub

**Problem.** A fork is a DRAFT courseWork we create in the forker's class. Once the teacher posts it, the next "Sync and publish" lists it as PUBLISHED and treats it as a brand-new lesson of theirs: `syncCourse` upserts a `lessons` row, `publishLibrary` copies its files into their "Fork Lesson library" folder, and `/library` shows a second card under their name. Nothing connects it to the original, even though `forks.google_coursework_id` already holds the id we created.

**Goal.** One Library card per original lesson. Everything about a lesson (who forked it, teacher versions) lives on the original's page. A fork is never published on its own.

Status: plan only. Nothing here is built. Sync, publish and fork are not changed until this is approved.

---

## Decisions (defaults; flagged items need your call)

1. **A fork is a `lessons` row with `kind = 'fork'`.** Reusing the row gives My lessons its class/topic grouping, attachments and chips for free. The marker is a column, not "has a parent", so a fork can never turn into an "original" if the original is later deleted.
2. **Forks never reach the Library or the library folder.** `/library`, `publishLibrary` and the RLS policy all exclude `kind = 'fork'`, three independent guards.
3. **"Differs from the original" is measured against what the teacher forked**, not the original today. At fork time we store a `baseline` on the fork record. If Sofia later edits her lesson, Carlos's fork doesn't suddenly look "changed".
4. **A teacher version is a fork the forker chose to share.** It lives on the original's page, not as its own card. Forking a version records the lineage back to the original (`root_lesson_id`).
5. **Fork pages redirect to the original.** `/lesson/<fork id>` redirects to `/lesson/<original id>` (with `#version-<id>` for a shared version). The hub is the only lesson page.
6. **Flagged:** who can see "Forked by" (name, class, date, Draft/Assigned)? Default: every teacher in the domain who can see the original, as your spec reads. Draft status is therefore visible to the domain. Say so if drafts should be private to the forker and the original's owner.
7. **Flagged:** include a small "Stop sharing" on a shared version? Default yes (sets `version_shared` false, trashes its library copies). Not in your spec; about 20 lines.

---

## 1. Schema: `supabase/migrations/0002_fork_lineage.sql`

```sql
-- lessons: is this row an original, or a teacher's fork of one?
alter table lessons
  add column kind text not null default 'original' check (kind in ('original','fork')),
  add column fork_id uuid unique references forks on delete set null,
  add column forked_from_lesson_id uuid references lessons on delete set null,  -- the ORIGINAL (root)
  add column classroom_state text check (classroom_state in ('DRAFT','PUBLISHED')),
  add column changes text[] not null default '{}',        -- subset of: title, instructions, attachments
  add column change_summary text,                          -- "Instructions edited · 1 file edited"
  add column version_shared boolean not null default false,
  add column version_shared_at timestamptz;
create index on lessons (forked_from_lesson_id);
create index on lessons (kind);

-- forks: keep the record when the original goes away; remember what was forked
alter table forks
  alter column lesson_id drop not null,
  drop constraint forks_lesson_id_fkey,
  add constraint forks_lesson_id_fkey foreign key (lesson_id) references lessons on delete set null,
  add column root_lesson_id uuid references lessons on delete set null,  -- the original, even when forking a version
  add column baseline jsonb,                                              -- what we copied, for the change check
  add column removed_at timestamptz;                                      -- the forker deleted it in Classroom
create index on forks (root_lesson_id);
update forks set root_lesson_id = lesson_id;                              -- existing forks are of originals

-- attachments: library_file_id stays null for forks until a version is shared
-- (no change)
```

**RLS.** Replace `lessons_read` so a fork is invisible to everyone but its owner until shared:

```sql
drop policy lessons_read on lessons;
create policy lessons_read on lessons for select to authenticated using (
  owner_id = auth.uid()
  or (domain = my_domain() and not hidden and (
        (kind = 'original' and exists (select 1 from courses c where c.id = course_id and c.shared))
        or version_shared))
);
```

A shared version does not depend on the forker's class being shared, since sharing is an explicit act. `attachments`, `topics` policies already follow `lessons`.

**Counts and "Forked by" go through two security-definer functions** instead of loosening `forks`/`courses` RLS (forker classes may be unshared). Each first checks the caller can see the original (same predicate as the policy):

- `lesson_fork_counts(ids uuid[])` returns `(lesson_id, forks int, versions int)`. `forks` counts rows with `root_lesson_id = id`, `removed_at is null`, `status in ('done','partial')`. `versions` counts `lessons` with `forked_from_lesson_id = id and version_shared`.
- `lesson_forks(p_lesson uuid)` returns `(fork_id, forker_name, class_name, section, created_at, state)`, where `state` is `coalesce(l.classroom_state, 'DRAFT')` from the fork's lesson row (so a fork is "Draft" until its next sync says otherwise).

---

## 2. Sync recognizes forks (`lib/sync/run.ts`, new `lib/sync/forks.ts`)

For each of the teacher's courses, before mapping lessons:

1. **Load fork records** for this teacher and course: `forks where forker_id = me and target_course_id = <course> and google_coursework_id is not null and removed_at is null`. Also load existing `lessons` in the course with `kind = 'fork'` (covers forks whose record was orphaned). Together: `forkByCourseworkId`.
2. **Partition** the PUBLISHED courseWork list (pure `partitionCourseWork(items, forkIds)`): matches go to the fork path, the rest map to lessons exactly as today.
3. **Fork path, per fork record:**
   - In the PUBLISHED list: state `PUBLISHED` ("Assigned"), content from the list item.
   - Not in the list: `courseWork.get(courseId, id)` (new helper). `DRAFT` gives state `DRAFT`, content from the response. 404 or `DELETED` sets `forks.removed_at`, deletes its lesson row, and drops it from counts.
   - Upsert the `lessons` row on `google_coursework_id` (the existing unique key) with `kind='fork'`, `fork_id`, `forked_from_lesson_id = forks.root_lesson_id`, `classroom_state`, title/description/materials from Classroom. Reuse `syncAttachments` (including the mime lookup, which works on the forker's own copies).
   - Compute `changes` / `change_summary` (section 5) and store them.
4. **Seen set** for pruning includes fork coursework ids, so drafts and forks aren't pruned as "no longer published".
5. **Never overwrite `kind`.** The normal lesson upsert payload doesn't include it, and an id that already exists as `kind = 'fork'` is routed to the fork path (step 1).

`publishLibrary` gets `.eq("kind", "original")` in its lessons query. This is the guard that stops files being copied to the library folder.

## 3. Cleanup of forks already published (e.g. Carlos's Band · Section B copy)

Runs inside the same sync, with the forker's own token, in the fork path:

1. For a fork-lesson row whose attachments have `library_file_id` and which is not `version_shared`: trash each file with the existing `trashFile` (a `PATCH trashed:true`, reversible, never a delete). A 404 counts as already gone.
2. Only after a successful trash: set `library_file_id = null`, `publish_error = null` on that attachment. A failed trash leaves the id so the next sync retries. The row is already invisible (RLS, Library filter), so a failure doesn't re-expose it.
3. Carlos's lesson row is converted in place (same `google_coursework_id`), so no duplicate rows and no data loss. The Library card disappears on the next page load.

This changes Google data (moves files in the forker's library folder to the trash) when Carlos clicks **Sync and publish**. That is the cleanup you asked for; you run the click.

---

## 4. UI

**Library (`/library`).** Query adds `.eq("kind", "original")`. Each card shows "Forked N times" (omitted at 0) from `lesson_fork_counts`, as a small muted line by the chips. Grouping by teacher is unchanged.

**Original lesson page (`/lesson/[id]`), top to bottom:**
1. Header card: title, teacher, class, topic, **"Forked N times · M teacher versions"**, "Fork to my class" (existing dialog).
2. Instructions, Attachments (as now).
3. **Forked by** (`lesson_forks`): forker, class, date, status chip Draft / Assigned. Empty state: "Nobody has forked this yet."
4. **Teacher versions**: shared version rows (`forked_from_lesson_id = this`, `version_shared`). Each shows the forker, `change_summary`, and **Fork this version**, which opens the existing `ForkDialog` with `lessonId` = the version's id. `runFork` already forks any visible lesson; the new fork records `root_lesson_id = version.forked_from_lesson_id ?? version.id`.
5. A reserved slot for "How did it go?": a component that renders nothing yet, so the layout doesn't move later.

If the id in the URL is a fork row, redirect to its original (`hubTarget(lesson)`, pure and tested). A fork whose original was deleted shows "Forked from a lesson that's no longer shared" on My lessons.

**My lessons.** A fork card shows a fork-icon badge **"Forked from <teacher>"** linking to the original's page, a status chip Draft / Assigned, and "Open in Classroom" (`draftLink`). Title links to the original page. If `changes` is non-empty and the version isn't shared: **Share your version**. If shared: "Shared as a teacher version" plus **Stop sharing**. A fork's files show no "In library" pill.

**Share your version (`shareVersionAction`).**
1. Authorize: lesson owned by me, `kind='fork'`, `changes` non-empty (re-read from the database, never from the browser), not already shared.
2. `ensureLibraryFolder` (exported from `publish/run.ts`) then, per Drive attachment, `copyWithFallback` from the forker's copy into the library folder, writing `library_file_id`.
3. If any file fails, trash the ones already copied, leave `version_shared = false`, and show the error. Otherwise set `version_shared = true`, `version_shared_at`.
4. Teachers can then fork the version from the original's page, using its library copies.

---

## 5. Detecting "differs from the original"

**Baseline, captured at fork time** (small change in `runFork`, after the copies): `forks.baseline = { title, instructions (original text, without our re-add note), attachments: [{ kind, key, title, copyFileId?, modifiedTime? }] }`. `modifiedTime` comes from one `files.get(fields=modifiedTime)` per copy.

**Pure `computeChanges(baseline, current)` in `lib/fork/diff.ts`:**
- `title`: trimmed, case-sensitive inequality.
- `instructions`: compare after `stripForkNote` (removes the "Note from Fork Lesson…" suffix we append) and whitespace normalization.
- `attachments`: any Drive copy added or removed, YouTube/link added, removed or changed, or **a copy's current `modifiedTime` differs from the baseline** (the file was edited). Editing the Doc itself is the most common adaptation, so file edits must count.
- `change_summary` is a short sentence such as "Instructions edited · 1 file edited · 1 attachment added".

**Legacy forks** (Samuel's and Carlos's, made before this change) have no baseline. Fallback: baseline = the original's current title, instructions and attachment list. File-edit detection is off for them (no baseline times); title, instructions and list changes still work. Their first "edited file" appears after that file's baseline is set on the next sync (`modifiedTime` is recorded then, as the "first seen" value). Flag this limitation if Carlos's Doc was already edited before the migration.

Changes refresh on each sync; the page says "Updated when you sync".

---

## 6. Files touched

| File | Change |
|---|---|
| `supabase/migrations/0002_fork_lineage.sql` | schema, RLS, two functions |
| `lib/sync/forks.ts` (new) | `partitionCourseWork`, `forkStateFrom`, fork upsert row builder |
| `lib/sync/run.ts` | fork path, seen set, cleanup, never touch `kind` |
| `lib/google/classroom.ts` | `getCourseWork(courseId, id)` |
| `lib/google/drive.ts` | `getModifiedTime(fileId)` |
| `lib/publish/run.ts` | `kind = 'original'` filter; export `ensureLibraryFolder` |
| `lib/publish/share-version.ts` (new) | share and stop sharing |
| `lib/fork/run.ts` | `root_lesson_id`, `baseline` |
| `lib/fork/diff.ts` (new) | `stripForkNote`, `computeChanges`, `summarizeChanges` |
| `app/library/page.tsx` | filter, "Forked N times" |
| `app/lesson/[id]/page.tsx` | hub sections, redirect for fork ids |
| `app/lessons/page.tsx`, `actions.ts` | badge, status, Share / Stop sharing |
| `components/fork-badge.tsx` (new) | fork icon + "Forked from" |

## 7. Tests (Vitest, pure functions)

- `partitionCourseWork`: forks split out; non-forks untouched; an id present as `kind='fork'` still routes to forks.
- `forkStateFrom`: PUBLISHED to Assigned, DRAFT to Draft, 404 to removed.
- `stripForkNote` and `computeChanges`: identical gives none; title only; instructions only (with and without our note); attachment added, removed, renamed; file `modifiedTime` changed; legacy baseline (no times); original edited later does not flag the fork.
- `summarizeChanges`: wording and ordering.
- `hubTarget`: original stays; fork redirects to its root; fork with no root has no redirect and shows the "no longer shared" state.
- `canShareVersion`: only owner, only kind fork, only with changes, not already shared.
- Library/fork-count helpers: `Forked 1 time` / `Forked 3 times` / hidden at 0.
- `publishLibrary` query filter and RLS can't be unit tested. They are covered by the manual checks below, plus three SQL checks to paste into the Supabase SQL editor after the migration (a fork row is invisible to another teacher, visible after `version_shared`, and `lesson_fork_counts` returns the same number the page shows).

## 8. Build order (each step safe to demo on its own)

1. **Stop the bleeding:** migration, sync recognition, publish filter, Library filter, cleanup. Fixes the Carlos duplicate.
2. **Hub:** My lessons badge and status, original page "Forked by", counts, redirects.
3. **Teacher versions:** baseline in `runFork`, diff, Share / Stop sharing, "Fork this version".

---

## 9. What you click to verify

Setup: run `0002_fork_lineage.sql` in the Supabase SQL editor (nothing else changes until the app code lands). Use separate Incognito windows for Carlos and Sofia.

**After step 1 (the fix)**
1. **Before:** as Sofia, `/library` shows two "Parallel vs Perpendicular Line" cards, hers and Carlos Ibarra's.
2. As **Carlos**, open My lessons and click **Sync and publish**.
3. In Carlos's Drive, **Fork Lesson library**: the copy of that lesson's files is in the Trash.
4. As **Sofia**, reload `/library`: one card, Sofia's. Carlos has no group.
5. Click **Sync and publish** again as Carlos. Nothing changes (no duplicates, nothing re-copied).

**After step 2**
6. As **Carlos**, My lessons: the lesson shows the fork badge "Forked from Sofia Marchetti" (click it: you land on Sofia's lesson page) and status **Assigned**.
7. As **Sofia**, Library: her card says **Forked 1 time**. Open it: **Forked by** lists Carlos Ibarra · Band · Section B · date · Assigned.
8. As **Samuel**, fork the lesson into a class but don't post it, then sync as Samuel: his row shows **Draft**. Sofia's page now says Forked 2 times and lists him as Draft. Post his draft in Classroom, sync again: it flips to Assigned.
9. As Carlos, delete his own draft or posted copy in Classroom and sync: it disappears from My lessons and from Forked by, and the count drops.

**After step 3**
10. As **Carlos**, edit the lesson's instructions (or open the copied Doc and change a line) in Classroom, then sync. His card shows **Share your version**. Samuel's unedited fork shows none.
11. Click **Share your version**. The card says "Shared as a teacher version". Carlos's library folder now holds copies of its files.
12. As **Sofia**, the original page: **Teacher versions** lists Carlos with a summary such as "Instructions edited", and **Fork this version**. Library still shows one card; the count line reads "Forked 2 times · 1 teacher version".
13. As **Samuel**, click **Fork this version**, pick a class, create the draft. It has Carlos's wording and files. Sofia's page lists Samuel's second fork under Forked by.
14. As Carlos, **Stop sharing**: the version leaves Teacher versions and its library copies go to the Trash.

---

## 10. Risks

1. **Drafts via the API.** Reading a DRAFT with `courseWork.get` should work (our project made it), but Classroom restricts drafts created by other projects. If a draft read 403s, show it as "Draft (status unavailable)" rather than failing the sync. Check this first in step 1.
2. **Cleanup changes Google data on a sync click.** Trashing is reversible (Trash for 30 days) and limited to library copies the forker's own app made. A wrong match is the risk, so it only touches attachments of rows we can tie to a fork record.
3. **RLS is the sharp edge.** The policy and the two functions are untested against a real database until you run them. Mitigation: the SQL checks in section 7 and the Library/publish filters as separate guards. Do not demo before step 1's checks pass.
4. **Legacy forks have no baseline.** File edits made before the migration aren't detectable (section 5).
5. **Status is only as fresh as the last sync.** A posted fork reads "Draft" until its forker syncs. The page says so. A follow-up could sync on page load; not in scope.
6. **Re-forking** the same lesson twice counts twice in "Forked N times" (it counts forks, not teachers). Easy to change to distinct teachers if you prefer.
7. **The original is deleted or unpublished.** Its fork records survive (`on delete set null`), forks keep `kind='fork'`, and My lessons says "Forked from a lesson that's no longer shared". Teacher versions of it disappear from view with it.
8. **A teacher reuses a forked post manually** in Classroom ("Reuse post"). It becomes an ordinary lesson of theirs. Out of scope; we only follow our own fork records.
9. **Migration is not reversible by a single statement** (it drops the forks FK and not-null). Back up with a Supabase snapshot before running it if the project has real data beyond the Quillmont demo.
10. **Per-sync cost.** One `courseWork.get` per draft fork and one Drive metadata call per fork file. Fine at demo scale; worth batching only if a teacher has dozens of forks.

## 11. Open questions for you

1. Domain-wide visibility of "Forked by" and Draft status (decision 6)?
2. Include "Stop sharing" (decision 7)?
3. Count forks or distinct forking teachers in "Forked N times"?
4. OK to build in the three steps above, starting with the fix, since a demo is coming?
