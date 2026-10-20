-- Run against a disposable/test Supabase project after schema.sql.
-- Any failed assertion aborts; all fixtures are rolled back.
begin;
insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111111', 'daymark-test-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'daymark-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  r := public.sync_daily_note('2026-10-20', 'Alice', false, 0);
  assert (r->>'conflict')::boolean = false;
  assert (r->'note'->>'revision')::int = 1;
  r := public.sync_daily_note('2026-10-20', 'Stale write', false, 0);
  assert (r->>'conflict')::boolean = true;
  assert r->'note'->>'text' = 'Alice';
  assert jsonb_array_length(public.read_daily_notes()) = 1;
  begin
    insert into public.daily_notes(user_id,date,text)
      values ('22222222-2222-4222-8222-222222222222','2026-10-20','Forged');
    raise exception 'Direct writes unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  assert jsonb_array_length(public.read_daily_notes()) = 0;
  assert (select count(*) from public.daily_notes) = 0;
  r := public.sync_daily_note('2026-10-20', 'Bob', false, 0);
  assert r->'note'->>'text' = 'Bob';
  assert (r->'note'->>'revision')::int = 1;
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  assert (select text from public.daily_notes) = 'Alice';
  r := public.sync_daily_note('2026-10-20', '', true, 1);
  assert (r->'note'->>'deleted')::boolean;
  assert (r->'note'->>'revision')::int = 2;
  r := public.sync_daily_note('2026-10-20', 'Resurrection', false, 1);
  assert (r->>'conflict')::boolean;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.read_daily_notes();
    raise exception 'Anonymous reads unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.sync_daily_note('2026-10-20','Anonymous',false,0);
    raise exception 'Anonymous writes unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'PASS: owner isolation, revision checks, deletion conflicts, anonymous access denied; fixtures rolled back' as verification;
