-- v4.5.5: mantener la expansión geográfica guardada pero fuera del flujo activo.
-- Solo Iquique, Tarapacá queda activo. Las demás unidades se conservan para el futuro.

update public.church_units
set is_active = false
where not (
  upper(coalesce(country_code,'')) = 'CL'
  and lower(trim(coalesce(city,''))) = 'iquique'
);

update public.church_units
set country_code = 'CL',
    city = 'Iquique',
    region = 'Tarapacá',
    is_active = true
where upper(coalesce(country_code,'')) = 'CL'
  and lower(trim(coalesce(city,''))) = 'iquique';

update public.church_meetinghouses
set region = 'Tarapacá'
where upper(coalesce(country_code,'')) = 'CL'
  and lower(trim(coalesce(city,''))) = 'iquique';

update public.church_directory_places
set region = 'Tarapacá'
where upper(coalesce(country_code,'')) = 'CL'
  and lower(trim(coalesce(city_name,''))) = 'iquique';
