-- v4.1 testing: cache official ward/branch pages discovered from the public sitemap.
-- Service-role Edge Function writes this table; clients do not need direct write access.

create table if not exists public.church_directory_unit_index (
  official_url text primary key,
  country_code text not null check (char_length(country_code)=2),
  unit_slug text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending','synced','error')),
  last_error text,
  discovered_at timestamptz not null default now(),
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.church_directory_unit_index enable row level security;

create index if not exists church_directory_unit_index_country_status_idx
  on public.church_directory_unit_index(country_code,sync_status,updated_at);

create index if not exists church_directory_unit_index_slug_idx
  on public.church_directory_unit_index(country_code,unit_slug);

comment on table public.church_directory_unit_index is
  'Server-side cache of public local.churchofjesuschrist.org ward/branch URLs used to populate church_units.';
