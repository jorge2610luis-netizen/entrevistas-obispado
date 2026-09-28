-- v4.5.0: GPS lookup is constrained to the detected/selected city.
-- This prevents a location search from scanning the national catalog.
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
set search_path = ''
as $$
  with candidates as (
    select
      u.id as unit_id,
      u.unit_name,
      u.unit_type,
      m.id as meetinghouse_id,
      coalesce(u.meetinghouse_name, m.name) as meetinghouse_name,
      coalesce(u.address, m.address) as address,
      coalesce(u.city, m.city) as city,
      coalesce(u.region, m.region) as region,
      coalesce(u.country_code, m.country_code) as country_code,
      u.sunday_service,
      u.official_url,
      coalesce(u.latitude, m.latitude) as latitude,
      coalesce(u.longitude, m.longitude) as longitude,
      public.safe_boundary_contains(u.boundary_geojson, p_lat, p_lon) as boundary_match,
      case
        when coalesce(u.latitude, m.latitude) is null
          or coalesce(u.longitude, m.longitude) is null
          or p_lat is null
          or p_lon is null then null
        else 6371.0088 * 2 * asin(
          least(
            1.0,
            sqrt(
              power(sin(radians(coalesce(u.latitude, m.latitude) - p_lat) / 2), 2)
              + cos(radians(p_lat))
              * cos(radians(coalesce(u.latitude, m.latitude)))
              * power(sin(radians(coalesce(u.longitude, m.longitude) - p_lon) / 2), 2)
            )
          )
        )
      end as distance_km
    from public.church_units u
    left join public.church_meetinghouses m on m.id = u.meetinghouse_id
    where u.is_active = true
      and p_city is not null
      and trim(p_city) <> ''
      and lower(trim(coalesce(u.city, m.city, ''))) = lower(trim(p_city))
      and (
        p_country_code is null
        or trim(p_country_code) = ''
        or upper(coalesce(u.country_code, m.country_code, '')) = upper(trim(p_country_code))
      )
  )
  select
    unit_id, unit_name, unit_type, meetinghouse_id, meetinghouse_name,
    address, city, region, country_code, sunday_service, official_url,
    latitude, longitude, boundary_match, distance_km,
    case
      when boundary_match then 'boundary'
      when distance_km is not null then 'city_nearest_meetinghouse'
      else 'city_catalog'
    end as match_method,
    case
      when boundary_match then 'exact'
      when distance_km is not null and distance_km <= 15 then 'high'
      else 'city'
    end as confidence
  from candidates
  order by boundary_match desc, distance_km asc nulls last, unit_name
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

revoke all on function public.find_church_units_by_location(double precision, double precision, text, text, integer) from public;
grant execute on function public.find_church_units_by_location(double precision, double precision, text, text, integer) to authenticated;
