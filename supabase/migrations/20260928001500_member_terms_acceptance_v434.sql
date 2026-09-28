alter table public.member_profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.member_profiles.terms_version is
  'Version of the Terms and Conditions accepted when the member account was created.';
comment on column public.member_profiles.terms_accepted_at is
  'Server timestamp recording acceptance of the Terms and Conditions.';

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_member_phone text;
  v_terms_version text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'),''),
    nullif(trim(new.raw_user_meta_data ->> 'name'),''),
    nullif(split_part(coalesce(new.email,''), '@', 1),''),
    'Usuario'
  );

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, v_name)
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data ->> 'account_type','') = 'member' then
    if coalesce(new.raw_user_meta_data ->> 'terms_accepted','false') <> 'true' then
      raise exception 'Terms and Conditions acceptance is required';
    end if;

    v_terms_version := nullif(trim(new.raw_user_meta_data ->> 'terms_version'),'');
    if v_terms_version is null or v_terms_version <> '2026-09-27-v1' then
      raise exception 'Current Terms and Conditions version must be accepted';
    end if;

    v_member_phone := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'phone_e164'),''),
      nullif(trim(new.phone),'')
    );

    if v_member_phone is not null then
      insert into public.member_profiles (
        id,
        phone,
        full_name,
        terms_version,
        terms_accepted_at
      )
      values (
        new.id,
        v_member_phone,
        v_name,
        v_terms_version,
        now()
      )
      on conflict (id) do update
        set phone = excluded.phone,
            full_name = excluded.full_name,
            terms_version = coalesce(public.member_profiles.terms_version, excluded.terms_version),
            terms_accepted_at = coalesce(public.member_profiles.terms_accepted_at, excluded.terms_accepted_at),
            updated_at = now();
    end if;
  end if;

  return new;
end;
$function$;
