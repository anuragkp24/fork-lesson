-- Fork lineage, step 1. Run once in the Supabase SQL editor of the "fork-lesson"
-- project. All or nothing: if any statement fails, nothing is applied.
-- See docs/plans/fork-lineage.md.
begin;

-- lessons: an original, or a teacher's fork of one
alter table lessons
  add column kind text not null default 'original' check (kind in ('original','fork')),
  add column fork_id uuid unique references forks on delete set null,
  add column forked_from_lesson_id uuid references lessons on delete set null,   -- the original
  add column classroom_state text check (classroom_state in ('DRAFT','PUBLISHED')),
  add column changes text[] not null default '{}',                                -- step 3
  add column change_summary text,                                                 -- step 3
  add column version_shared boolean not null default false,                       -- step 3
  add column version_shared_at timestamptz;
create index on lessons (forked_from_lesson_id);
create index on lessons (kind);

-- forks: keep the record if the original goes away; remember what was forked
alter table forks
  alter column lesson_id drop not null,
  drop constraint forks_lesson_id_fkey,
  add constraint forks_lesson_id_fkey foreign key (lesson_id) references lessons on delete set null,
  add column root_lesson_id uuid references lessons on delete set null,           -- the original, even when forking a version
  add column baseline jsonb,                                                      -- step 3
  add column removed_at timestamptz;                                              -- the forker deleted it in Classroom
create index on forks (root_lesson_id);
update forks set root_lesson_id = lesson_id;                                      -- existing forks are of originals

-- Lessons that are already forks (posted, then synced as if they were new
-- lessons) are tagged now, so they leave the Library immediately. Their
-- library file copies are trashed on the forker's next sync.
update lessons l
   set kind = 'fork', fork_id = f.id, forked_from_lesson_id = f.root_lesson_id
  from forks f
 where f.google_coursework_id is not null
   and l.google_coursework_id = f.google_coursework_id
   and l.owner_id = f.forker_id;

-- A fork is invisible to other teachers unless its owner shared it as a version.
drop policy lessons_read on lessons;
create policy lessons_read on lessons for select to authenticated using (
  owner_id = auth.uid()
  or (domain = my_domain() and not hidden and (
        (kind = 'original' and exists (select 1 from courses c where c.id = course_id and c.shared))
        or version_shared))
);

commit;
