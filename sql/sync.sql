-- sync.sql — Online copies for "Sync across devices" (src/sync/), always on for signed-in students.
-- Run once in Neon's SQL Editor, AFTER turning on the Data API for this database.
-- (Had the older opt-in sync? Run upgrade-auto-sync.sql first.)
-- Records are stored scrambled; the account key is stored next to them so any device the
-- student signs in on can open them. Row Level Security lets each user reach only their own rows.
-- Safe to run again: everything is "if not exists" / replaced.

-- One row per record. iv + ciphertext are base64 of exactly what the phone stores.
create table if not exists public.sync_records (
  user_id    text        not null default (auth.user_id()),
  id         text        not null check (length(id) <= 200),
  type       text        not null check (length(type) <= 40),
  v          integer     not null,
  iv         text        not null default '' check (length(iv) <= 64),
  ciphertext text        not null default '' check (length(ciphertext) <= 700000),
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists sync_records_changes on public.sync_records (user_id, updated_at, id);

-- The server stamps every write, so a device can ask "what changed since I last looked?".
create or replace function public.sync_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists sync_records_touch on public.sync_records;
create trigger sync_records_touch before insert or update on public.sync_records
  for each row execute function public.sync_touch();

-- The account's key (base64 of 32 bytes): the first device to sync saves it, the others use it.
create table if not exists public.sync_keys (
  user_id    text primary key default (auth.user_id()),
  dek        text not null check (length(dek) <= 64),
  updated_at timestamptz not null default clock_timestamp()
);

-- Each signed-in user can read and change only their own rows.
alter table public.sync_records enable row level security;
alter table public.sync_keys enable row level security;

drop policy if exists "own records" on public.sync_records;
create policy "own records" on public.sync_records for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

drop policy if exists "own key" on public.sync_keys;
create policy "own key" on public.sync_keys for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

grant select, insert, update, delete on public.sync_records, public.sync_keys to authenticated;
