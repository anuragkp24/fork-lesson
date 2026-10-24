-- Fork Lesson slice 1. Run once in the Supabase SQL editor of the "fork-lesson" project.

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

-- Row level security -------------------------------------------------------
-- Clients only read. All writes go through server routes with the secret key.

-- The signed-in teacher's domain. security definer, so the users policy can
-- use it without recursing into itself.
create function my_domain() returns text
  language sql stable security definer set search_path = public
  as $$ select domain from users where id = auth.uid() $$;

alter table users enable row level security;
alter table google_tokens enable row level security;   -- no policies: secret key only
alter table courses enable row level security;
alter table topics enable row level security;
alter table lessons enable row level security;
alter table attachments enable row level security;
alter table forks enable row level security;
alter table sync_state enable row level security;

revoke all on google_tokens from anon, authenticated;

create policy users_read on users for select to authenticated
  using (domain = my_domain());

create policy courses_read on courses for select to authenticated
  using (owner_id = auth.uid() or (shared and exists (
    select 1 from users u where u.id = owner_id and u.domain = my_domain())));

create policy topics_read on topics for select to authenticated
  using (exists (select 1 from courses c where c.id = course_id));   -- courses policy applies

create policy lessons_read on lessons for select to authenticated
  using (owner_id = auth.uid() or (
    domain = my_domain() and not hidden
    and exists (select 1 from courses c where c.id = course_id and c.shared)));

create policy attachments_read on attachments for select to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id));   -- lessons policy applies

create policy forks_read on forks for select to authenticated
  using (forker_id = auth.uid() or exists (
    select 1 from lessons l where l.id = lesson_id and l.owner_id = auth.uid()));

create policy sync_state_read on sync_state for select to authenticated
  using (user_id = auth.uid());
