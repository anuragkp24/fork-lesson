-- Auto sync. Run once in the Supabase SQL editor of the "fork-lesson" project, after 0007.
-- All or nothing.
--
--   - sync_state.last_trigger: what started the last run ('manual' | 'visit' | 'nightly'),
--     so the data shows what actually runs.
--   - courses.share_decided: has the teacher answered "share this class?". Auto-sync reads
--     undecided classes but does not publish their Drive files until it is true.
--     Every class that exists today counts as decided, so the demo data keeps working.
--
-- Plain columns only: no new tables, foreign keys or constraints, so PostgREST embeds are unchanged.
begin;
alter table sync_state
  add column last_trigger text check (last_trigger in ('manual','visit','nightly'));
alter table courses
  add column share_decided boolean not null default false;
update courses set share_decided = true;
commit;
