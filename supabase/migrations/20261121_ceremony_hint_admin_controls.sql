-- Secret Santa admin operations and private progressive hints.
-- Only the server-side service_role can execute these RPCs.
alter table public.ss_assignments
  add column if not exists santa_hints jsonb not null default '[]'::jsonb,
  add column if not exists hints_unlocked_count integer not null default 0,
  add column if not exists hint_last_unlocked_at timestamptz;

alter table public.ss_assignments
  add constraint ss_santa_hints_array_check
  check(jsonb_typeof(santa_hints)='array' and jsonb_array_length(santa_hints)<=3),
  add constraint ss_hint_unlock_count_check
  check(hints_unlocked_count between 0 and 3);

create or replace function public.ss_save_santa_hints(
  p_event_id uuid,p_santa_id uuid,p_hints jsonb
) returns integer language plpgsql security invoker set search_path=''
as $function$
declare
  v_assignment public.ss_assignments%rowtype;
  v_hint text;
  v_index integer;
  v_clean jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(p_hints)<>'array' or jsonb_array_length(p_hints)<>3 then
    raise exception 'Exactly three clue fields are required';
  end if;
  for v_index in 0..2 loop
    if jsonb_typeof(p_hints->v_index)<>'string' then
      raise exception 'Hints must be plain text';
    end if;
    v_hint:=btrim(p_hints->>v_index);
    if length(v_hint)>180 then raise exception 'Hint too long'; end if;
    v_clean:=v_clean||jsonb_build_array(v_hint);
  end loop;
  select * into v_assignment from public.ss_assignments
  where event_id=p_event_id and santa_id=p_santa_id for update;
  if not found then raise exception 'Your Secret Child is not assigned'; end if;

  -- An already-revealed clue cannot be edited afterward.
  for v_index in 0..v_assignment.hints_unlocked_count-1 loop
    if v_clean->>v_index is distinct from v_assignment.santa_hints->>v_index then
      raise exception 'Previously revealed hints cannot be changed';
    end if;
  end loop;
  update public.ss_assignments
     set santa_hints=v_clean,updated_at=now()
  where id=v_assignment.id;
  return 3;
end;
$function$;

create or replace function public.ss_unlock_hint(
  p_event_id uuid,p_child_id uuid
) returns integer language plpgsql security invoker set search_path=''
as $function$
declare
  v_assignment public.ss_assignments%rowtype;
  v_next integer;
begin
  select * into v_assignment from public.ss_assignments
  where event_id=p_event_id and child_id=p_child_id for update;
  if not found then raise exception 'Your Santa assignment has not been drawn'; end if;
  v_next:=v_assignment.hints_unlocked_count+1;
  if v_next>3 then raise exception 'All three hints are already unlocked'; end if;
  if jsonb_array_length(v_assignment.santa_hints)<v_next
     or length(btrim(coalesce(v_assignment.santa_hints->>(v_next-1),'')))=0 then
    raise exception 'Your Santa has not written this clue yet';
  end if;
  if v_assignment.hint_last_unlocked_at is not null
     and now()<v_assignment.hint_last_unlocked_at+interval '24 hours' then
    raise exception 'Your next clue unlocks 24 hours after the previous one';
  end if;
  update public.ss_assignments
     set hints_unlocked_count=v_next,hint_last_unlocked_at=now(),updated_at=now()
  where id=v_assignment.id;
  return v_next;
end;
$function$;

create or replace function public.ss_delete_participant(
  p_event_id uuid,p_participant_id uuid
) returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare
  v_status text;
  v_person public.ss_participants%rowtype;
  v_in public.ss_assignments%rowtype;
  v_out public.ss_assignments%rowtype;
  v_count integer;
  v_target_name text;
  v_source_name text;
begin
  select status into v_status from public.ss_events
  where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Cannot delete participants during or after the finale';
  end if;
  select * into v_person from public.ss_participants
    where event_id=p_event_id and id=p_participant_id for update;
  if not found then raise exception 'Participant not found'; end if;

  if exists(select 1 from public.ss_participant_private p
    where p.event_id=p_event_id and p.participant_id=p_participant_id
    and p.wishlist<>'[]'::jsonb) then
    raise exception 'This participant has a saved wishlist; delete it manually after reviewing their data';
  end if;

  select * into v_in from public.ss_assignments
  where event_id=p_event_id and child_id=p_participant_id for update;
  select * into v_out from public.ss_assignments
  where event_id=p_event_id and santa_id=p_participant_id for update;

  if (v_in.id is null)<>(v_out.id is null) then
    raise exception 'Incomplete participant assignment requires manual review';
  end if;

  if v_in.id is not null then
    select count(*) into v_count from public.ss_assignments
    where event_id=p_event_id;
    if v_count<=2 then
      raise exception 'Cannot leave a one-person Santa cycle; add more participants first';
    end if;
    if v_in.santa_message is not null or v_in.gift_purchased
       or v_out.santa_message is not null or v_out.gift_purchased
       or exists(select 1 from public.ss_santa_tasks
        where assignment_id in(v_in.id,v_out.id)) or
       v_in.hints_unlocked_count>0 or v_out.hints_unlocked_count>0 then
      raise exception 'Participant has gift messages, completed gift status, tasks or released hints; deletion is blocked to protect that data';
    end if;

    select display_name into v_source_name from public.ss_participants
      where id=v_in.santa_id and event_id=p_event_id;
    select display_name into v_target_name from public.ss_participants
      where id=v_out.child_id and event_id=p_event_id;
    if v_in.santa_id=v_out.child_id or
       lower(btrim(v_source_name))=lower(btrim(v_target_name)) then
      raise exception 'Deleting this participant would create a self or same-name assignment';
    end if;

    delete from public.ss_assignments
      where id=v_out.id and event_id=p_event_id;
    update public.ss_assignments
      set child_id=v_out.child_id,santa_hints='[]'::jsonb,
          hints_unlocked_count=0,hint_last_unlocked_at=null,updated_at=now()
      where id=v_in.id and event_id=p_event_id;
  end if;

  delete from public.ss_participants
  where event_id=p_event_id and id=p_participant_id;
  return jsonb_build_object('deleted',p_participant_id,'rewired',v_in.id is not null);
end;
$function$;

create or replace function public.ss_reassign_all(
  p_event_id uuid,p_confirmation text
) returns integer language plpgsql security invoker set search_path=''
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
  if p_confirmation<>'REASSIGN' then
    raise exception 'Type REASSIGN to confirm the destructive reset';
  end if;
  select status into v_status from public.ss_events
  where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Cannot reassign during or after the finale';
  end if;
  for v_attempt in 1..300 loop
    with shuffled as materialized (
      select id,lower(btrim(display_name)) as name,
             random() as shuffle from public.ss_participants
      where event_id=p_event_id and is_active
    )
    select array_agg(id order by shuffle),array_agg(name order by shuffle)
      into v_people,v_names from shuffled;
    v_count:=coalesce(array_length(v_people,1),0);
    if v_count<2 then raise exception 'At least two participants are required'; end if;
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
    raise exception 'Cannot safely reassign without matching identical names. Correct names first.';
  end if;
  -- Existing gift flags, Santa messages, clues and dated tasks belong to the
  -- old pair. ON DELETE CASCADE clears the tasks before new pairs are created.
  delete from public.ss_assignments where event_id=p_event_id;
  for i in 1..v_count loop
    insert into public.ss_assignments(event_id,santa_id,child_id)
    values (p_event_id,v_people[i],v_people[(i % v_count)+1]);
  end loop;
  update public.ss_events
    set assignments_locked_at=now(),updated_at=now(),
        ceremony_state='{}'::jsonb
  where id=p_event_id;
  return v_count;
end;
$function$;

revoke all on function public.ss_save_santa_hints(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke all on function public.ss_unlock_hint(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.ss_delete_participant(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.ss_reassign_all(uuid,text)
  from public,anon,authenticated;

grant execute on function public.ss_save_santa_hints(uuid,uuid,jsonb) to service_role;
grant execute on function public.ss_unlock_hint(uuid,uuid) to service_role;
grant execute on function public.ss_delete_participant(uuid,uuid) to service_role;
grant execute on function public.ss_reassign_all(uuid,text) to service_role;
