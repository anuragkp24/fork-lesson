-- Lesson hub, batch A (H4 + C2 + C3). Run once in the Supabase SQL editor of the
-- "fork-lesson" project, after 0005. All or nothing.
--
--   - lesson_tag_counts: anonymous tag counts for many lessons at once.
--   - lesson_fork_counts: adds thanks / new_thanks (the author only).
--   - mark_thanks_seen: the author clears the "new" dot.
--   - my_thanks_sent: which of my own forks I've already thanked for.
--   - saved_lessons: Save for later, own rows only, guarded by row level security.
begin;

-- H4 + C3: how many forkers picked each tag, per lesson. No names, notes or fork ids.
-- Same "can the caller see this original" rule as lesson_fork_counts.
create function lesson_tag_counts(ids uuid[])
returns table (lesson_id uuid, tag text, n int)
language sql stable security definer set search_path = public
as $$
  select f.lesson_id, t.tag, count(*)::int
    from fork_shoutouts s
    join forks f on f.id = s.fork_id
    join lessons l on l.id = f.lesson_id
    cross join lateral unnest(s.tags) as t(tag)
   where f.lesson_id = any(ids)
     and f.removed_at is null
     and f.status in ('done','partial')
     and l.kind = 'original'
     and (l.owner_id = auth.uid()
          or (l.domain = my_domain() and not l.hidden
              and exists (select 1 from courses c where c.id = l.course_id and c.shared)))
   group by f.lesson_id, t.tag
$$;

-- C3: the author's private thank-you count, and which ones are new.
alter table fork_shoutouts add column seen_by_author_at timestamptz;

-- thanks / new_thanks: shout-outs on forks of the lesson (new = not yet seen by the
-- author). Null unless the caller owns the lesson, like taught.
drop function lesson_fork_counts(uuid[]);

create function lesson_fork_counts(ids uuid[])
returns table (lesson_id uuid, forks int, versions int, taught int, thanks int, new_thanks int)
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
         end,
         case when l.owner_id = auth.uid() then
           (select count(*)::int from fork_shoutouts s
              join forks f on f.id = s.fork_id
             where f.lesson_id = l.id and f.removed_at is null and f.status in ('done','partial'))
         end,
         case when l.owner_id = auth.uid() then
           (select count(*)::int from fork_shoutouts s
              join forks f on f.id = s.fork_id
             where f.lesson_id = l.id and f.removed_at is null and f.status in ('done','partial')
               and s.seen_by_author_at is null)
         end
    from lessons l
   where l.id = any(ids)
     and l.kind = 'original'
     and (l.owner_id = auth.uid()
          or (l.domain = my_domain() and not l.hidden
              and exists (select 1 from courses c where c.id = l.course_id and c.shared)))
$$;

-- The author opened her lesson: its unseen shout-outs are now seen. Does nothing
-- for anyone who doesn't own the lesson.
create function mark_thanks_seen(p_lesson uuid)
returns void
language sql volatile security definer set search_path = public
as $$
  update fork_shoutouts s
     set seen_by_author_at = now()
    from forks f, lessons l
   where f.id = s.fork_id
     and f.lesson_id = p_lesson
     and l.id = p_lesson
     and l.owner_id = auth.uid()
     and s.seen_by_author_at is null
$$;

-- C3: which of my forks I've already thanked for. Only the caller's own forks.
-- A function rather than a read policy, so a forker can never see whether the
-- author has opened her thanks.
create function my_thanks_sent(fork_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select s.fork_id
    from fork_shoutouts s
    join forks f on f.id = s.fork_id
   where s.fork_id = any(fork_ids)
     and f.forker_id = auth.uid()
$$;

-- C2: Save for later. Own rows only.
create table saved_lessons (
  user_id uuid not null default auth.uid() references users on delete cascade,
  lesson_id uuid not null references lessons on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table saved_lessons enable row level security;

create policy saved_read on saved_lessons for select to authenticated
  using (user_id = auth.uid());
create policy saved_insert on saved_lessons for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from lessons l                       -- lessons policy applies: must be visible
               where l.id = lesson_id and l.kind = 'original' and l.owner_id <> auth.uid()));
create policy saved_delete on saved_lessons for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on saved_lessons to authenticated;

revoke execute on function lesson_tag_counts(uuid[]) from public, anon;
revoke execute on function lesson_fork_counts(uuid[]) from public, anon;
revoke execute on function mark_thanks_seen(uuid) from public, anon;
revoke execute on function my_thanks_sent(uuid[]) from public, anon;
grant execute on function lesson_tag_counts(uuid[]) to authenticated;
grant execute on function lesson_fork_counts(uuid[]) to authenticated;
grant execute on function mark_thanks_seen(uuid) to authenticated;
grant execute on function my_thanks_sent(uuid[]) to authenticated;

commit;
