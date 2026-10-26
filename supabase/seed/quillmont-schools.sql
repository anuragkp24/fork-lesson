-- Quillmont demo schools. Run once in the Supabase SQL editor of the "fork-lesson" project,
-- after 0009. Safe to run again: existing names are skipped.
begin;
insert into schools (domain, name) values
  ('gedu.demo.edstitch.com', 'Central Middle School'),
  ('gedu.demo.edstitch.com', 'Westview Middle School'),
  ('gedu.demo.edstitch.com', 'Quillmont High School')
on conflict do nothing;
select name from schools where domain = 'gedu.demo.edstitch.com' order by name;  -- 3 rows
commit;
