-- Suivi createur : derniere activite connue des ecoles.
-- A executer dans Supabase SQL Editor avant/de pair avec la version v48.

do $$
begin
  if to_regclass('public.sessions') is not null then
    alter table public.sessions
      add column if not exists last_seen_at timestamptz;

    update public.sessions
       set last_seen_at = coalesce(last_seen_at, created_at, now())
     where last_seen_at is null;

    create index if not exists sessions_last_seen_at_idx
      on public.sessions(last_seen_at desc);

    create index if not exists sessions_auth_uid_last_seen_idx
      on public.sessions(auth_uid, last_seen_at desc);
  end if;
end $$;
