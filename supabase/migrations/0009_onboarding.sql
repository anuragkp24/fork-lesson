-- Onboarding. Run once in the Supabase SQL editor of the "fork-lesson" project, after 0008.
-- All or nothing.
--
--   - schools: schools in a district (domain). Picked on /welcome/school; a teacher can add
--     one by typing a name (server route, secret key). Seed: supabase/seed/quillmont-schools.sql.
--   - users.school_id, users.onboarded_at: where she teaches, and whether onboarding is done.
--     Nobody is marked onboarded here, so every existing teacher sees onboarding once.
--   - courses.classroom_subject / classroom_levels: Classroom's free-text Course.subject and
--     Course.levels, refreshed by every sync. courses.subject / grade: the teacher's choice,
--     never written by sync.
--   - sync_state.last_trigger gains 'onboarding'.
--
-- PostgREST embeds: one new foreign key, users.school_id -> schools. It is the only link
-- between users and schools (no schools.created_by -> users), and school_id is not part of a
-- key, so users is not seen as a junction table. Existing embeds are unchanged: lessons -> users
-- is always hinted (!lessons_owner_id_fkey), and no new links touch lessons, courses or forks.
begin;

create table schools (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create unique index schools_domain_name on schools (domain, lower(trim(name)));

alter table schools enable row level security;
create policy schools_read on schools for select to authenticated
  using (domain = my_domain());
grant select on schools to authenticated;          -- writes: server routes, secret key

alter table users
  add column school_id uuid references schools on delete set null,
  add column onboarded_at timestamptz;
create index on users (school_id);

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
