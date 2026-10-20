-- Run once in the Supabase SQL editor.
create table public.daily_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null check (date between '1901-01-01' and '2100-12-31'),
  text text not null check (char_length(text) <= 20000),
  deleted boolean not null default false,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.daily_notes enable row level security;
create policy own_notes on public.daily_notes for select to authenticated
  using ((select auth.uid()) = user_id);
-- Clients can read their own rows; only the version-checking function can write.
revoke all on public.daily_notes from anon, authenticated;
grant select on public.daily_notes to authenticated;

create function public.sync_daily_note(p_date date, p_text text, p_deleted boolean, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  existing public.daily_notes;
  result public.daily_notes;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if p_date is null or p_text is null or p_deleted is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid note';
  end if;
  -- Serialize even the first insert for a user's date.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_date::text, 0));
  select * into existing from public.daily_notes where user_id = uid and date = p_date;
  if coalesce(existing.revision, 0) <> p_revision then
    return jsonb_build_object('conflict', true, 'note', to_jsonb(existing));
  end if;
  insert into public.daily_notes(user_id, date, text, deleted, revision)
    values(uid, p_date, p_text, p_deleted, 1)
  on conflict (user_id, date) do update
    set text = excluded.text, deleted = excluded.deleted,
        revision = public.daily_notes.revision + 1, updated_at = now()
  returning * into result;
  return jsonb_build_object('conflict', false, 'note', to_jsonb(result));
end;
$$;
revoke all on function public.sync_daily_note(date,text,boolean,bigint) from public, anon;
grant execute on function public.sync_daily_note(date,text,boolean,bigint) to authenticated;

-- Return the complete account snapshot, including deletion markers.
create function public.read_daily_notes() returns jsonb
language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
  from public.daily_notes n where user_id = auth.uid();
$$;
revoke all on function public.read_daily_notes() from public, anon;
grant execute on function public.read_daily_notes() to authenticated;
commit;
begin;
