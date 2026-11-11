-- rls-check.sql — Proves one student can't reach another student's synced data (Row Level Security).
-- Run in Neon's SQL Editor (whole file at once), after sync.sql. It changes nothing: everything
-- happens inside one transaction that is rolled back at the end.
--
-- How: it acts as two signed-in students, A and B, the way the Data API does (role "authenticated"
-- plus the sign-in's user id), saves a record and a key for each, then, as B, tries to read,
-- change, delete, take over and overwrite A's rows. It also checks that someone not signed in
-- sees nothing. Result: a table where every row says PASS. Any failure stops with "RLS CHECK FAILED: …".

begin;

create temp table rls_check (step int, what text, result text) on commit drop;

do $$
declare
  n int;
  failed boolean;
  guest text := (select rolname from pg_roles where rolname in ('anonymous', 'anon') limit 1);
  passed text[] := '{}'; -- results are written to rls_check at the end, as the editor's own role
begin
  -- Act as a signed-in student: the Data API's role plus the sign-in's user id (request.jwt.claims).
  set local role authenticated;

  -- 0–1. A saves a record and a key; the server fills in the user id from the sign-in.
  -- auth.user_id() is never called by name here: students may run it (the saved rules and
  -- defaults do) but not look up its schema, exactly like real requests. If the editor can't
  -- act as a student (pg_session_jwt reads request.jwt.claims only when no signing key is set),
  -- the user id is empty, the rules refuse the save, and the check stops: nothing was tested.
  perform set_config('request.jwt.claims', '{"sub":"rls-check-a","role":"authenticated"}', true);
  begin
    insert into sync_records (id, type, v, iv, ciphertext) values ('rls-check-a1', 'transaction', 1, 'aXY=', 'QQ==');
    insert into sync_keys (dek) values ('a-key');
  exception when insufficient_privilege or not_null_violation then
    raise exception 'RLS CHECK STOPPED: this editor can''t act as a student (%). Nothing was tested; no data is exposed by this.', sqlerrm;
  end;
  passed := array_append(passed, 'Acting as student A works');
  if (select user_id from sync_records where id = 'rls-check-a1') is distinct from 'rls-check-a' then
    raise exception 'RLS CHECK FAILED: the server didn''t stamp A''s own user id on A''s record';
  end if;
  passed := array_append(passed, 'A saves own record and key; server stamps A''s id');

  -- 2. B saves its own
  perform set_config('request.jwt.claims', '{"sub":"rls-check-b","role":"authenticated"}', true);
  insert into sync_records (id, type, v, iv, ciphertext) values ('rls-check-b1', 'transaction', 1, 'aXY=', 'Qg==');
  insert into sync_keys (dek) values ('b-key');

  -- 3. B can't see A's rows
  select count(*) into n from sync_records where user_id = 'rls-check-a' or id = 'rls-check-a1';
  if n <> 0 then raise exception 'RLS CHECK FAILED: B can see % of A''s records', n; end if;
  select count(*) into n from sync_keys where user_id = 'rls-check-a';
  if n <> 0 then raise exception 'RLS CHECK FAILED: B can see A''s key'; end if;
  select count(*) into n from sync_records where id like 'rls-check-%';
  if n <> 1 then raise exception 'RLS CHECK FAILED: B should see exactly its own 1 test record, saw %', n; end if;
  passed := array_append(passed, 'B sees only its own record and key, none of A''s');

  -- 4. B can't change or delete A's rows
  update sync_records set ciphertext = 'aGFja2Vk' where user_id = 'rls-check-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS CHECK FAILED: B changed % of A''s records', n; end if;
  update sync_keys set dek = 'stolen' where user_id = 'rls-check-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS CHECK FAILED: B changed A''s key'; end if;
  delete from sync_records where user_id = 'rls-check-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS CHECK FAILED: B deleted % of A''s records', n; end if;
  delete from sync_keys where user_id = 'rls-check-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS CHECK FAILED: B deleted A''s key'; end if;
  passed := array_append(passed, 'B can''t change or delete A''s records or key');

  -- 5. B can't write rows in A's name (plant a record, overwrite A's key, or hand its own row to A)
  failed := false;
  begin
    insert into sync_records (user_id, id, type, v) values ('rls-check-a', 'rls-check-evil', 'transaction', 1);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'RLS CHECK FAILED: B saved a record in A''s name'; end if;
  failed := false;
  begin
    insert into sync_keys (user_id, dek) values ('rls-check-a', 'evil-key') on conflict (user_id) do update set dek = excluded.dek;
  exception when insufficient_privilege or unique_violation then failed := true;
  end;
  if not failed then raise exception 'RLS CHECK FAILED: B overwrote A''s key'; end if;
  failed := false;
  begin
    update sync_records set user_id = 'rls-check-a' where id = 'rls-check-b1';
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'RLS CHECK FAILED: B moved its record into A''s account'; end if;
  passed := array_append(passed, 'B can''t write in A''s name (new record, key, or moving a row)');

  -- 6. A's data is untouched
  perform set_config('request.jwt.claims', '{"sub":"rls-check-a","role":"authenticated"}', true);
  if (select ciphertext from sync_records where id = 'rls-check-a1') is distinct from 'QQ==' then
    raise exception 'RLS CHECK FAILED: A''s record was changed';
  end if;
  if (select dek from sync_keys where user_id = 'rls-check-a') is distinct from 'a-key' then
    raise exception 'RLS CHECK FAILED: A''s key was changed';
  end if;
  passed := array_append(passed, 'A''s record and key are unchanged');

  -- 7. Signed in but with no user id: sees nothing
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  select count(*) into n from sync_records where id like 'rls-check-%';
  if n <> 0 then raise exception 'RLS CHECK FAILED: a sign-in without a user id sees % records', n; end if;
  passed := array_append(passed, 'A sign-in without a user id sees nothing');

  -- 8. Rules are on, and nobody but signed-in students has a rule that shows rows
  reset role;
  if exists (select 1 from pg_class where oid in ('public.sync_records'::regclass, 'public.sync_keys'::regclass) and not relrowsecurity) then
    raise exception 'RLS CHECK FAILED: Row Level Security is off on a sync table';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('sync_records', 'sync_keys')
             and not (roles = array['authenticated']::name[])) then
    raise exception 'RLS CHECK FAILED: a rule on the sync tables applies to someone other than signed-in students';
  end if;
  passed := array_append(passed, 'Row Level Security is on; only signed-in students have rules');

  -- 9. Not signed in (guest role): no rights on the tables, or rights but no rule that shows a row
  if guest is null or not (has_table_privilege(guest, 'public.sync_records', 'select, insert, update, delete')
                           or has_table_privilege(guest, 'public.sync_keys', 'select, insert, update, delete')) then
    passed := array_append(passed, 'Not signed in: no access to the sync tables');
  else
    passed := array_append(passed, format('Not signed in (%s): table rights exist, but no rule shows it a row', guest));
  end if;

  insert into rls_check select i, w, 'PASS' from unnest(passed) with ordinality as p(w, i);
end $$;

select step, what, result from rls_check order by step;

rollback; -- nothing above is kept
