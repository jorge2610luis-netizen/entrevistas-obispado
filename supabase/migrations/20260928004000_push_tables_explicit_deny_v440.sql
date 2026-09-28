drop policy if exists push_subscriptions_no_direct_access on public.push_subscriptions;
create policy push_subscriptions_no_direct_access
on public.push_subscriptions
for all
to authenticated
using (false)
with check (false);

drop policy if exists push_events_no_direct_access on public.push_events;
create policy push_events_no_direct_access
on public.push_events
for all
to authenticated
using (false)
with check (false);

drop policy if exists push_configuration_no_direct_access on public.push_configuration;
create policy push_configuration_no_direct_access
on public.push_configuration
for all
to authenticated
using (false)
with check (false);
