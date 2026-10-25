-- Lesson hub, batch B (C1 card pictures). Run once in the Supabase SQL editor of the
-- "fork-lesson" project, after 0006. All or nothing.
--
--   - attachments: where the card picture is stored, which Drive version it came from,
--     and when we last looked for one.
--   - "thumbnails": private storage bucket, read and written only by the server (admin client).
begin;
alter table attachments
  add column thumbnail_path text,             -- object in the private "thumbnails" bucket
  add column thumbnail_version text,          -- Drive thumbnailVersion, for cache busting
  add column thumbnail_checked_at timestamptz;
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', false);
-- no storage.objects policies: only the server (admin client) reads or writes the bucket
commit;
