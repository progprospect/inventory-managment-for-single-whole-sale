-- Product catalogue and append-only inventory ledger. Stock is a sum of ledger entries.
create sequence public.products_sku_seq start 1;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(name) between 1 and 100),
  check (description is null or length(description) <= 500)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null unique,
  base_unit_id uuid references public.units(id) on delete restrict,
  factor_to_base numeric(14,6) not null default 1 check (factor_to_base > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((base_unit_id is null and factor_to_base = 1) or base_unit_id is not null),
  check (length(name) between 1 and 60 and length(abbreviation) between 1 and 12)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  unit_id uuid not null references public.units(id) on delete restrict,
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  wholesale_price numeric(14,2) not null default 0 check (wholesale_price >= 0),
  alternate_price numeric(14,2) check (alternate_price is null or alternate_price >= 0),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  hsn_code text,
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(sku) between 1 and 40),
  check (barcode is null or length(barcode) <= 80),
  check (length(name) between 1 and 160),
  check (description is null or length(description) <= 1000),
  check (hsn_code is null or length(hsn_code) <= 20)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('opening','adjustment','purchase','sale','sales_return','purchase_return','reversal')),
  reason text,
  source_type text,
  source_id uuid,
  idempotency_key text not null unique,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create unique index categories_name_casefold_unique on public.categories(lower(name));
create unique index products_sku_casefold_unique on public.products (lower(sku));
create unique index products_barcode_casefold_unique on public.products (lower(barcode)) where barcode is not null;
create index products_category_id_idx on public.products(category_id) where category_id is not null;
create index stock_movements_product_date_idx on public.stock_movements(product_id, created_at desc);
create index stock_movements_source_idx on public.stock_movements(source_type, source_id) where source_id is not null;

create view public.product_stock with (security_invoker = true) as
select p.id as product_id,
       coalesce(sum(m.quantity_delta), 0)::numeric(14,3) as current_stock,
       case
         when coalesce(sum(m.quantity_delta), 0) <= 0 then 'out_of_stock'
         when coalesce(sum(m.quantity_delta), 0) <= p.minimum_stock then 'low_stock'
         else 'in_stock'
       end as stock_status
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.minimum_stock;

create or replace function public.create_product(product_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  sku_value text := nullif(btrim(product_data ->> 'sku'), '');
  opening numeric(14,3) := coalesce(nullif(product_data ->> 'opening_stock', '')::numeric, 0);
begin
  if not public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]) then
    raise exception 'Not allowed to create products' using errcode = '42501';
  end if;
  if length(btrim(coalesce(product_data ->> 'name',''))) not between 1 and 160
     or length(coalesce(product_data ->> 'sku','')) > 40
     or length(coalesce(product_data ->> 'barcode','')) > 80
     or length(coalesce(product_data ->> 'description','')) > 1000 then
    raise exception 'Product text field exceeds the allowed length' using errcode = '23514';
  end if;
  if sku_value is null then sku_value := 'SKU-' || lpad(nextval('public.products_sku_seq')::text, 6, '0'); end if;
  insert into public.products (id, sku, barcode, name, description, category_id, unit_id, purchase_price, wholesale_price, alternate_price, gst_rate, hsn_code, minimum_stock)
  values (new_id, sku_value, nullif(btrim(product_data ->> 'barcode'), ''), btrim(product_data ->> 'name'), nullif(btrim(product_data ->> 'description'), ''),
    nullif(product_data ->> 'category_id', '')::uuid, (product_data ->> 'unit_id')::uuid,
    coalesce(nullif(product_data ->> 'purchase_price', '')::numeric, 0), coalesce(nullif(product_data ->> 'wholesale_price', '')::numeric, 0),
    nullif(product_data ->> 'alternate_price', '')::numeric, coalesce(nullif(product_data ->> 'gst_rate', '')::numeric, 0),
    nullif(btrim(product_data ->> 'hsn_code'), ''), coalesce(nullif(product_data ->> 'minimum_stock', '')::numeric, 0));
  if opening < 0 then raise exception 'Opening stock cannot be negative' using errcode = '23514'; end if;
  if opening > 0 then
    insert into public.stock_movements (product_id, quantity_delta, movement_type, reason, source_type, idempotency_key, actor_id)
    values (new_id, opening, 'opening', 'Opening stock', 'product', 'opening:' || new_id::text, auth.uid());
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'stock_opening_recorded', 'product', new_id, jsonb_build_object('quantity', opening));
  end if;
  return new_id;
end;
$$;

create or replace function public.adjust_stock(target_product_id uuid, quantity_change numeric, adjustment_reason text, request_key text)
returns numeric
language plpgsql security definer
set search_path = ''
as $$
declare
  old_balance numeric(14,3);
  new_balance numeric(14,3);
  inserted_id uuid;
  prior public.stock_movements%rowtype;
begin
  if not public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]) then
    raise exception 'Not allowed to adjust stock' using errcode = '42501';
  end if;
  if quantity_change = 0 or nullif(btrim(adjustment_reason), '') is null or length(adjustment_reason) > 240 or nullif(btrim(request_key), '') is null or length(request_key) > 120 then
    raise exception 'Quantity, reason, and idempotency key are required' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key, 0));
  select * into prior from public.stock_movements where idempotency_key = request_key;
  if found then
    if prior.product_id <> target_product_id or prior.quantity_delta <> quantity_change or prior.movement_type <> 'adjustment' then
      raise exception 'Idempotency key was already used for a different stock change' using errcode = '23505';
    end if;
    select coalesce(sum(quantity_delta), 0) into new_balance from public.stock_movements where product_id = target_product_id;
    return new_balance;
  end if;
  perform 1 from public.products where id = target_product_id and not is_archived for update;
  if not found then raise exception 'Product not found or archived' using errcode = 'P0002'; end if;
  select coalesce(sum(quantity_delta), 0) into old_balance from public.stock_movements where product_id = target_product_id;
  if old_balance + quantity_change < 0 then raise exception 'Adjustment would make stock negative' using errcode = '23514'; end if;
  select * into prior from public.stock_movements where idempotency_key = request_key;
  if found then
    if prior.product_id <> target_product_id or prior.quantity_delta <> quantity_change or prior.movement_type <> 'adjustment' then
      raise exception 'Idempotency key was already used for a different stock change' using errcode = '23505';
    end if;
    select coalesce(sum(quantity_delta), 0) into new_balance from public.stock_movements where product_id = target_product_id;
    return new_balance;
  end if;
  insert into public.stock_movements(product_id, quantity_delta, movement_type, reason, source_type, idempotency_key, actor_id)
  values (target_product_id, quantity_change, 'adjustment', btrim(adjustment_reason), 'manual', request_key, auth.uid())
  on conflict (idempotency_key) do nothing returning id into inserted_id;
  if inserted_id is not null then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'stock_adjusted', 'product', target_product_id, jsonb_build_object('delta', quantity_change, 'reason', btrim(adjustment_reason), 'request_key', request_key));
  end if;
  select coalesce(sum(quantity_delta), 0) into new_balance from public.stock_movements where product_id = target_product_id;
  return new_balance;
end;
$$;

create or replace function public.audit_catalog_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  entity uuid;
  event_action text;
  snapshot jsonb;
  old_snapshot jsonb;
begin
  if auth.uid() is null then return null; end if;
  snapshot := to_jsonb(new);
  old_snapshot := to_jsonb(old);
  entity := coalesce((snapshot ->> 'id')::uuid, (old_snapshot ->> 'id')::uuid);
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' then event_action := 'product_created';
    elsif coalesce((snapshot ->> 'is_archived')::boolean, false) and not coalesce((old_snapshot ->> 'is_archived')::boolean, false) then event_action := 'product_archived';
    else event_action := 'product_updated'; end if;
  elsif tg_table_name = 'categories' then
    if tg_op = 'INSERT' then event_action := 'category_created';
    elsif snapshot ->> 'archived_at' is not null and old_snapshot ->> 'archived_at' is null then event_action := 'category_archived';
    else event_action := 'category_updated'; end if;
  elsif tg_table_name = 'units' then
    event_action := case when tg_op = 'INSERT' then 'unit_created' else 'unit_updated' end;
  elsif tg_table_name = 'suppliers' then
    event_action := case when tg_op = 'INSERT' then 'supplier_created' else 'supplier_updated' end;
  elsif tg_table_name = 'customers' then
    event_action := case when tg_op = 'INSERT' then 'customer_created' else 'customer_updated' end;
  elsif tg_table_name = 'purchase_receipts' then
    if tg_op = 'UPDATE' and snapshot ->> 'status' = 'posted' and old_snapshot ->> 'status' = 'draft' then event_action := 'purchase_posted';
    else event_action := 'purchase_draft_saved'; end if;
  elsif tg_table_name = 'sales_invoices' then
    if tg_op = 'UPDATE' and snapshot ->> 'status' = 'posted' and old_snapshot ->> 'status' = 'draft' then event_action := 'sale_posted';
    else event_action := 'sale_draft_saved'; end if;
  elsif tg_table_name = 'returns' then
    event_action := 'return_posted';
  elsif tg_table_name = 'business_settings' then
    if (snapshot - 'next_invoice_number' - 'updated_at') = (old_snapshot - 'next_invoice_number' - 'updated_at') then return null; end if;
    event_action := 'business_settings_updated';
  else
    event_action := lower(tg_table_name) || '_' || lower(tg_op);
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), event_action, tg_table_name, entity, jsonb_build_object('record', snapshot));
  return null;
end;
$$;

create trigger audit_products_change after insert or update on public.products for each row execute function public.audit_catalog_change();
create trigger audit_categories_change after insert or update on public.categories for each row execute function public.audit_catalog_change();
create trigger audit_units_change after insert or update on public.units for each row execute function public.audit_catalog_change();
create trigger audit_business_settings_change after update on public.business_settings for each row execute function public.audit_catalog_change();
revoke all on function public.audit_catalog_change() from public;

alter table public.categories enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
grant select, insert, update on public.categories, public.units to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.stock_movements, public.product_stock to authenticated;
grant usage, select on sequence public.products_sku_seq to authenticated;

create policy "Authenticated staff read active categories" on public.categories for select to authenticated using (archived_at is null or public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Inventory roles manage categories" on public.categories for all to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[])) with check (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Authenticated staff read units" on public.units for select to authenticated using (archived_at is null or public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Inventory roles manage units" on public.units for all to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[])) with check (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Authenticated staff read active products" on public.products for select to authenticated using (not is_archived or public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Inventory roles update products" on public.products for update to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[])) with check (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Staff roles read stock ledger" on public.stock_movements for select to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff','billing_staff']::public.app_role[]));

revoke all on function public.create_product(jsonb) from public;
revoke all on function public.adjust_stock(uuid, numeric, text, text) from public;
grant execute on function public.create_product(jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, text, text) to authenticated;

insert into public.units (name, abbreviation) values
  ('Piece','pc'), ('Box','box'), ('Carton','ctn'), ('Packet','pkt'), ('Dozen','doz'), ('Kilogram','kg'), ('Litre','L')
on conflict (name) do nothing;
