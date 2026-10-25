-- Lesson hub, step H2. Run once in the Supabase SQL editor of the "fork-lesson"
-- project, after 0003. All or nothing.
--
-- Replaces the two functions from 0003 (same names) so that what happens
-- automatically stays private:
--   - "Forked N times": anyone who can see the lesson.
--   - "Taught in N classes": the lesson's author only.
--   - Who forked it: the author sees every fork, without Draft / Assigned.
--     A forker sees only their own forks, with their status. Anyone else: nothing.
begin;

drop function lesson_fork_counts(uuid[]);
drop function lesson_forks(uuid);

-- taught: distinct classes where a fork has been posted (Assigned), as of each
-- forker's last sync. Null unless the caller owns the lesson.
create function lesson_fork_counts(ids uuid[])
returns table (lesson_id uuid, forks int, versions int, taught int)
language sql stable security definer set search_path = public
as $$
  select l.id,
         (select count(*)::int from forks f
           where f.root_lesson_id = l.id and f.removed_at is null and f.status in ('done','partial')),
         (select count(*)::int from lessons v
           where v.forked_from_lesson_id = l.id and v.version_shared),
         case when l.owner_id = auth.uid() then
           (select count(distinct f.target_course_id)::int from forks f
              join lessons fl on fl.fork_id = f.id
             where f.root_lesson_id = l.id and f.removed_at is null and f.status in ('done','partial')
               and fl.classroom_state = 'PUBLISHED')
         end
    from lessons l
   where l.id = any(ids)
     and l.kind = 'original'
     and (l.owner_id = auth.uid()
          or (l.domain = my_domain() and not l.hidden
              and exists (select 1 from courses c where c.id = l.course_id and c.shared)))
$$;

-- Author: every fork, state always null. Forker: only their own rows, with
-- state 'ASSIGNED' or 'DRAFT'. Anyone else: no rows.
-- via_version_of: the version author's name when the fork was made from a
-- shared teacher version (H6); null until then.
create function lesson_forks(p_lesson uuid)
returns table (fork_id uuid, forker_id uuid, forker_name text, class_name text, section text,
               created_at timestamptz, state text, via_version_of text)
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
         case when f.lesson_id is distinct from f.root_lesson_id then coalesce(vu.name, vu.email) end
    from forks f
    join lessons l on l.id = f.root_lesson_id
    join users u on u.id = f.forker_id
    join courses c on c.id = f.target_course_id
    left join lessons fl on fl.fork_id = f.id
    left join lessons v on v.id = f.lesson_id
    left join users vu on vu.id = v.owner_id
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

revoke execute on function lesson_fork_counts(uuid[]) from public, anon;
revoke execute on function lesson_forks(uuid) from public, anon;
grant execute on function lesson_fork_counts(uuid[]) to authenticated;
grant execute on function lesson_forks(uuid) to authenticated;

commit;
