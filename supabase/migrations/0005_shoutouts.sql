-- Lesson hub, step H3. Run once in the Supabase SQL editor of the "fork-lesson"
-- project, after 0004. All or nothing.
--
-- Shout-outs: after forking, a teacher can thank the author with tags and an
-- optional note. One per fork, final once sent. Only the author (and the
-- forker who sent it) ever see it, through lesson_forks.
begin;

create table fork_shoutouts (
  fork_id uuid primary key references forks on delete cascade,
  tags text[] not null default '{}' check (tags <@ array['saved_time','ready_to_use','great_materials',
                                                       'clear_instructions','students_love','easy_to_adapt']),
  note text check (char_length(note) between 1 and 300),
  created_at timestamptz not null default now(),
  check (cardinality(tags) > 0 or note is not null)
);
alter table fork_shoutouts enable row level security;   -- no policies: reads go through functions,
                                                        -- writes through the server with the admin client

-- Same rules as 0004, plus the shout-out on rows the caller may see
-- (the author's rows, and a forker's own rows).
drop function lesson_forks(uuid);

create function lesson_forks(p_lesson uuid)
returns table (fork_id uuid, forker_id uuid, forker_name text, class_name text, section text,
               created_at timestamptz, state text, via_version_of text,
               shoutout_tags text[], shoutout_note text)
language sql stable security definer set search_path = public
as $$
  select f.id,
         f.forker_id,
         coalesce(u.name, u.email),
         c.name,
         c.section,
         f.created_at,
         case when l.owner_id = auth.uid() then null
              when fl.classroom_state = 'PUBLISHED' then 'ASSIGNED'
              else 'DRAFT' end,
         case when f.lesson_id is distinct from f.root_lesson_id then coalesce(vu.name, vu.email) end,
         s.tags,
         s.note
    from forks f
    join lessons l on l.id = f.root_lesson_id
    join users u on u.id = f.forker_id
    join courses c on c.id = f.target_course_id
    left join lessons fl on fl.fork_id = f.id
    left join lessons v on v.id = f.lesson_id
    left join users vu on vu.id = v.owner_id
    left join fork_shoutouts s on s.fork_id = f.id
   where f.root_lesson_id = p_lesson
     and f.removed_at is null
     and f.status in ('done','partial')
     and l.kind = 'original'
     and (l.owner_id = auth.uid() or f.forker_id = auth.uid())
     and (l.owner_id = auth.uid()
          or (l.domain = my_domain() and not l.hidden
              and exists (select 1 from courses c2 where c2.id = l.course_id and c2.shared)))
   order by f.created_at desc
$$;

revoke execute on function lesson_forks(uuid) from public, anon;
grant execute on function lesson_forks(uuid) to authenticated;

commit;
