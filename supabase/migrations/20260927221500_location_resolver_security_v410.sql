-- v4.1.0 production hardening: location resolver must honor RLS.
alter function public.find_church_units_by_location(
  double precision,
  double precision,
  text,
  text,
  integer
) security invoker;

revoke all on function public.find_church_units_by_location(
  double precision,
  double precision,
  text,
  text,
  integer
) from public, anon;

grant execute on function public.find_church_units_by_location(
  double precision,
  double precision,
  text,
  text,
  integer
) to authenticated;
