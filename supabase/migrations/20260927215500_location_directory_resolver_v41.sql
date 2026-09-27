-- v4.1 testing: GPS -> Barrio/Rama resolver for the official directory
-- This migration is additive. It does not change existing booking or auth flows.

create extension if not exists postgis with schema extensions;

create or replace function public.safe_boundary_contains(
  p_geojson jsonb,
  p_lat double precision,
  p_lon double precision
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_boundary extensions.geometry;
  v_point extensions.geometry;
begin
  if p_geojson is null or p_lat is null or p_lon is null then
    return false;
  end if;

  v_boundary := extensions.st_setsrid(
    extensions.st_geomfromgeojson(p_geojson::text),
    4326
  );
  v_point := extensions.st_setsrid(
    extensions.st_makepoint(p_lon, p_lat),
    4326
  );

  return extensions.st_covers(v_boundary, v_point);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.safe_boundary_contains(jsonb,double precision,double precision) from public;
grant execute on function public.safe_boundary_contains(jsonb,double precision,double precision) to authenticated;

create or replace function public.find_church_units_by_location(
  p_lat double precision,
  p_lon double precision,
  p_country_code text default null,
  p_city text default null,
  p_limit integer default 12
)
returns table(
  unit_id uuid,
  unit_name text,
  unit_type text,
  meetinghouse_id uuid,
  meetinghouse_name text,
  address text,
  city text,
  region text,
  country_code text,
  sunday_service text,
  official_url text,
  latitude double precision,
  longitude double precision,
  boundary_match boolean,
  distance_km double precision,
  match_method text,
  confidence text
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select
      u.id as unit_id,
      u.unit_name,
      u.unit_type,
      m.id as meetinghouse_id,
      coalesce(u.meetinghouse_name,m.name) as meetinghouse_name,
      coalesce(u.address,m.address) as address,
      coalesce(u.city,m.city) as city,
      coalesce(u.region,m.region) as region,
      coalesce(u.country_code,m.country_code) as country_code,
      u.sunday_service,
      u.official_url,
      coalesce(u.latitude,m.latitude) as latitude,
      coalesce(u.longitude,m.longitude) as longitude,
      public.safe_boundary_contains(u.boundary_geojson,p_lat,p_lon) as boundary_match,
      case
        when coalesce(u.latitude,m.latitude) is null
          or coalesce(u.longitude,m.longitude) is null then null
        else
          6371.0088 * 2 * asin(
            least(
              1.0,
              sqrt(
                power(sin(radians(coalesce(u.latitude,m.latitude)-p_lat)/2),2)
                + cos(radians(p_lat))
                * cos(radians(coalesce(u.latitude,m.latitude)))
                * power(sin(radians(coalesce(u.longitude,m.longitude)-p_lon)/2),2)
              )
            )
          )
      end as distance_km,
      (
        p_city is not null
        and trim(p_city) <> ''
        and lower(coalesce(u.city,m.city,'')) like '%' || lower(trim(p_city)) || '%'
      ) as city_match
    from public.church_units u
    left join public.church_meetinghouses m on m.id=u.meetinghouse_id
    where u.is_active=true
      and (
        p_country_code is null
        or trim(p_country_code)=''
        or upper(coalesce(u.country_code,m.country_code,''))=upper(trim(p_country_code))
      )
  )
  select
    unit_id,
    unit_name,
    unit_type,
    meetinghouse_id,
    meetinghouse_name,
    address,
    city,
    region,
    country_code,
    sunday_service,
    official_url,
    latitude,
    longitude,
    boundary_match,
    distance_km,
    case
      when boundary_match then 'boundary'
      when distance_km is not null then 'nearest_meetinghouse'
      when city_match then 'city_catalog'
      else 'catalog'
    end as match_method,
    case
      when boundary_match then 'exact'
      when distance_km is not null and distance_km <= 3 then 'high'
      when distance_km is not null and distance_km <= 15 then 'medium'
      else 'candidate'
    end as confidence
  from candidates
  where boundary_match
     or distance_km is not null
     or city_match
  order by
    boundary_match desc,
    city_match desc,
    distance_km asc nulls last,
    unit_name
  limit greatest(1,least(coalesce(p_limit,12),30));
$$;

revoke all on function public.find_church_units_by_location(double precision,double precision,text,text,integer) from public;
grant execute on function public.find_church_units_by_location(double precision,double precision,text,text,integer) to authenticated;

create index if not exists church_units_location_lookup_idx
  on public.church_units (country_code,city)
  where is_active=true;

create index if not exists church_meetinghouses_location_lookup_idx
  on public.church_meetinghouses (country_code,city)
  where is_active=true;
