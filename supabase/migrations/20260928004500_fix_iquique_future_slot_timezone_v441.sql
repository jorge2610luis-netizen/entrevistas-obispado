-- v4.4.1: reinterpretar los horarios futuros de Iquique que fueron
-- creados cuando el frontend todavía usaba America/La_Paz.
-- Conserva la misma hora de pared elegida por el administrador,
-- pero la almacena con la zona correcta America/Santiago.

update public.availability a
set
  start_at = (a.start_at at time zone 'America/La_Paz') at time zone 'America/Santiago',
  end_at   = (a.end_at   at time zone 'America/La_Paz') at time zone 'America/Santiago'
from public.church_units u
where u.id = a.church_unit_id
  and upper(coalesce(u.country_code,'')) = 'CL'
  and lower(trim(coalesce(u.city,''))) = 'iquique'
  and a.start_at > now();
