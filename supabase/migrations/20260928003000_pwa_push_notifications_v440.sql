create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 20 and 2048),
  constraint push_subscriptions_p256dh_length check (char_length(p256dh) between 20 and 512),
  constraint push_subscriptions_auth_length check (char_length(auth_key) between 8 and 256)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_endpoint is null or char_length(trim(p_endpoint)) not between 20 and 2048 then
    raise exception 'Invalid push endpoint';
  end if;
  if p_p256dh is null or char_length(trim(p_p256dh)) not between 20 and 512 then
    raise exception 'Invalid push key';
  end if;
  if p_auth is null or char_length(trim(p_auth)) not between 8 and 256 then
    raise exception 'Invalid push auth key';
  end if;

  delete from public.push_subscriptions
  where endpoint = trim(p_endpoint)
    and user_id <> v_uid;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth_key, user_agent, updated_at
  )
  values (
    v_uid,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth),
    nullif(left(coalesce(p_user_agent,''),500),''),
    now()
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        updated_at = now();

  return true;
end;
$function$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  delete from public.push_subscriptions
  where endpoint = trim(p_endpoint)
    and user_id = v_uid;

  return true;
end;
$function$;

create or replace function public.push_subscription_registered(p_endpoint text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.push_subscriptions ps
    where ps.user_id = (select auth.uid())
      and ps.endpoint = trim(p_endpoint)
  );
$function$;

revoke all on function public.register_push_subscription(text,text,text,text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
revoke all on function public.push_subscription_registered(text) from public, anon;

grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.push_subscription_registered(text) to authenticated;

create or replace function public.push_vapid_private_key()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = 'push_vapid_private_key'
  order by ds.updated_at desc
  limit 1;
$function$;

create or replace function public.push_dispatch_secret_value()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = 'push_dispatch_secret'
  order by ds.updated_at desc
  limit 1;
$function$;

revoke all on function public.push_vapid_private_key() from public, anon, authenticated;
revoke all on function public.push_dispatch_secret_value() from public, anon, authenticated;
grant execute on function public.push_vapid_private_key() to service_role;
grant execute on function public.push_dispatch_secret_value() to service_role;

create or replace function private.dispatch_appointment_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_secret text;
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'created';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_event_type := 'status_changed';
  else
    return new;
  end if;

  select ds.decrypted_secret
    into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'push_dispatch_secret'
  order by ds.updated_at desc
  limit 1;

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://gyyahvrkcjocqhhoslho.supabase.co/functions/v1/push-notifications',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-push-secret',v_secret
    ),
    body := jsonb_build_object(
      'appointment_id',new.id,
      'event_type',v_event_type,
      'status',new.status
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning 'push dispatch failed: %', sqlerrm;
    return new;
end;
$function$;

drop trigger if exists appointments_push_notify on public.appointments;
create trigger appointments_push_notify
after insert or update of status on public.appointments
for each row execute function private.dispatch_appointment_push();
