-- Single-shop foundation: user profiles, roles, business settings, and audit events.
create extension if not exists pgcrypto;

create type public.app_role as enum ('owner_admin', 'manager', 'billing_staff', 'inventory_staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.app_role not null default 'billing_staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text not null default 'My Wholesale Shop',
  logo_path text,
  address text,
  phone text,
  email text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  state text,
  state_code varchar(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  invoice_prefix text not null default 'INV',
  next_invoice_number bigint not null default 1 check (next_invoice_number > 0),
  financial_year_aware boolean not null default true,
  default_gst_rate numeric(5,2) not null default 0 check (default_gst_rate >= 0 and default_gst_rate <= 100),
  prices_include_tax boolean not null default false,
  invoice_footer text,
  invoice_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id, created_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$ select role from public.user_roles where user_id = (select auth.uid()) $$;

create or replace function public.has_any_role(allowed public.app_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(public.current_app_role() = any(allowed), false) $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'billing_staff');
  return new;
end;
$$;

create or replace function public.change_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  old_role public.app_role;
  owner_count integer;
begin
  if actor is null or not public.has_any_role(array['owner_admin']::public.app_role[]) then
    raise exception 'Only an owner/admin can change user roles' using errcode = '42501';
  end if;
  perform user_id from public.user_roles where role = 'owner_admin' order by user_id for update;
  select role into old_role from public.user_roles where user_id = target_user_id for update;
  if old_role is null then raise exception 'User role not found' using errcode = 'P0002'; end if;
  if old_role = 'owner_admin' and new_role <> 'owner_admin' then
    select count(*) into owner_count from public.user_roles where role = 'owner_admin';
    if owner_count <= 1 then raise exception 'The last owner/admin cannot be removed' using errcode = '23514'; end if;
  end if;
  update public.user_roles set role = new_role, updated_at = now() where user_id = target_user_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (actor, 'user_role_changed', 'user_role', target_user_id, jsonb_build_object('from', old_role, 'to', new_role));
end;
$$;

create or replace function public.log_user_login()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, details)
  values (auth.uid(), 'user_login', 'auth', '{}'::jsonb);
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, update on public.business_settings to authenticated;
grant select on public.audit_logs to authenticated;

create policy "Users read own profile; owner and manager read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_any_role(array['owner_admin','manager']::public.app_role[]));
create policy "Users update own profile; owner manages all"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.has_any_role(array['owner_admin']::public.app_role[]))
  with check (id = (select auth.uid()) or public.has_any_role(array['owner_admin']::public.app_role[]));
create policy "Owner manages roles; staff can view own role"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_role(array['owner_admin']::public.app_role[]));
create policy "Authenticated staff can read business settings"
  on public.business_settings for select to authenticated using (true);
create policy "Owner manages business settings"
  on public.business_settings for all to authenticated
  using (public.has_any_role(array['owner_admin']::public.app_role[]))
  with check (public.has_any_role(array['owner_admin']::public.app_role[]));
create policy "Owner and manager read audit logs"
  on public.audit_logs for select to authenticated
  using (public.has_any_role(array['owner_admin','manager']::public.app_role[]));

revoke all on function public.current_app_role() from public;
revoke all on function public.has_any_role(public.app_role[]) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
revoke all on function public.change_user_role(uuid, public.app_role) from public;
grant execute on function public.change_user_role(uuid, public.app_role) to authenticated;
revoke all on function public.log_user_login() from public;
grant execute on function public.log_user_login() to authenticated;

insert into public.business_settings (id) values (1) on conflict do nothing;
