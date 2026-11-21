-- Reject ambiguous same-name Santa/Child assignments, including
-- different participant IDs with identical display names.
-- Existing pairings are immutable: only the pending cohort is drawn.
create or replace function public.ss_assign_pending(p_event_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $function$
declare
  v_status text;
  v_people uuid[];
  v_names text[];
  v_count integer;
  v_attempt integer;
  v_conflict boolean;
  i integer;
begin
  select status into v_status from public.ss_events
    where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Assignments are closed for this event';
  end if;

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
  ) then
    raise exception 'Existing Santa assignments are inconsistent';
  end if;

  for v_attempt in 1..250 loop
    with pending as materialized (
      select p.id,lower(btrim(p.display_name)) as normalized_name,
             random() as shuffle_key
      from public.ss_participants p
      where p.event_id=p_event_id and p.is_active
        and not exists (
          select 1 from public.ss_assignments a
          where a.event_id=p_event_id
            and (a.santa_id=p.id or a.child_id=p.id)
        )
    )
    select array_agg(id order by shuffle_key),
           array_agg(normalized_name order by shuffle_key)
      into v_people,v_names
    from pending;

    v_count:=coalesce(array_length(v_people,1),0);
    if v_count=0 then return 0; end if;
    if v_count=1 then
      raise exception 'One participant is awaiting assignment; add another newcomer to draw';
    end if;

    v_conflict:=false;
    for i in 1..v_count loop
      if v_people[i]=v_people[(i % v_count)+1]
         or v_names[i]=v_names[(i % v_count)+1] then
        v_conflict:=true;
        exit;
      end if;
    end loop;
    exit when not v_conflict;
  end loop;

  if v_conflict then
    raise exception 'Cannot safely allocate these participants without a same-name pairing. Give each person a distinguishable display name and try again.';
  end if;

  for i in 1..v_count loop
    insert into public.ss_assignments(event_id,santa_id,child_id)
    values(p_event_id,v_people[i],v_people[(i % v_count)+1]);
  end loop;

  update public.ss_events
    set assignments_locked_at=coalesce(assignments_locked_at,now()),
        updated_at=now()
    where id=p_event_id;
  return v_count;
end;
$function$;

revoke all on function public.ss_assign_pending(uuid)
  from public,anon,authenticated;
grant execute on function public.ss_assign_pending(uuid) to service_role;
