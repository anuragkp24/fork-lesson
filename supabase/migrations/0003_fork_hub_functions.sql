-- Fork lineage, step 2. Run once in the Supabase SQL editor of the "fork-lesson"
-- project, after 0002. All or nothing.
--
-- Two read-only functions that let any teacher who can see an original lesson
-- see how often it was forked and by whom, without opening up the forks and
-- courses tables themselves (a forker's class may not be shared).
begin;

-- "Forked N times" for the Library cards and the lesson page header.
-- Counts forks (not teachers) that still exist. Also returns how many teacher
-- versions are shared (used in step 3).
create function lesson_fork_counts(ids uuid[])
returns table (lesson_id uuid, forks int, versions int)
language sql stable security definer set search_path = public
as $$
  select l.id,
         (select count(*)::int from forks f
           where f.root_lesson_id = l.id and f.removed_at is null and f.status in ('done','partial')),
         (select count(*)::int from lessons v
           where v.forked_from_lesson_id = l.id and v.version_shared)
    from lessons l
   where l.id = any(ids)
     and l.kind = 'original'
     and (l.owner_id = auth.uid()
          or (l.domain = my_domain() and not l.hidden
              and exists (select 1 from courses c where c.id = l.course_id and c.shared)))
$$;

-- "Forked by" on an original lesson's page: who, which class, when. state is
-- 'ASSIGNED' once the forker has taught it, 'DRAFT' only for the forker's own
-- fork, and null otherwise, so nobody else ever sees someone's draft.
create function lesson_forks(p_lesson uuid)
returns table (fork_id uuid, forker_id uuid, forker_name text, class_name text, section text,
               created_at timestamptz, state text)
language sql stable security definer set search_path = public
as $$
  select f.id,
         f.forker_id,
         coalesce(u.name, u.email),
         c.name,
         c.section,
         f.created_at,
         case when fl.classroom_state = 'PUBLISHED' then 'ASSIGNED'
              when f.forker_id = auth.uid() then 'DRAFT'
              else null end
    from forks f
    join lessons l on l.id = f.root_lesson_id
    join users u on u.id = f.forker_id
    join courses c on c.id = f.target_course_id
    left join lessons fl on fl.fork_id = f.id
   where f.root_lesson_id = p_lesson
     and f.removed_at is null
     and f.status in ('done','partial')
     and l.kind = 'original'
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
