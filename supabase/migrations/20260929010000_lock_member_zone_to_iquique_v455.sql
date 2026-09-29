-- v4.5.5: el flujo activo de miembros queda limitado a Iquique, Chile.
-- La expansión geográfica permanece guardada para el futuro.

create or replace function private.member_set_church_unit_internal(
  p_unit_name text,
  p_meetinghouse_name text,
  p_city text,
  p_country_code text,
  p_assignment_method text,
  p_church_unit_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_unit_name text;
  v_meetinghouse_name text;
  v_city text;
  v_country_code text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.member_profiles mp where mp.id=v_uid
  ) then
    raise exception 'Member account required';
  end if;

  if p_assignment_method not in ('nearby_meetinghouse','manual','boundary') then
    raise exception 'Invalid assignment method';
  end if;

  if p_church_unit_id is not null then
    select u.unit_name,u.meetinghouse_name,u.city,u.country_code
      into v_unit_name,v_meetinghouse_name,v_city,v_country_code
    from public.church_units u
    where u.id=p_church_unit_id
      and u.is_active=true
      and upper(coalesce(u.country_code,''))='CL'
      and lower(trim(coalesce(u.city,'')))='iquique';

    if v_unit_name is null then
      raise exception 'Invalid church unit for current zone';
    end if;
  else
    if p_unit_name is null
       or length(trim(p_unit_name))<2
       or length(trim(p_unit_name))>160 then
      raise exception 'Invalid unit name';
    end if;

    if p_meetinghouse_name is not null
       and length(trim(p_meetinghouse_name))>200 then
      raise exception 'Invalid meetinghouse name';
    end if;

    if upper(coalesce(trim(p_country_code),'')) <> 'CL'
       or lower(trim(coalesce(p_city,''))) <> 'iquique' then
      raise exception 'Current service area is Iquique, Tarapacá, Chile';
    end if;

    v_unit_name := trim(p_unit_name);
    v_meetinghouse_name := nullif(trim(coalesce(p_meetinghouse_name,'')),'');
    v_city := 'Iquique';
    v_country_code := 'CL';
  end if;

  update public.member_profiles
  set church_unit_id=p_church_unit_id,
      church_unit_name=v_unit_name,
      meetinghouse_name=v_meetinghouse_name,
      location_city=v_city,
      location_country_code=v_country_code,
      unit_assignment_method=p_assignment_method,
      unit_updated_at=now(),
      updated_at=now()
  where id=v_uid;

  return true;
end;
$function$;
