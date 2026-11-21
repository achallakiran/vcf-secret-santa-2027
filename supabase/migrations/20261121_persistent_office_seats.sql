-- Allocate permanent physical workstation slots. A player's view must not
-- shift coworker desks when somebody joins or is removed.
alter table public.ss_participants
  add column if not exists office_seat_index integer;

with numbered as (
  select id, row_number() over
    (partition by event_id order by created_at,id)-1 as idx
  from public.ss_participants
)
update public.ss_participants p
  set office_seat_index=n.idx
  from numbered n
  where n.id=p.id and p.office_seat_index is null;

alter table public.ss_participants
  alter column office_seat_index set not null;

create unique index if not exists ss_participants_event_office_seat_unique
  on public.ss_participants(event_id,office_seat_index);

alter table public.ss_participants
  add constraint ss_office_seat_range
  check(office_seat_index between 0 and 149);

create or replace function public.ss_register_participant(
  p_event_id uuid,p_display_name text,p_desk_key text,p_code_fingerprint text
) returns uuid
language plpgsql security invoker set search_path=''
as $function$
declare
  v_id uuid;
  v_status text;
  v_seat integer;
begin
  select status into v_status
    from public.ss_events where id=p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status not in ('draft','active') then
    raise exception 'Participant registration is closed for this event';
  end if;
  if length(btrim(coalesce(p_display_name,''))) not between 1 and 160 then
    raise exception 'Invalid name';
  end if;
  if length(coalesce(p_desk_key,''))>30 then
    raise exception 'Invalid desk';
  end if;
  if length(coalesce(p_code_fingerprint,''))<32 then
    raise exception 'Invalid invitation fingerprint';
  end if;
  -- Event lock above serializes joins for this event, including two admins.
  -- Deleted seats may be reused; everyone else's seat remains permanently fixed.
  select candidate into v_seat
  from generate_series(0,149) candidate
  where not exists(
    select 1 from public.ss_participants p
    where p.event_id=p_event_id and p.office_seat_index=candidate
  ) order by candidate limit 1;
  if v_seat is null then raise exception 'Participant capacity reached'; end if;

  insert into public.ss_participants(
    event_id,display_name,desk_key,office_seat_index
  ) values(
    p_event_id,btrim(p_display_name),
    nullif(btrim(coalesce(p_desk_key,'')),''),v_seat
  ) returning id into v_id;

  insert into public.ss_participant_private(event_id,participant_id)
  values(p_event_id,v_id);
  insert into public.ss_access_codes(event_id,participant_id,code_fingerprint)
  values(p_event_id,v_id,p_code_fingerprint);
  return v_id;
end;
$function$;

revoke all on function public.ss_register_participant(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.ss_register_participant(uuid,text,text,text)
  to service_role;
