# Lesson hub: who sees what, shout-outs, teacher notes, versions

Replaces section 8 step 3 ("Teacher versions") of `fork-lineage.md`. Steps 1 and 2 of that plan are built and committed (4d93b5a, 2021d93).

Status: H1 and H2 built (local, not pushed; 0004 applied Oct 25). H3 to H6 are plan only.

**Principle.** Things that happen automatically are private. Things a teacher deliberately writes can be public. No student data, ever.

| What | Who sees it |
|---|---|
| "Forked N times" | Every teacher who can see the lesson |
| "Taught in N classes" | The original author only |
| Forked by: name, class, date, shout-out | The original author only |
| A fork's Draft / Assigned status | That forker only, on their own row |
| Shout-out tags, per forker, plus note | The original author only |
| "What teachers like" tag counts | Everyone, anonymous |
| Teacher notes (name, school, label, text) | Everyone in the domain who can see the lesson |
| A shared teacher version (name, school, what changed) | Everyone, because sharing it is deliberate |

Roles in the checks below:
- **Sofia**: the author of "Parallel vs Perpendicular Line" (lesson P) and "Ratio tables practice" (lesson R).
- **Carlos**: has already forked P (Band · Section B, Assigned).
- **Henry**: has also forked P (during the Step 2 checks), and has not forked R.
- H2 to H4 are checked on **R**. H1, H5 and H6 use P.

Decisions (answers to the open questions, Oct 25):
1. **School:** asked once at onboarding, choosing from schools already seen in the domain or **Other** (free text). Editable from the account menu. For the demo, the Quillmont teachers' schools are set by SQL (H5).
2. **Taught in N classes:** distinct classes.
3. **Shout-outs:** one per fork, final once sent.
4. **Lesson authors deleting notes:** delete (the default; not changed).

Every step ends with `npm test` and `npm run lint` passing, a local preview, and your OK before anything is pushed.

---

## H1. Polish (no migration)

1. **Sticky header.** `components/app-header.tsx`: `sticky top-0 z-30` on `<header>`. The account menu (`z-10`, inside the header) and the fork `<dialog>` (top layer) are unaffected.
2. **"You" tag spacing.** New `components/you-tag.tsx` (the yellow pill). Every use (lesson header, Forked by, Library card) sits in a `flex items-center gap-2` row, so the space never depends on a margin inside inline text. The Forked by row currently uses `ml-2` inside a bold span, which is where it reads cramped.
3. **Drive files open in preview.** New pure `drivePreviewUrl(fileId, mimeType)` in `lib/library/links.ts`:
   - Google Doc: `docs.google.com/document/d/<id>/preview`
   - Sheet: `docs.google.com/spreadsheets/d/<id>/preview`
   - Slides: `docs.google.com/presentation/d/<id>/preview`
   - Anything else (PDF, image, Drawing…): `drive.google.com/file/d/<id>/view`

   The lesson page uses it for every viewer. My lessons keeps `driveOpenUrl`, since those are the teacher's own files and she may want to edit them.
4. **Safari check (later, not built).** Oct 25: H1 verified in Chrome, but in Safari it doesn't work for Henry, even after a hard reload. Find out which part fails there (sticky header, Drive preview links, or "You" spacing; likely the Drive previews, which depend on Safari's third-party cookie blocking) and fix it in a later polish pass.

**Tests.** `drivePreviewUrl` for each mime type, an unknown type, and an id that needs encoding.

**Check (any teacher, e.g. Henry).**
1. Open Library, scroll down: the header stays at the top.
2. Open lesson P, click a Google Doc attachment: it opens read-only, with no "Request edit access" button. Same for a Slides file and a PDF.
3. As Sofia, lesson P: one space between "Sofia Marchetti" and **You**. Same on her Library card.

---

## H2. Visibility, enforced in the database

**Migration `0004_hub_visibility.sql`** (replaces the two functions from 0003; same names, so the pages keep calling them):

- `lesson_fork_counts(ids uuid[])` returns `(lesson_id, forks, versions, taught)`. `forks` and `versions` as now, for anyone who can see the lesson. `taught` is the number of distinct classes with a posted fork (`classroom_state = 'PUBLISHED'`) and is **null unless the caller owns the lesson**.
- `lesson_forks(p_lesson uuid)` returns `(fork_id, forker_id, forker_name, class_name, section, created_at, state, via_version_of)` with three branches:
  - **Caller owns the original:** every fork with `root_lesson_id = p_lesson`. `state` is always null (the author never sees Draft or Assigned). `via_version_of` names the version author when the fork was of a shared version.
  - **Caller is a forker:** only their own rows, with `state` = `DRAFT` / `ASSIGNED`.
  - **Anyone else:** no rows.
- Both keep the existing "can the caller see this original" check, `security definer`, `set search_path = public`, execute granted to `authenticated` only.
- `forks_read` RLS is unchanged (forker or lesson owner), so nobody else can read the table directly either.

**App.**
- Lesson page header shows "Forked N times" from `lesson_fork_counts`, **not** `forkedBy.length` (which is now 0 for most viewers). The author also sees "· Taught in N classes" (hidden at 0).
- **Forked by** section: the author sees the full list without status chips. A forker sees a **Your fork** section with their own row and its status. Everyone else sees no section.
- Pure helpers in `lib/library/forks.ts`: `taughtLabel(n)` ("Taught in 1 class" / "Taught in 3 classes" / null at 0) and `hubSection({ isOwner, forkCount })` choosing which section renders.

**Tests.** `taughtLabel`; `hubSection` for author, forker, bystander, and a forker with two forks of the same lesson.

**SQL checks** (paste into the Supabase SQL editor; replace the ids). This proves the rule holds even if the page were wrong:
```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<henry user id>"}';
select * from lesson_forks('<lesson R id>');              -- expect 0 rows
select taught from lesson_fork_counts(array['<lesson R id>']::uuid[]);  -- expect null
rollback;
```
Repeat with Carlos (1 row, his own, state ASSIGNED) and Sofia (all rows, state null, `taught` = 1).

**Check** (on lesson R). Setup, you click: as **Carlos**, fork R into Band · Section B, post it in Classroom, then **Sync and publish**.
1. **Sofia**, lesson R: header reads "Forked 1 time · Taught in 1 class". Forked by lists Carlos Ibarra · Band · Section B · date, with no Assigned chip.
2. **Carlos**, lesson R: header reads "Forked 1 time" (no "Taught in"). A **Your fork** section shows his row with **Assigned**. No other names.
3. **Henry**, lesson R: header reads "Forked 1 time". No Forked by section, no names anywhere on the page.
4. **Henry**, Library: R's card says "Forked 1 time".
5. **Sofia**, lesson P: Forked by lists Carlos and Henry, no status chips. **Henry**, lesson P: **Your fork** shows only his own row.

---

## H3. Shout-outs at fork time

**Migration `0005_shoutouts.sql`.**
```sql
create table fork_shoutouts (
  fork_id uuid primary key references forks on delete cascade,
  tags text[] not null default '{}' check (tags <@ array['saved_time','ready_to_use','great_materials',
                                                       'clear_instructions','students_love','easy_to_adapt']),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (cardinality(tags) > 0 or note is not null)
);
alter table fork_shoutouts enable row level security;   -- no policies: reads go through functions
```
`lesson_forks` gains `shoutout_tags text[]` and `shoutout_note text`, filled only in the author branch (and in the forker's own branch, so Carlos can see what he sent).

**Write path.** New server action `sendShoutout({ forkId, tags, note })` in `app/lesson/[id]/actions.ts`:
1. Re-read the fork with the admin client: `forker_id = me`, status `done` or `partial`, no shout-out yet. Anything else is refused.
2. Validate tags against the list, trim the note, drop it if empty, cap at 300 characters.
3. Insert. One shout-out per fork, not editable in this step.

**Dialog.** The shout-out comes **after** the draft is created, on the success screen, so it can never block or fail a fork:
- "Draft created in Band · Section B" (as now), then **Say thanks to Sofia?** (optional)
- Six tag buttons (toggle, `aria-pressed`): Saved me time · Ready to use · Great materials · Clear instructions · Students will love it · Easy to adapt
- "Add a note to Sofia (only she sees it)", 300 characters, with the hint "Don't include student names."
- **Send** (disabled until a tag or note is chosen) and **Skip**. Both close to "Open in Classroom" / "Close". After Send: "Thanks sent."

The labels live in `lib/hub/tags.ts` (`SHOUTOUT_TAGS`: key, label), shared by dialog, Forked by, and H4.

**Forked by (author view).** Under each forker's row: their tags as small chips, and their note in a quote style. Nothing when they skipped.

**Tests.** `parseShoutout` (pure: rejects unknown tags, empty input, notes over 300 characters; trims; dedupes tags); tag label lookup.

**SQL check.** As Henry, `select * from fork_shoutouts` returns 0 rows (RLS, no policy). As Henry, `insert into fork_shoutouts …` for Carlos's fork is refused.

**Check** (on lesson R).
1. **Henry** forks lesson R into one of his classes. The success screen asks **Say thanks to Sofia?** Pick "Saved me time" and "Clear instructions", type "Using this Monday", click **Send**: "Thanks sent."
2. **Sofia**, lesson R: Forked by now lists Henry with those two chips and the note. Header: "Forked 2 times" ("Taught in" unchanged until Henry posts and syncs).
3. **Carlos**, lesson R: still only his own row. No sign of Henry's name, tags or note.
4. Fork again as Henry (another class) and click **Skip**: Sofia's list shows that row with no chips.

---

## H4. "What teachers like"

**Migration `0006_tag_counts.sql`.** `lesson_tag_counts(p_lesson uuid)` returns `(tag, n)`: counts across shout-outs on forks whose `lesson_id = p_lesson` (forks of the lesson itself; shout-outs on a version go to that version, H6). Same visibility check as the other functions. No names, no notes, no fork ids.

**App.** A **What teachers like** card under the header: chips like "Saved me time · 2", sorted by count then by the fixed tag order. Hidden when there are none. Shown to everyone, author included.

**Tests.** `sortTagCounts` (order, ties, unknown tag ignored); empty list renders nothing.

**Check** (on lesson R).
1. **Henry**, lesson R: **What teachers like** shows "Saved me time 1 · Clear instructions 1". No names.
2. **Carlos** sees the same card. **Sofia** sees it too, above her Forked by list.
3. Lesson P (forked, nobody thanked): no card at all.

---

## H5. Teacher notes

**Migration `0007_teacher_notes.sql`.**
```sql
alter table users add column school text check (char_length(school) between 1 and 80);  -- shown with notes

create table lesson_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons on delete cascade,      -- always an original
  author_id uuid not null references users on delete cascade,
  parent_id uuid references lesson_notes on delete cascade,          -- null = top-level note
  label text check (label in ('tip','struggled','changed')),         -- top-level only
  body text check (char_length(body) between 1 and 1000),            -- null once deleted
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index on lesson_notes (lesson_id, created_at);
alter table lesson_notes enable row level security;
create policy lesson_notes_read on lesson_notes for select to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id));   -- lessons policy applies
-- no insert/update/delete policies: writes go through the functions below
```
Three `security definer` functions, each checking `auth.uid()` itself:
- `add_note(p_lesson, p_parent, p_label, p_body)`: the caller can see the lesson; it is `kind = 'original'`; a reply's parent is a top-level note on the same lesson (one level only) and replies carry no label; body 1 to 1000 characters after trimming.
- `edit_note(p_note, p_label, p_body)`: author only, not deleted. Sets `edited_at`.
- `delete_note(p_note)`: the note's author, **or the owner of the lesson**. Sets `body = null, label = null, deleted_at = now()`. The text is cleared in the database, not only hidden, in case it named a student. A deleted top-level note with replies shows "Note deleted" with its replies; without replies it disappears.

**School, asked once at onboarding.**
- New page `app/welcome/page.tsx`. The auth callback sends a teacher whose `users.school` is null there instead of `/lessons`; `proxy.ts` does the same for any page while it is null, so it is asked exactly once.
- "Which school do you teach at?" A list of schools already set by teachers in the same domain (distinct `users.school`, read under the existing `users_read` policy, sorted), plus **Other** with a text field. **Continue** saves and goes to `/lessons`.
- Server action `setSchool(school)`: trims, 1 to 80 characters, writes only the caller's own row with the admin client (there is no update policy on `users`). Pure `parseSchool` and `schoolOptions(rows)` (dedupe ignoring case and spaces, sort) in `lib/hub/school.ts`.
- The account menu shows the school with a **Change** link back to `/welcome`.

**Demo SQL** (run once after 0007, in the Supabase SQL editor). Sofia and Samuel's schools come from the slice 1 plan; fill in Carlos's and Henry's:
```sql
begin;
update users set school = 'Central Middle' where email = 'sofia.marchetti@gedu.demo.edstitch.com';
update users set school = 'Westview High'  where email = 'samuel.adeyemi@gedu.demo.edstitch.com';
update users set school = '<Carlos school>' where name = 'Carlos Ibarra';
update users set school = '<Henry school>'  where name like 'Henry %';
select name, email, school from users where domain = 'gedu.demo.edstitch.com' order by name;  -- every row has a school
commit;
```
To see the onboarding screen itself, set one teacher's school back to null and sign in as them.

**App.**
- **Teacher notes** section at the bottom of the lesson page (where the "How did it go?" placeholder is now). Newest top-level note first, replies oldest first under it.
- Each note: initials, **name · school** (school omitted when unset), label chip (Tip / Students struggled / I changed this), relative date, "edited" marker, text. Actions: **Reply** (top-level only), **Edit** and **Delete** on your own, **Delete** on any note when you are the author of the lesson. Delete asks to confirm.
- Composer: optional label (three toggle chips), textarea with a counter, and the fixed reminder **"Don't include student names."** Post button disabled when empty.
- Server actions in `app/lesson/[id]/actions.ts` call the functions with the signed-in user's client, then `revalidatePath`.
- Pure `threadNotes(rows)` in `lib/hub/notes.ts`: groups replies, drops deleted notes with no replies, sorts; `canEditNote`, `canDeleteNote`.

**Tests.** `threadNotes` (ordering, deleted with and without replies, orphaned reply), `canEditNote`, `canDeleteNote` (author, lesson owner, bystander, deleted note), `parseNote` (trim, length, label only on top-level), `parseSchool`, `schoolOptions`.

**SQL checks.** As Henry: `add_note` with a parent that is itself a reply fails; `edit_note` on Carlos's note fails; `delete_note` on Carlos's note fails. As Sofia: `delete_note` on Carlos's note on her lesson succeeds, and the row's `body` is null. As Henry: `insert into lesson_notes` directly fails.

**Check.**
0. Set **Samuel**'s school to null by SQL and sign in as him: the welcome screen lists Central Middle, Westview High and the other Quillmont schools, plus Other. Pick Westview High, **Continue**: lands on My lessons. Sign out and in again: no welcome screen.
1. **Henry**, lesson P: Teacher notes is empty, with the composer and "Don't include student names." He picks **Tip**, posts "Do the warm-up on graph paper." It shows "Henry … · <school> · Tip".
2. **Carlos** sees Henry's note. He clicks **Reply**: "Agreed, saves 10 minutes." The reply sits under Henry's note, with no Reply button of its own.
3. **Carlos** posts a top-level **Students struggled** note, then **Edit**s it: it shows "edited". He has no Edit or Delete on Henry's note.
4. **Sofia** sees both notes and the reply, and has **Delete** on all of them. She deletes Carlos's reply: it's gone for everyone. She deletes Henry's note: "Note deleted" would show only if it still had replies; here it disappears.
5. **Henry** deletes his own note (repost one first): gone.

---

## H6. Teacher versions ("Share your version")

The old Step 3, adjusted to the principle: sharing is a deliberate act, so a shared version is public; what happens to it afterwards (who forked it, their status) stays private to its author.

**Migration `0008_teacher_versions.sql`.**
- `lesson_versions(p_lesson uuid)` returns `(lesson_id, author_name, author_school, change_summary, shared_at, forks)`: shared versions of the original (`forked_from_lesson_id = p_lesson and version_shared`). `forks` is a count only.
- `lesson_forks` and `lesson_tag_counts` also accept a version id: the version's author gets the author branch for forks of their version (`lesson_id = version id`), with shout-outs; the original author keeps seeing every fork under the root, marked "via Carlos's version".
- No change to `lessons_read` (0002 already shows `version_shared` rows to the domain).

**Fork side (from the old plan, unchanged).**
- `runFork` stores `forks.baseline` (title, instructions without our re-add note, attachments with each copy's `modifiedTime`).
- `lib/fork/diff.ts`: `stripForkNote`, `computeChanges`, `summarizeChanges`. Sync stores `changes` / `change_summary` on the fork's lesson row.
- Legacy forks (Carlos's) fall back to the original's current content as the baseline, so file edits made before this step aren't detected (title, instructions and attachment-list changes are).

**Share and stop sharing (`lib/publish/share-version.ts`).**
- `shareVersionAction`: lesson is mine, `kind = 'fork'`, `changes` non-empty (re-read from the database), not shared. Copy each Drive file into my library folder; on any failure trash what was copied and leave it unshared. Then `version_shared = true`.
- `stopSharingAction`: `version_shared = false`, trash its library copies. Forks already made from it keep their own copies.
- Before sharing, the button opens a short confirm: "Teachers in <domain> will see your name, school and what you changed. Your class and students are never shown."

**Lesson page.** **Teacher versions** section (hidden when none): each row shows author name · school, the change summary, "Forked N times", and **Fork this version** (the existing dialog with the version's id; the success screen offers a shout-out to the version author). For the version's author, the row expands to their own Forked by list and tag counts.

**My lessons.** A fork with changes shows **Share your version**; a shared one shows "Shared as a teacher version" and **Stop sharing**.

**Tests.** From the old plan: `stripForkNote`, `computeChanges` (identical, title, instructions with and without our note, attachment added / removed / renamed, file `modifiedTime` changed, legacy baseline, original edited later), `summarizeChanges`, `canShareVersion`. New: version-author branch of `hubSection`.

**Check.**
1. **Carlos** edits the instructions of his fork in Classroom, then clicks **Sync and publish**. His card shows **Share your version**. Henry's unedited fork shows nothing.
2. **Carlos** clicks it, reads the confirm, shares. His card says "Shared as a teacher version"; his Fork Lesson library folder has copies of its files.
3. **Henry**, lesson P: **Teacher versions** lists Carlos · <school> · "Instructions edited" · **Fork this version**. No class name, no status.
4. **Henry** forks the version and sends "Easy to adapt" to Carlos.
5. **Carlos**, lesson P: his version row shows Henry in its Forked by with that chip; the version's tag count shows "Easy to adapt 1". P's own **What teachers like** is unchanged.
6. **Sofia**, lesson P: Forked by lists Henry's new fork "via Carlos's version", no status. Library still shows one card for P.
7. **Carlos** clicks **Stop sharing**: the version leaves Teacher versions for everyone; the library copies are in his Trash; Henry's fork is unaffected.

---

## Files touched

| Step | Files |
|---|---|
| H1 | `components/app-header.tsx`, `components/you-tag.tsx` (new), `lib/library/links.ts`, `app/lesson/[id]/page.tsx`, `app/library/page.tsx` |
| H2 | `supabase/migrations/0004_hub_visibility.sql`, `lib/library/forks.ts`, `app/lesson/[id]/page.tsx`, `app/library/page.tsx` |
| H3 | `0005_shoutouts.sql`, `lib/hub/tags.ts` (new), `lib/hub/shoutout.ts` (new), `app/lesson/[id]/actions.ts` (new), `fork-dialog.tsx`, `page.tsx` |
| H4 | `0006_tag_counts.sql`, `lib/hub/tags.ts`, `page.tsx` |
| H5 | `0007_teacher_notes.sql`, `lib/hub/notes.ts` (new), `lib/hub/school.ts` (new), `app/welcome/` (new), `app/auth/callback/route.ts`, `proxy.ts`, `components/app-header.tsx`, `app/lesson/[id]/notes.tsx` (new, client), `actions.ts`, `page.tsx` |
| H6 | `0008_teacher_versions.sql`, `lib/fork/run.ts`, `lib/fork/diff.ts` (new), `lib/sync/fork-sync.ts`, `lib/publish/run.ts`, `lib/publish/share-version.ts` (new), `app/lessons/page.tsx`, `app/lessons/actions.ts`, `page.tsx` |

Each migration is run once by you in the Supabase SQL editor, wrapped in `begin; … commit;` like 0002 and 0003. None of H1 to H5 changes Google data. H6 copies files into the forker's library folder on Share and trashes them on Stop sharing, only when the forker clicks.

## Out of scope
Author email notifications, the "How did it go?" nudge, anything based on returned or submitted student work, editing a shout-out after sending, reporting or moderating notes beyond delete.

## Risks
1. **Small numbers can identify people.** With "Forked 1 time" and one tag count, a bystander knows that one forker liked "Saved me time" but not who. Acceptable; a minimum of 3 shout-outs before showing counts is an easy switch if you want it.
2. **Students named in notes.** The reminder text is the only guard; delete clears the text in the database. No automatic name detection.
3. **School is new data**, self-reported at onboarding. A typo creates a second school in the list; fix it by SQL for now.
4. **"Taught in N classes" is only as fresh as each forker's last sync**, like Draft / Assigned today.
5. **Functions are the security boundary.** The SQL checks after each migration are the proof; don't demo a step before its checks pass.

## Open questions
None. See Decisions at the top.
