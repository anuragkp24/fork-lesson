# Slice 1: local demo (≈75 min, Sonnet)

**Goal:** on `localhost:3000`, Teacher A signs in and their published Classroom assignments show up as lessons, and their Drive files are copied into a shared library. Teacher B signs in, sees A's lessons in the Library, and forks one into their own class as a draft with fresh copies of the Drive files.

**Test teachers** (Quillmont, domain `gedu.demo.edstitch.com`):
- **Teacher A (publishes):** Sofia Marchetti, `sofia.marchetti@gedu.demo.edstitch.com`, Central Middle, **Math · Section A** (2 Sheets, 1 PDF; topics "Ratios and proportions", "Integers").
- **Teacher B (forks):** Samuel Adeyemi, `samuel.adeyemi@gedu.demo.edstitch.com`, Westview High, forks into **Geometry · Section C**.

**Patterns to copy from parent-connector (read only):** `proxy.ts` (session refresh + protected routes), `lib/supabase/{client,server}.ts`, `lib/links/crypto.ts` (AES-256-GCM, `parseKey`), `lib/google/token.ts` (refresh + failure classification), `lib/google/log-sanitize.ts`. Copy the code. Never import from that repo or reuse its keys or client.

---

## Scopes (Testing-mode demo)

```
openid email profile
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.topics
https://www.googleapis.com/auth/classroom.coursework.students
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/drive.file
```

- `drive.readonly` lets A's token read the originals the seeder made, and lets B's token read the library copies A shared with the domain.
- `drive.file` covers everything the app writes: the library folder and copies, B's "Fork Lesson" folder and copies, and the domain share.
- **`drive.readonly` is a restricted scope.** It's fine for Testing mode with listed test users. Before going public it needs Google verification plus a paid third-party security assessment, or the app switches to the Picker approach (below), which needs only `drive.file`.
- `classroom.topics` (read/write) is needed only when the teacher picks "Create topic" in the fork dialog.

## Timeline

| Min | Step |
|---|---|
| 0–10 | Raj: Google Cloud + Supabase settings (section 7). Claude: add `@supabase/ssr`, `@supabase/supabase-js`, migration, lib files |
| 10–20 | 1. Sign-in + encrypted refresh token |
| 20–35 | 2. Sync + 3. Publish to library |
| 35–50 | 4. Pages |
| 50–55 | 5a. Drive smoke check |
| 55–75 | 5. Fork + demo run |

---

## 1. Sign in (Supabase Auth, Google provider)

- `/login` button calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback, scopes: <the list above, space-separated>, queryParams: { access_type: "offline", prompt: "consent" } } })`.
- `app/auth/callback/route.ts`: `exchangeCodeForSession(code)`. **The session's `provider_refresh_token` is only available at this moment.** Supabase doesn't store it. Encrypt it right away (`lib/crypto.ts`, key `TOKEN_ENCRYPTION_KEY`, AAD `"fl_refresh.v1"`) and upsert it into `google_tokens` with the secret-key client. If it's missing, redirect to `/login?reconnect=1`, which forces `prompt=consent` again.
- Check the granted scopes (token response `scope`). If any Drive or Classroom scope was unticked on the consent screen, show "Fork Lesson needs all permissions" and a retry button.
- `lib/google/access-token.ts`: decrypt → POST `oauth2.googleapis.com/token` → access token kept in memory only. Never log tokens or raw error bodies (sanitize like parent-connector).
- `proxy.ts`: refresh the Supabase session; protect `/lessons`, `/library`, `/lesson/*`.
- Upsert into `users`: email, name, `domain = emailDomain(email)` (already in `lib/domain.ts`, tested).

## 2. Sync (button on My lessons, server action)

1. `courses.list?teacherId=me&courseStates=ACTIVE`
2. For each course: `courses.topics.list`, `courses.courseWork.list?courseWorkStates=PUBLISHED`
3. Skip items where `assigneeMode == INDIVIDUAL_STUDENTS`. Keep items with no materials (the description still counts).
4. Map each `material` to an attachment: `driveFile` (id, title, alternateLink, shareMode), `youtubeVideo`, `link`. `form`, and anything else (add-ons), becomes `kind = 'unsupported'` with a "re-add" note.
5. Upsert `courses`, `topics`, `lessons` (by `google_coursework_id`), `attachments`. Write `sync_state` (last run, counts, error). Shared defaults to true (per-class onboarding comes later).
6. Read nothing from submissions, rosters or grades.

Tests (Vitest, pure functions): `mapCourseWork()` → lesson + attachments, the skip rules, unsupported materials.

## 3. Publish to the library (runs after sync, with A's token)

1. Find or create the app folder **"Fork Lesson library"** in A's Drive (`files.create`, mimeType folder). Store its id on `users.library_folder_id`.
   - Share it once: `permissions.create { type: "domain", domain: <A's domain>, role: "reader", allowFileDiscovery: false }`. Files inside inherit it.
2. For each Drive attachment that has no `library_file_id`: `files.copy { fileId: original, parents: [library folder], name: <original title> }` → store `library_file_id`.
   - Originals are never modified, moved or re-shared.
   - Re-sync doesn't re-copy. Picking up later edits to the originals is out of scope for slice 1 (`source_updated_at` is saved for later).
3. Copy failures (no access, a shortcut, a non-copyable file) → `attachments.publish_error`, and the lesson page shows "This file couldn't be shared".

## 4. Pages (server components, Tailwind, plain styling)

- **My lessons** `/lessons`: grouped by class, then topic (no-topic last). Sync button and last-synced time.
- **Library** `/library`: shared, not hidden lessons where `domain = me.domain` and `owner != me`, newest first. Card: title, teacher, class, attachment icons + counts.
- **Lesson** `/lesson/[id]`: description, attachments (with re-add notes), "Fork to my class" (only for non-owners), fork count.

RLS: a user can read lessons in their own domain and write only their own rows. Sync, publish and fork writes run server-side with the secret key, scoped by the signed-in user's id.

## 5. Fork (B's token)

**Fork dialog** (on the Lesson page):
- **Class:** B's ACTIVE courses (from sync).
- **Topic:** depends on the class chosen.
  - If the class has a topic with the same name (case-insensitive, trimmed), it's preselected.
  - Otherwise the options are **"No topic" (default)** and **"Create topic '<name>'"**.
  - Forks never create a topic silently.
- Note: "This creates a draft. Students won't see it until you post it."

**`POST /api/fork { lessonId, courseId, topicChoice: "existing" | "create" | "none" }`:**
1. Find or create **"Fork Lesson"** in B's Drive (`users.forks_folder_id`).
2. For each Drive attachment with a `library_file_id`: `files.copy { fileId: library_file_id, parents: [B's folder], name: <title> }`. The copy is owned by B.
3. Topic: `existing` → that `topicId`. `create` → `courses.topics.create { name }` first. `none` → no `topicId`.
4. `courseWork.create` with `state: DRAFT`, no `dueDate`/`dueTime`, same title, description, workType, maxPoints. `materials` = the new driveFile ids (keep each original's `shareMode`), the YouTube videos, the links. No credit text for students.
5. Insert into `forks` (source lesson, forker, target course, topic choice, new coursework id, `drive_copy_ids`, status). Show a link to the draft in Classroom (`alternateLink`).
6. Partial failures: if a copy fails, still create the draft with what worked, set status `partial` and list what's missing. If `courseWork.create` fails, delete the copies made by this fork (B's own app-created files, so no extra scope).

### 5a. Drive smoke check (5 minutes, before building step 5)

`scripts/drive-check.ts` prints only status codes and ids, never tokens. Raj runs it live:
1. A's token: `files.get` on one of Sofia's originals → 200.
2. A's token: copy it into the library folder, add the domain share → 200.
3. B's token: `files.get(library_file_id)` → 200, then `files.copy` into B's folder → 200.

Step 3 is the one to watch: it relies on `drive.readonly` (read) plus `drive.file` (create the copy) together. If it fails, try `files.copy` with `drive.readonly` access only. If it still fails, use the Picker fallback below.

### Fallback for a future verified app (no `drive.readonly`): Google Picker

With only `drive.file`, the app sees just files it created or that the user picked through it.
- **Publish:** A opens the Picker preset to the lesson's files (`DocsView.setFileIds`), clicks Select once, then the server copies them into the library as above.
- **Fork:** B opens the Picker preset to the `library_file_id`s, clicks Select, then the server copies them.
- Needs the Google Picker API, a browser API key restricted to the app origin, and the project number as the Picker `appId`.
- Not built in slice 1.

## 6. Supabase schema (`supabase/migrations/0001_init.sql`)

```sql
create table users (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  name text,
  domain text not null,
  role text not null default 'teacher',          -- phase 2: 'designer', 'admin'
  library_folder_id text,                         -- "Fork Lesson library" (publish)
  forks_folder_id text,                           -- "Fork Lesson" (forks)
  created_at timestamptz default now()
);
create index on users (domain);

create table google_tokens (                      -- secret key only, no RLS policies
  user_id uuid primary key references users on delete cascade,
  refresh_token_enc text not null,                -- "v1." + base64url(iv|ct|tag)
  scopes text[] not null,
  updated_at timestamptz default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  google_course_id text not null,
  name text not null, section text,
  shared boolean not null default true,           -- onboarding toggle, per class
  unique (owner_id, google_course_id)
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses on delete cascade,
  google_topic_id text not null,
  name text not null,
  unique (course_id, google_topic_id)
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  domain text not null,                            -- copied from owner, for the library query + RLS
  google_coursework_id text not null unique,
  title text not null, description text,
  work_type text, max_points numeric,
  topic_name text,
  hidden boolean not null default false,           -- per-lesson "hide"
  unit_id uuid,                                    -- phase 2: references units
  is_official boolean not null default false,      -- phase 2: curriculum designer badge
  source_updated_at timestamptz,                   -- Classroom updateTime
  synced_at timestamptz default now()
);
create index on lessons (domain, hidden);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons on delete cascade,
  position int not null,
  kind text not null check (kind in ('drive','youtube','link','unsupported')),
  title text, url text,
  drive_file_id text, mime_type text, share_mode text,
  library_file_id text,                            -- A's copy in "Fork Lesson library"
  publish_error text,
  unsupported_type text                            -- 'form', 'addon', … → re-add note
);

create table forks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons on delete cascade,
  forker_id uuid not null references users on delete cascade,
  target_course_id uuid not null references courses,
  topic_choice text not null check (topic_choice in ('existing','create','none')),
  google_topic_id text,
  google_coursework_id text,
  drive_copy_ids text[] default '{}',
  status text not null default 'pending' check (status in ('pending','done','partial','failed')),
  error text,
  created_at timestamptz default now(),
  seen_by_owner_at timestamptz                     -- bell, weekly digest later
);

create table sync_state (
  user_id uuid primary key references users on delete cascade,
  last_started_at timestamptz, last_finished_at timestamptz,
  courses_count int, lessons_count int, published_count int,
  last_error text
);
```

RLS on (all tables): `users` read same domain; `courses`/`topics`/`lessons`/`attachments` read where the lesson's domain = mine, and for others' lessons only when `shared and not hidden`; `forks` read when I'm the forker or the lesson owner. No insert/update policies for clients, since writes go through server routes with the secret key. Phase 2 adds `units`, `unit_lessons`, `comments`, `recommendations` without changing these tables.

## 7. Settings Raj clicks

`<ref>` = the Supabase project ref (Supabase → Project Settings → General → Project ID).

**Google Cloud, project "Fork Lesson" (raj@edstitch.com)**
1. APIs & Services → Library: enable **Google Classroom API** and **Google Drive API**.
2. Google Auth Platform → **Branding**:
   - App name "Fork Lesson", user support email and developer contact raj@edstitch.com.
   - Authorized domains: `supabase.co`.
   - Leave home page, privacy and terms links empty for now (forklesson.com isn't hooked up).
3. **Audience**:
   - User type **External**, publishing status **Testing**.
   - Test users: `sofia.marchetti@gedu.demo.edstitch.com`, `samuel.adeyemi@gedu.demo.edstitch.com`.
4. **Data Access** → Add or remove scopes: the 6 non-identity scopes in the Scopes section (`openid`, `email`, `profile` are already there). `drive.readonly` shows under "restricted scopes". That's expected in Testing.
5. **Clients** → Create client → **Web application**, name "Fork Lesson local (Supabase)":
   - Authorized JavaScript origins: `http://localhost:3000`.
   - Authorized redirect URIs: **`https://<ref>.supabase.co/auth/v1/callback`** (only this one; Google redirects to Supabase, which then redirects to our `/auth/callback`).
   - Save the client ID + secret straight into Supabase and `.env.local`.
6. Workspace (gedu.demo.edstitch.com) Admin console → Security → Access and data control → **API controls** → Manage third-party app access: if Fork Lesson's client is blocked or limited for the Quillmont OUs, set it to **Trusted** (needed for the restricted Drive scope).

**Supabase, project "fork-lesson"**
1. Authentication → **URL Configuration**:
   - Site URL `http://localhost:3000`.
   - Redirect URLs: add `http://localhost:3000/auth/callback`.
2. Authentication → Sign In / Providers → **Google**: enabled.
   - Client ID and Client Secret from step 5.
   - "Skip nonce checks" off, "Allow users without an email" off.
   - Scopes aren't set here; the app sends them in `signInWithOAuth`.
3. Project Settings → API Keys: copy the **publishable** key and a **secret** key (legacy `anon` / `service_role` also work if that's all the project shows).
4. SQL editor: run `supabase/migrations/0001_init.sql` once Claude writes it (or `supabase db push`, with Raj's OK).

**`.env.local`** (never committed, never printed)
```
NEXT_PUBLIC_SUPABASE_URL=              # https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # sb_publishable_… (or legacy anon key)
SUPABASE_SECRET_KEY=                   # sb_secret_… (or legacy service_role key); server only
GOOGLE_CLIENT_ID=                      # same client as in Supabase; for token refresh
GOOGLE_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=                  # openssl rand -base64 32
```

---

## Risks

1. **Missing refresh token.** It's only in the session at the callback, and only with `prompt=consent`. Without it, sync works once and then dies.
2. **Workspace API controls** might block or limit an unverified app asking for `drive.readonly` for Quillmont users. Check the Admin console before the session.
3. **The copy in step 5a.3** depends on how Google combines `drive.readonly` with `drive.file`. That's what the 5-minute check is for.
4. **Partial consent:** teachers can untick scopes on the consent screen. Check granted scopes at the callback.
5. **Classroom `ProjectPermissionDenied`**: drafts made by our project can be edited via the API only by our project. Fine in the Classroom UI.
6. **Testing-mode refresh tokens expire after 7 days.** Re-sign-in before each demo.
7. **`drive.readonly` is restricted:** verification + security assessment before public launch, or switch to the Picker fallback.

## Cut list (in order, if time runs short)

1. "Create topic" option → existing same-name topic or no topic.
2. Lesson page → fork straight from the Library card.
3. Rollback of copies when `courseWork.create` fails → log and leave them.
4. RLS polish → server-only reads with the secret key, scoped in code (RLS before anything leaves localhost).
5. Grouping by topic on My lessons → a flat list per class.

Not cut: refresh-token encryption, originals untouched, skipping individual-student assignments, not reading student data, drafts only.
