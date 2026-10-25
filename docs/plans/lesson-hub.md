# Lesson hub: who sees what, shout-outs, teacher notes, versions

Replaces section 8 step 3 ("Teacher versions") of `fork-lineage.md`. Steps 1 and 2 of that plan are built and committed (4d93b5a, 2021d93).

Status: H1 to H3 live (bdf129f; 0004 and 0005 applied Oct 25). Next: Cards batch A (H4 + C2 + C3, migration 0006), then batch B (C1, migration 0007), then H5 and H6. H4 to H6 and C1 to C3 are plan only.

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

*Changed by C3:* a forker who clicked **Skip** can send thanks later from a **Say thanks** link. Still one per fork, final once sent. The action already allows it; only the UI changes.

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

Built together with C2 and C3 (Cards, batch A), in one migration.

**Migration `0006_cards.sql`** (see batch A below). `lesson_tag_counts(ids uuid[])` returns `(lesson_id, tag, n)`: counts across shout-outs on forks whose `lesson_id` is one of `ids` (forks of the lesson itself; shout-outs on a version go to that version, H6). It takes an array so the Library gets every card's counts in one call (C3); the lesson page passes `[id]`. Same visibility check as the other functions. No names, no notes, no fork ids.

**App.** A **What teachers like** card under the header: chips like "Saved me time · 2", sorted by count then by the fixed tag order. Hidden when there are none. Shown to everyone, author included.

**Tests.** `sortTagCounts` (order, ties, unknown tag ignored); empty list renders nothing.

**Check** (on lesson R).
1. **Henry**, lesson R: **What teachers like** shows "Saved me time 1 · Clear instructions 1". No names.
2. **Carlos** sees the same card. **Sofia** sees it too, above her Forked by list.
3. Lesson P (forked, nobody thanked): no card at all.

---

## Cards (C1–C3)

Lesson cards in the Library and My lessons get a picture of the first file, a private heart, and shout-outs. Built in two batches:
- **Batch A:** H4 + C2 (Save for later) + C3 (shout-outs on cards). One migration, `0006_cards.sql`. Also turns My lessons into cards, so batch B only adds the picture.
- **Batch B:** C1 (card pictures). Migration `0007_card_thumbnails.sql`. Teacher notes and versions move to 0008 (H5) and 0009 (H6).

Who sees what, adding to the table at the top (H2 rules unchanged):

| What | Who sees it |
|---|---|
| Top 1–2 "What teachers like" tags on a Library card | Everyone, anonymous (same data as H4) |
| "N thank-yous" on a card, and the new-thanks dot | The original author only, in My lessons |
| "Thanks sent ✓" / "Say thanks" on a fork card | That forker only |
| Saved lessons (heart) | The saver only. No counts anywhere |
| Card picture | Anyone who can see the lesson (it is the library copy, already shared with the domain) |

Notes from shout-outs never appear on any card.

Cards decisions (Oct 25, Raj + planner):
1. **Picture:** the first Drive attachment with a library copy, by position; none → file-type icon.
2. **My lessons as cards:** yes. One warning line on the card; per-file states stay on the lesson page.
3. **Fork cards:** show the original's picture.
4. **Lessons in unshared classes:** no picture (no library copy), icon tile. OK for now.
5. **Heart on the lesson page:** yes, in the header too. Same button; never on your own lessons or on forks.
6. **Small numbers:** no minimum. Tag chips show from 1.
7. **`saved_lessons`:** written with the signed-in client, guarded by row level security.

Cast for both checks: **Sofia** (author of P and R), **Henry** (forked R and sent thanks in the H3 check), **Carlos** (forked R in the H2 check, never thanked), **Samuel** (saver; Westview, Geometry · Section C).

### Batch A: H4, Save for later, shout-outs on cards

**Migration `0006_cards.sql`** (one `begin; … commit;`):
```sql
-- H4 + C3: tag counts for many lessons at once (Library cards and the lesson page).
create function lesson_tag_counts(ids uuid[]) returns table (lesson_id uuid, tag text, n int) …
  -- counts over fork_shoutouts s join forks f on f.id = s.fork_id
  -- where f.lesson_id = any(ids), f.removed_at is null, f.status in ('done','partial'),
  -- plus the same "can the caller see this original" check as lesson_fork_counts. No names, notes or fork ids.

-- C3: the author's private thank-you count, and which ones are new.
alter table fork_shoutouts add column seen_by_author_at timestamptz;
drop function lesson_fork_counts(uuid[]);
create function lesson_fork_counts(ids uuid[])
  returns table (lesson_id uuid, forks int, versions int, taught int, thanks int, new_thanks int) …
  -- thanks / new_thanks: shout-outs on forks with f.lesson_id = l.id (new = seen_by_author_at is null).
  -- Both null unless the caller owns the lesson, like taught.

create function mark_thanks_seen(p_lesson uuid) returns void …
  -- sets seen_by_author_at = now() on that lesson's unseen shout-outs, only when auth.uid() owns it.

-- C3: which of my forks I've already thanked for. Only the caller's own forks.
create function my_thanks_sent(fork_ids uuid[]) returns setof uuid …
  -- select s.fork_id from fork_shoutouts s join forks f on f.id = s.fork_id
  -- where s.fork_id = any(fork_ids) and f.forker_id = auth.uid()

-- C2: Save for later. Own rows only.
create table saved_lessons (
  user_id uuid not null default auth.uid() references users on delete cascade,
  lesson_id uuid not null references lessons on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table saved_lessons enable row level security;
create policy saved_read on saved_lessons for select to authenticated using (user_id = auth.uid());
create policy saved_insert on saved_lessons for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from lessons l                       -- lessons policy applies: must be visible
               where l.id = lesson_id and l.kind = 'original' and l.owner_id <> auth.uid()));
create policy saved_delete on saved_lessons for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on saved_lessons to authenticated;
```
All functions `security definer`, `set search_path = public`, execute revoked from `public, anon`, granted to `authenticated`. `fork_shoutouts` keeps no policies. `my_thanks_sent` is a function rather than a read policy so a forker can never see whether the author has opened her thanks.

This is the first table teachers write through their own session instead of the admin client. The server action still does the write; row level security is the guard, and the SQL checks prove it.

**H4 on the lesson page**, as specced above, calling `lesson_tag_counts([id])`.

**Shared card (`components/lesson-card.tsx`).** One card for Library, Saved, and My lessons: class line, title, teacher (+ You), topic, file chips, "Forked N times", and slots for the heart, tags, and badges. The title is the link and stretches over the card; the heart is a separate button on top of it, so the two never nest. Batch B adds the picture slot at the top.

**C2 Save for later.**
- `components/save-button.tsx` (client): heart outline / filled, `aria-pressed`, label "Save for later" / "Saved". Toggles at once, undoes on error.
- Server action `setSaved({ lessonId, saved })` in `app/library/actions.ts`: insert or delete with the signed-in client, so row level security decides. Revalidates `/library`, `/lessons` and `/lesson/<id>`.
- Shown on every Library card, every Saved card, and in the **lesson page header** (next to **Fork to my class**), **not** on your own lessons or on fork cards. A fork never has its own page (it redirects to the original), so the header heart is always for an original.
- The lesson page reads whether I saved it with one `saved_lessons` select for that lesson id (signed-in client, own rows only), only when I'm not the owner.
- My lessons gets two tabs: **My lessons** and **Saved** (`/lessons?tab=saved`). Saved lists saved lessons I can still see, newest save first, as Library cards. If a lesson is later hidden or unshared it drops out of the list; it comes back if shared again. Empty state: "Tap the heart on any lesson in the Library to save it here."
- No counts anywhere, including for the author.

**C3 Shout-outs on cards.**
- **Library card (everyone):** the top 2 tags as chips, e.g. "Saved me time · 2", from one `lesson_tag_counts(all ids)` call next to the existing `lesson_fork_counts` call. Sorted by count, then the fixed tag order. Nothing when there are none.
- **Author's card in My lessons:** "3 thank-yous" (hidden at 0) from the new `thanks` column, with a dot and screen-reader text "2 new" when `new_thanks > 0`. Links to the lesson page. When she opens her lesson page, the page calls `mark_thanks_seen` after loading (errors ignored), so the dot clears next time she looks at My lessons.
- **Forker's fork card in My lessons:** "Thanks sent ✓" when `my_thanks_sent` includes the fork; otherwise a **Say thanks** button, shown only when the original is still visible to me and the fork worked. It opens the same thanks form as the fork dialog, in a small dialog. After Send: "Thanks sent ✓", final.
- **Lesson page, Your fork row:** the same "Thanks sent ✓" / **Say thanks** (from `shoutout_tags` / `shoutout_note`, already returned to the forker).
- The H3 thanks form moves out of `fork-dialog.tsx` into `components/thanks-form.tsx`, used by both places. `sendShoutout` is unchanged apart from also revalidating `/lessons`.
- My lessons fork rows need `fork_id` in the select; forks still link to the original's page, as now.

**My lessons as cards.** Classes and topics stay as headings; lessons become the shared card in a two-column grid. The per-file "In library / Couldn't be shared / Not shared yet" lines move off the card: the card shows one warning line, "1 file couldn't be shared", linking to the lesson page, which already shows each file's state to the author.

**Pure helpers.**
- `lib/hub/tags.ts`: `sortTagCounts(rows)` and `topTags(rows, lessonId, 2)`.
- `lib/hub/thanks.ts` (new): `thanksBadge({ thanks, newThanks })` → null at 0 / "1 thank-you" / "3 thank-yous" + `hasNew`; `forkThanksState({ sent, originalVisible, forkOk })` → `"sent" | "can-thank" | null`.
- `lib/library/tabs.ts` (new): `lessonsTab(param)` → `"mine" | "saved"`; `publishProblemLabel(attachments)`.

**Tests.** `sortTagCounts` (order, ties, unknown tag ignored, empty); `topTags` (top 2, ties broken by tag order, only that lesson's rows); `thanksBadge` (0, 1, many, new and none new); `forkThanksState` (sent, can thank, original hidden, failed fork); `lessonsTab` (missing, unknown, saved); `publishProblemLabel` (none, one, several).

**SQL checks** (each in `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<id>"}'; … rollback;`):
- **Samuel:** `insert into saved_lessons (lesson_id) values ('<R>')` works; `select * from saved_lessons` shows 1 row. Inserting with `user_id = '<Henry>'` is refused. Inserting one of his own lessons is refused. Inserting a hidden lesson's id is refused.
- **Henry:** `select * from saved_lessons` shows none of Samuel's rows. `delete from saved_lessons where user_id = '<Samuel>'` deletes 0 rows.
- **Henry:** `lesson_tag_counts(array['<R>','<P>'])` returns R's tags only, with no names. `lesson_fork_counts(array['<R>'])`: `thanks` and `new_thanks` are null.
- **Sofia:** `lesson_fork_counts(array['<R>'])`: `thanks = 1`, `new_thanks = 1` (Henry's). After `select mark_thanks_seen('<R>')`, `new_thanks = 0`.
- **Henry:** `mark_thanks_seen('<R>')` changes nothing (check as Sofia afterwards).
- **Carlos:** `my_thanks_sent(array['<Henry's R fork>'])` returns nothing. `select * from fork_shoutouts` returns 0 rows.

**Check (batch A).** Start state: Carlos and Henry have both forked R, only Henry sent thanks ("Saved me time", "Clear instructions", note "Using this Monday"). If Henry's skipped second fork from the H3 check exists, it shows **Say thanks** in step 5.
1. **Samuel**, Library: R's card shows "Saved me time · 1" and "Clear instructions · 1", no names, no note. P's card has no tags. Every card except his own has a heart.
2. **Samuel** hearts R and P, opens My lessons → **Saved**: both cards, hearts filled. Reload: still there. Unheart P on the Saved tab: it leaves the list. He opens lesson P: the heart in the header is empty. He hearts it there; back on **Saved**, P is listed again with a filled heart, and P's Library card heart is filled too.
3. **Henry**, My lessons → **Saved**: empty, with the hint. Nowhere in the app shows how many people saved R.
4. **Sofia**, Library: her R card shows the same two tags, and no heart on her own cards or in the header of her own lesson R page. My lessons: R's card shows "1 thank-you" with a dot; P's card shows nothing. She opens R and comes back: "1 thank-you", no dot. Lesson R shows **What teachers like** (H4 check).
5. **Henry**, My lessons: his R fork card shows "Thanks sent ✓" and no Say thanks. No thank-you count on any of his cards.
6. **Carlos**, My lessons: his R fork card shows **Say thanks**. Lesson R, Your fork row: **Say thanks** too.
7. **Carlos** clicks **Say thanks**, picks "Ready to use", writes "Thank you!", **Send**: the card reads "Thanks sent ✓", and there is no way to send a second one.
8. **Sofia**, My lessons: R shows "2 thank-yous" with a dot. Lesson R, Forked by: Carlos now has the chip and the note.
9. **Henry**, Library: R's card now shows "Saved me time · 1" and "Ready to use · 1" (ties go by tag order, so "Clear instructions" drops off the card); lesson R's **What teachers like** shows all three. "Thank you!" appears on no card, for anyone.

### Batch B: C1 card pictures

**What Google's docs say** (Drive API v3 `files` reference, checked Oct 25):
- `thumbnailLink` is "a short-lived link", which "typically lasts on the order of hours".
- It is "only populated when the requesting app can access the file's content". For a file that isn't public, it "must be fetched using a credentialed request", and it is not meant to be used directly in web pages (CORS). So the server fetches it with the teacher's token and keeps its own copy.
- `hasThumbnail` says whether a picture exists; `thumbnailVersion` changes when the picture does, for cache busting.
- Scopes: `drive.file` covers files this app created, which every library copy is. So reading a library copy's picture works with `drive.file` alone, and keeps working with the Picker fallback if `drive.readonly` (restricted) is dropped.
- Not in the docs: the `=s220` size suffix on the link. Changing it to get a larger picture is undocumented; try it, and fall back to the link as given.

**Migration `0007_card_thumbnails.sql`.**
```sql
begin;
alter table attachments
  add column thumbnail_path text,             -- object in the private "thumbnails" bucket
  add column thumbnail_version text,          -- Drive thumbnailVersion, for cache busting
  add column thumbnail_checked_at timestamptz;
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', false);
-- no storage.objects policies: only the server (admin client) reads or writes the bucket
commit;
```
`syncAttachments` updates only the columns it maps, so these survive every sync.

**Fetching (part of Sync and publish, read-only on Google).** After `publishLibrary` copies files, a new `lib/publish/thumbnails.ts` runs with the same teacher's token:
1. For each shared, not-hidden original of that teacher: pick the card's attachment with `pickThumbnailAttachment` (the first Drive attachment with a library copy, by position). Skip when it already has `thumbnail_path`.
2. `getThumbnailInfo(library_file_id)` (`fields=hasThumbnail,thumbnailLink,thumbnailVersion`). No link yet (new copies can take a while): set `thumbnail_checked_at` and try again next sync.
3. `fetchThumbnail(link, token)`: `Authorization: Bearer`, only `https://*.googleusercontent.com` links, image types only, 1 MB cap. Upload to `thumbnails/<owner id>/<attachment id>` with the admin client; save the path and version.
4. At most 25 pictures per sync so sync stays quick; the rest come next time. Failures never fail the sync and are logged without the link.
5. Clean-up: remove objects in `<owner id>/` that no attachment row points at any more (lesson deleted, file removed).

Library copies don't change after publish, so one fetch per copy is enough. When a copy is replaced (H6 or a later re-publish), its new id has no picture yet and step 1 fetches again.

**Serving.** `app/api/thumbnail/[lessonId]/route.ts` (GET):
- Reads the lesson and its picked attachment with the signed-in client, so row level security decides: not visible (hidden, unshared, other domain, signed out) → 404.
- Downloads the object with the admin client and returns it with `Cache-Control: private, max-age=86400`.
- Cards use `/api/thumbnail/<lessonId>?v=<thumbnail_version>`, so a new picture shows at once. Same-origin, so Safari's cookie blocking doesn't apply.

**Card.** A 16:9 picture at the top of `lesson-card.tsx` (`object-cover`, `object-top`, `alt=""` since the title says the same), then title, teacher, class, file chips, "Forked N times", as now. No picture → a soft tile with the file-type icon of the first attachment (Doc, Slides, Sheet, PDF, video, link) via `fallbackIcon`. Fork cards in My lessons show the original's picture; if the original is no longer visible, the icon. Lessons in unshared classes have no library copy, so their cards show the icon.

**Pure helpers** in `lib/cards/thumbnail.ts`: `pickThumbnailAttachment(attachments)`, `thumbnailSrc(lessonId, version)`, `fallbackIcon(kind, mimeType)`, `isAllowedThumbnailUrl(url)`, `sizedThumbnailLink(link, px)`.

**Tests.** `pickThumbnailAttachment` (Drive first, link first, Drive without library copy, no attachments, position order); `thumbnailSrc` (with and without version, encoding); `fallbackIcon` (each type, unknown); `isAllowedThumbnailUrl` (googleusercontent ok; http, other hosts, look-alike hosts refused); `sizedThumbnailLink` (replaces `=s220`, leaves other links alone).

**SQL checks.** After Sofia's sync: `select count(*) from attachments a join lessons l on l.id = a.lesson_id where l.owner_id = '<Sofia>' and a.thumbnail_path is not null` equals the number of her shared lessons whose first Drive file is in the library. `select count(*) from storage.objects where bucket_id = 'thumbnails'` matches. As Henry (authenticated role), `select * from storage.objects where bucket_id = 'thumbnails'` returns 0 rows.

**Check (batch B).** Setup, you run: 0007, then **Sofia** clicks **Sync and publish** (reads Drive pictures, writes nothing to Google). I verify by text, counts, and status codes; the pictures themselves you look at.
1. SQL checks above pass.
2. **Henry**, Library: R's and P's cards each have a picture; `/api/thumbnail/<R>` returns 200 with an image type. The page makes no requests to googleusercontent.com.
3. A Sofia lesson whose first attachment is a link (or with no Drive file in the library): icon tile, no broken image.
4. **Samuel**, Saved tab: the same pictures. **Henry**, My lessons: his R fork card shows R's picture. **Carlos** too.
5. **Sofia** hides lesson R: **Henry**'s `/api/thumbnail/<R>` returns 404, and R leaves his Library and Samuel's Saved tab. Unhide: back.
6. Signed out, `/api/thumbnail/<R>` doesn't return the image.
7. The next day (link long expired), the pictures still load: they come from our copy.

---

## H5. Teacher notes

**Migration `0008_teacher_notes.sql`.**
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

**Demo SQL** (run once after 0008, in the Supabase SQL editor). Sofia and Samuel's schools come from the slice 1 plan; fill in Carlos's and Henry's:
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

**Migration `0009_teacher_versions.sql`.**
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
| H4 + C2 + C3 (batch A) | `0006_cards.sql`, `lib/hub/tags.ts`, `lib/hub/thanks.ts` (new), `lib/library/tabs.ts` (new), `components/lesson-card.tsx` (new), `components/save-button.tsx` (new), `components/thanks-form.tsx` (new, from `fork-dialog.tsx`), `app/library/actions.ts` (new), `app/library/page.tsx`, `app/lessons/page.tsx`, `app/lesson/[id]/actions.ts`, `fork-dialog.tsx`, `app/lesson/[id]/page.tsx` (H4 card, header heart, Say thanks, `mark_thanks_seen`) |
| C1 (batch B) | `0007_card_thumbnails.sql`, `lib/google/drive.ts`, `lib/publish/thumbnails.ts` (new), `lib/sync/run.ts` or `app/lessons/actions.ts` (call it after publish), `lib/cards/thumbnail.ts` (new), `app/api/thumbnail/[lessonId]/route.ts` (new), `components/lesson-card.tsx` |
| H5 | `0008_teacher_notes.sql`, `lib/hub/notes.ts` (new), `lib/hub/school.ts` (new), `app/welcome/` (new), `app/auth/callback/route.ts`, `proxy.ts`, `components/app-header.tsx`, `app/lesson/[id]/notes.tsx` (new, client), `actions.ts`, `page.tsx` |
| H6 | `0009_teacher_versions.sql`, `lib/fork/run.ts`, `lib/fork/diff.ts` (new), `lib/sync/fork-sync.ts`, `lib/publish/run.ts`, `lib/publish/share-version.ts` (new), `app/lessons/page.tsx`, `app/lessons/actions.ts`, `page.tsx` |

Each migration is run once by you in the Supabase SQL editor, wrapped in `begin; … commit;` like 0002 and 0003. None of H1 to H5 or C1 to C3 changes Google data (C1 only reads Drive pictures during Sync and publish). H6 copies files into the forker's library folder on Share and trashes them on Stop sharing, only when the forker clicks.

## Out of scope
Author email notifications, the "How did it go?" nudge, anything based on returned or submitted student work, editing a shout-out after sending, reporting or moderating notes beyond delete.

## Risks
1. **Small numbers can identify people.** With "Forked 1 time" and one tag count, a bystander knows that one forker liked "Saved me time" but not who. Acceptable; a minimum of 3 shout-outs before showing counts is an easy switch if you want it.
2. **Students named in notes.** The reminder text is the only guard; delete clears the text in the database. No automatic name detection.
3. **School is new data**, self-reported at onboarding. A typo creates a second school in the list; fix it by SQL for now.
4. **"Taught in N classes" is only as fresh as each forker's last sync**, like Draft / Assigned today.
5. **Functions are the security boundary.** The SQL checks after each migration are the proof; don't demo a step before its checks pass.
6. **Cards make small numbers more visible.** Tag chips now sit on every Library card, so risk 1 applies to the whole Library, not just the lesson page. Decided Oct 25: no minimum, chips show from 1.
7. **A card picture shows the first page to everyone who can see the lesson.** It is the same file already shared with the domain, so nothing new is exposed, but a first page that names students is now easier to notice. Teachers' own materials only; no student data is read.
8. **Card pictures depend on Drive making one.** New copies can take a while, and some types never get one; those cards show the icon until a later sync.

## Open questions
None. See Decisions at the top (H1 to H6) and Cards decisions (C1 to C3).
