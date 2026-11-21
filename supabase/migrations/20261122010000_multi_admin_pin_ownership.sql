-- Independent organizer PIN accounts for the shared Secret Santa Admin Console.
-- Existing participant identities, desk indexes, pairings, and invitation codes
-- are intentionally untouched.
create table if not exists public.ss_admin_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  pin_lookup text unique,
  pin_salt_hex text not null,
  pin_hash_hex text not null,
  pbkdf2_iterations integer not null default 210000 check (pbkdf2_iterations >= 100000),
  token_version integer not null default 1 check (token_version >= 1),
  is_active boolean not null default true,
  legacy_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ss_admin_pin_lookup_format check (pin_lookup is null or pin_lookup ~ '^[0-9a-f]{64}$')
);
create unique index if not exists ss_admin_single_legacy_owner
  on public.ss_admin_accounts(legacy_owner) where legacy_owner=true;
alter table public.ss_admin_accounts enable row level security;
revoke all on table public.ss_admin_accounts from anon, authenticated;

-- Legacy PIN is copied as its existing PBKDF2 salt/hash, never plaintext.
-- A first successful login with the existing PIN associates its lookup
-- fingerprint with this original account; all old events already belong to it.
insert into public.ss_admin_accounts
  (display_name,pin_salt_hex,pin_hash_hex,pbkdf2_iterations,token_version,legacy_owner)
select 'Original Organizer',g.pin_salt_hex,g.pin_hash_hex,g.pbkdf2_iterations,g.token_version,true
from public.ss_auth_guard g
where g.guard_key='admin' and g.pin_hash_hex is not null
  and not exists(select 1 from public.ss_admin_accounts a where a.legacy_owner=true);

alter table public.ss_events add column if not exists admin_id uuid
  references public.ss_admin_accounts(id) on delete restrict;
update public.ss_events
set admin_id=(select id from public.ss_admin_accounts where legacy_owner=true)
where admin_id is null;
alter table public.ss_events alter column admin_id set not null;
create index if not exists ss_events_admin_created_idx
  on public.ss_events(admin_id,created_at desc);

-- A shareable invitation code is generated server-side and stored only as a
-- cryptographic keyed digest. Tokens are single-use and expire automatically.
create table if not exists public.ss_admin_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check(code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.ss_admin_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.ss_admin_accounts(id) on delete set null
);
create index if not exists ss_admin_invites_expiry_idx
  on public.ss_admin_invites(expires_at);
alter table public.ss_admin_invites enable row level security;
revoke all on table public.ss_admin_invites from anon, authenticated;

-- Lock the invitation before use. A retry or simultaneous redemption cannot
-- create multiple administrators from a single token.
create or replace function public.ss_redeem_admin_invite(
  p_code_hash text,
  p_display_name text,
  p_pin_lookup text,
  p_salt_hex text,
  p_hash_hex text,
  p_iterations integer
) returns uuid
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_invite uuid;
  v_admin uuid;
begin
  if length(btrim(coalesce(p_display_name,''))) not between 1 and 120
     or p_pin_lookup !~ '^[0-9a-f]{64}$'
     or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_salt_hex !~ '^[0-9a-f]{32}$'
     or p_hash_hex !~ '^[0-9a-f]{64}$'
     or p_iterations < 100000 then
    raise exception 'Invalid administrator registration';
  end if;
  select id into v_invite
    from public.ss_admin_invites
    where code_hash=p_code_hash and redeemed_at is null
      and expires_at>clock_timestamp()
    for update;
  if not found then
    raise exception 'Invalid, expired, or already used invitation code';
  end if;

  insert into public.ss_admin_accounts (
    display_name,pin_lookup,pin_salt_hex,pin_hash_hex,pbkdf2_iterations
  ) values(
    btrim(p_display_name),p_pin_lookup,p_salt_hex,p_hash_hex,p_iterations
  ) returning id into v_admin;
  update public.ss_admin_invites
    set redeemed_at=clock_timestamp(),redeemed_by=v_admin
    where id=v_invite;
  return v_admin;
end;
$function$;
revoke all on function public.ss_redeem_admin_invite(text,text,text,text,text,integer)
  from public,anon,authenticated;
grant execute on function public.ss_redeem_admin_invite(text,text,text,text,text,integer)
  to service_role;
