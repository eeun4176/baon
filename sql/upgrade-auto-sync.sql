-- upgrade-auto-sync.sql — Run ONCE in Neon's SQL Editor, BEFORE sync.sql, if the database had the
-- older opt-in sync (key locked with a recovery code). Sync is now automatic and keeps the account
-- key as is, so the old keys and the records under them are cleared. Nothing is lost: every device
-- keeps its records and uploads them again on its next sync (the first device to open baon sets the key).
drop table if exists public.sync_keys;
truncate table public.sync_records;
