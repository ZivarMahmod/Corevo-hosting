-- Goal 69: read-only klassificering av explicita working_hour_slots.
-- Skriver ingenting. Returnerar bara aggregerade antal, inga kund-/personaluppgifter.
-- Kör före migration 0076 och spara resultatet i deployloggen.

with actual_groups as (
  select
    s.tenant_id,
    s.staff_id,
    s.location_id,
    s.weekday,
    array_agg(s.start_time order by s.start_time) as actual_times,
    count(*) as actual_count,
    extract(epoch from (max(s.created_at) - min(s.created_at))) <= 1 as bulk_created
  from public.working_hour_slots s
  where s.active
  group by s.tenant_id, s.staff_id, s.location_id, s.weekday
),
actual_deltas as (
  select
    s.tenant_id,
    s.staff_id,
    s.location_id,
    s.weekday,
    min(
      extract(epoch from (s.start_time - s.previous_time)) / 60
    ) filter (where s.previous_time is not null) as inferred_step_min
  from (
    select
      whs.*,
      lag(whs.start_time) over (
        partition by whs.tenant_id, whs.staff_id, whs.location_id, whs.weekday
        order by whs.start_time
      ) as previous_time
    from public.working_hour_slots whs
    where whs.active
  ) s
  group by s.tenant_id, s.staff_id, s.location_id, s.weekday
),
groups_with_steps as (
  select
    a.*,
    coalesce(st.slot_step_min, 15) as resolved_step_min,
    d.inferred_step_min::int as inferred_step_min
  from actual_groups a
  join public.staff st
    on st.id = a.staff_id
   and st.tenant_id = a.tenant_id
  left join actual_deltas d
    on d.tenant_id = a.tenant_id
   and d.staff_id = a.staff_id
   and d.location_id is not distinct from a.location_id
   and d.weekday = a.weekday
),
expected_resolved as (
  select
    g.tenant_id,
    g.staff_id,
    g.location_id,
    g.weekday,
    array_agg(gs::time order by gs::time) as expected_times
  from groups_with_steps g
  join public.working_hours wh
    on wh.tenant_id = g.tenant_id
   and wh.staff_id = g.staff_id
   and wh.location_id is not distinct from g.location_id
   and wh.weekday = g.weekday
  cross join lateral generate_series(
    date '2000-01-01' + wh.start_time,
    date '2000-01-01' + wh.end_time
      - make_interval(mins => g.resolved_step_min),
    make_interval(mins => g.resolved_step_min)
  ) gs
  group by g.tenant_id, g.staff_id, g.location_id, g.weekday
),
expected_inferred as (
  select
    g.tenant_id,
    g.staff_id,
    g.location_id,
    g.weekday,
    array_agg(gs::time order by gs::time) as expected_times
  from groups_with_steps g
  join public.working_hours wh
    on wh.tenant_id = g.tenant_id
   and wh.staff_id = g.staff_id
   and wh.location_id is not distinct from g.location_id
   and wh.weekday = g.weekday
  cross join lateral generate_series(
    date '2000-01-01' + wh.start_time,
    date '2000-01-01' + wh.end_time
      - make_interval(mins => g.inferred_step_min),
    make_interval(mins => g.inferred_step_min)
  ) gs
  where g.inferred_step_min between 1 and 240
  group by g.tenant_id, g.staff_id, g.location_id, g.weekday
),
classified as (
  select
    g.*,
    case
      when g.actual_times = r.expected_times
        then 'full_resolved_grid'
      when g.bulk_created and g.actual_times = i.expected_times
        then 'full_uniform_grid_review'
      else 'irregular_special_review'
    end as classification
  from groups_with_steps g
  left join expected_resolved r
    on r.tenant_id = g.tenant_id
   and r.staff_id = g.staff_id
   and r.location_id is not distinct from g.location_id
   and r.weekday = g.weekday
  left join expected_inferred i
    on i.tenant_id = g.tenant_id
   and i.staff_id = g.staff_id
   and i.location_id is not distinct from g.location_id
   and i.weekday = g.weekday
)
select
  classification,
  count(*) as staff_days,
  sum(actual_count) as slot_rows
from classified
group by classification
order by classification;

select
  count(*) as cross_tenant_staff_services
from public.staff_services ss
join public.staff st on st.id = ss.staff_id
join public.services svc on svc.id = ss.service_id
where st.tenant_id <> ss.tenant_id
   or svc.tenant_id <> ss.tenant_id;

select
  count(*) as cross_location_staff_services
from public.staff_services ss
join public.staff st on st.id = ss.staff_id
join public.services svc on svc.id = ss.service_id
where svc.location_id is not null
  and st.location_id is distinct from svc.location_id;
