-- Draw newly registered cohorts without changing existing pairings.
create or replace function public.ss_assign_pending(p_event_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $function$
declare
  v_status text;
  v_people uuid[];
  v_count integer;
  i integer;
begin
  -- Serializes event-level registration and assignment.
  select status into v_status from public.ss_events
  where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Assignments are closed for this event';
  end if;

  -- No active member may be only a Santa or only a Child.
  if exists (
    select 1 from public.ss_participants p
    where p.event_id=p_event_id and p.is_active
    and (
      exists (select 1 from public.ss_assignments a
        where a.event_id=p_event_id and a.santa_id=p.id)
      <>
      exists (select 1 from public.ss_assignments a
        where a.event_id=p_event_id and a.child_id=p.id)
    )
  ) then raise exception 'Existing assignments are inconsistent'; end if;

  select array_agg(p.id order by random()) into v_people
  from public.ss_participants p
  where p.event_id=p_event_id and p.is_active
    and not exists (
      select 1 from public.ss_assignments a
      where a.event_id=p_event_id
      and (a.santa_id=p.id or a.child_id=p.id)
    );

  v_count:=coalesce(array_length(v_people,1),0);
  if v_count=0 then return 0; end if;
  if v_count=1 then
    raise exception 'One participant is awaiting assignment; add another newcomer to draw';
  end if;

  -- Each cohort is a closed directed cycle: everyone gives and receives once.
  for i in 1..v_count loop
    insert into public.ss_assignments(event_id,santa_id,child_id)
    values (p_event_id,v_people[i],v_people[(i % v_count)+1]);
  end loop;

  update public.ss_events set
    assignments_locked_at=coalesce(assignments_locked_at,now()),
    updated_at=now()
  where id=p_event_id;
  return v_count;
end;
$function$;

-- Permit participants after the first draw; closed events remain immutable.
create or replace function public.ss_register_participant(
  p_event_id uuid, p_display_name text, p_desk_key text,
  p_code_fingerprint text
) returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare
  v_id uuid;
  v_status text;
begin
  select status into v_status from public.ss_events
  where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Participant registration is closed for this event'; end if;
  if length(btrim(coalesce(p_display_name,''))) not between 1 and 160
    then raise exception 'Invalid name'; end if;
  if length(coalesce(p_desk_key,''))>30
    then raise exception 'Invalid desk'; end if;
  if length(coalesce(p_code_fingerprint,''))<32
    then raise exception 'Invalid invitation fingerprint'; end if;
  if (select count(*) from public.ss_participants where event_id=p_event_id)>=150
    then raise exception 'Participant capacity reached'; end if;

  insert into public.ss_participants(event_id,display_name,desk_key)
  values (p_event_id,btrim(p_display_name),nullif(btrim(coalesce(p_desk_key,'')),''))
  returning id into v_id;
  insert into public.ss_participant_private(event_id,participant_id)
  values(p_event_id,v_id);
  insert into public.ss_access_codes(event_id,participant_id,code_fingerprint)
  values(p_event_id,v_id,p_code_fingerprint);
  return v_id;
end;
$function$;

revoke all on function public.ss_assign_pending(uuid)
from public,anon,authenticated;
grant execute on function public.ss_assign_pending(uuid) to service_role;
revoke all on function public.ss_register_participant(uuid,text,text,text)
from public,anon,authenticated;
grant execute on function public.ss_register_participant(uuid,text,text,text)
to service_role;