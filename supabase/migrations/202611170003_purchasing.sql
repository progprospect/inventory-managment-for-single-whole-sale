create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  state text,
  state_code varchar(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(name) between 1 and 160),
  check (email is null or length(email) <= 254)
);

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint generated always as identity unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_invoice_number text not null check (length(supplier_invoice_number) between 1 and 80),
  supplier_invoice_date date not null,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_total numeric(14,2) not null default 0,
  cgst_total numeric(14,2) not null default 0,
  sgst_total numeric(14,2) not null default 0,
  igst_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  posting_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id, supplier_invoice_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_receipts(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  unit_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  purchase_rate numeric(14,2) not null check (purchase_rate >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null check (gst_rate between 0 and 100),
  taxable_amount numeric(14,2) not null,
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create index suppliers_name_idx on public.suppliers using gin (to_tsvector('simple', name));
create index purchase_receipts_supplier_date_idx on public.purchase_receipts(supplier_id, created_at desc);
create index purchase_receipts_date_status_idx on public.purchase_receipts(created_at desc, status);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id);

create or replace function public.create_purchase_draft(purchase_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  purchase_uuid uuid := gen_random_uuid();
  supplier_uuid uuid := (purchase_data ->> 'supplier_id')::uuid;
  supplier_state varchar(2);
  shop_state varchar(2);
  is_interstate boolean;
  line jsonb;
  item_product public.products%rowtype;
  item_unit public.units%rowtype;
  qty numeric(14,3);
  rate numeric(14,2);
  discount_pct numeric(5,2);
  gst numeric(5,2);
  gross numeric(14,2);
  discount_value numeric(14,2);
  taxable numeric(14,2);
  tax_value numeric(14,2);
  cgst_value numeric(14,2);
  sgst_value numeric(14,2);
  igst_value numeric(14,2);
  subtotal_value numeric(14,2) := 0;
  discount_total_value numeric(14,2) := 0;
  taxable_total_value numeric(14,2) := 0;
  cgst_total_value numeric(14,2) := 0;
  sgst_total_value numeric(14,2) := 0;
  igst_total_value numeric(14,2) := 0;
begin
  if not public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]) then
    raise exception 'Not allowed to create purchase receipts' using errcode = '42501';
  end if;
  if jsonb_typeof(purchase_data -> 'items') <> 'array' or jsonb_array_length(purchase_data -> 'items') = 0 then
    raise exception 'Add at least one purchase item' using errcode = '23514';
  end if;
  select state_code into supplier_state from public.suppliers where id = supplier_uuid and not is_archived;
  if not found then raise exception 'Supplier not found or archived' using errcode = 'P0002'; end if;
  select state_code into shop_state from public.business_settings where id = 1;
  is_interstate := supplier_state is not null and shop_state is not null and supplier_state <> shop_state;
  insert into public.purchase_receipts(supplier_id, supplier_invoice_number, supplier_invoice_date, created_by)
  values (supplier_uuid, btrim(purchase_data ->> 'supplier_invoice_number'), (purchase_data ->> 'supplier_invoice_date')::date, auth.uid())
  returning id into purchase_uuid;
  for line in select value from jsonb_array_elements(purchase_data -> 'items') loop
    select * into item_product from public.products where id = (line ->> 'product_id')::uuid and not is_archived;
    if not found then raise exception 'A selected product is unavailable' using errcode = 'P0002'; end if;
    select * into item_unit from public.units where id = item_product.unit_id;
    qty := (line ->> 'quantity')::numeric;
    rate := (line ->> 'purchase_rate')::numeric;
    discount_pct := coalesce(nullif(line ->> 'discount_percent','')::numeric, 0);
    gst := (line ->> 'gst_rate')::numeric;
    if qty <= 0 or rate < 0 or discount_pct < 0 or discount_pct > 100 or gst < 0 or gst > 100 then
      raise exception 'Purchase item values are outside allowed ranges' using errcode = '23514';
    end if;
    gross := round(qty * rate, 2);
    discount_value := round(gross * discount_pct / 100, 2);
    taxable := gross - discount_value;
    tax_value := round(taxable * gst / 100, 2);
    cgst_value := case when is_interstate then 0 else round(tax_value / 2, 2) end;
    sgst_value := case when is_interstate then 0 else tax_value - cgst_value end;
    igst_value := case when is_interstate then tax_value else 0 end;
    insert into public.purchase_items(purchase_id, product_id, product_name, sku, unit_name, quantity, purchase_rate, discount_percent, discount_amount, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
    values (purchase_uuid, item_product.id, item_product.name, item_product.sku, item_unit.abbreviation, qty, rate, discount_pct, discount_value, gst, taxable, cgst_value, sgst_value, igst_value, taxable + tax_value);
    subtotal_value := subtotal_value + gross;
    discount_total_value := discount_total_value + discount_value;
    taxable_total_value := taxable_total_value + taxable;
    cgst_total_value := cgst_total_value + cgst_value;
    sgst_total_value := sgst_total_value + sgst_value;
    igst_total_value := igst_total_value + igst_value;
  end loop;
  update public.purchase_receipts set subtotal = subtotal_value, discount_total = discount_total_value,
    taxable_total = taxable_total_value, cgst_total = cgst_total_value, sgst_total = sgst_total_value,
    igst_total = igst_total_value, grand_total = taxable_total_value + cgst_total_value + sgst_total_value + igst_total_value,
    updated_at = now() where id = purchase_uuid;
  return purchase_uuid;
end;
$$;

create or replace function public.post_purchase(target_purchase_id uuid, request_key text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  receipt public.purchase_receipts%rowtype;
  item record;
begin
  if not public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]) then
    raise exception 'Not allowed to post purchases' using errcode = '42501';
  end if;
  if nullif(btrim(request_key), '') is null then raise exception 'Posting key is required' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key, 0));
  select * into receipt from public.purchase_receipts where id = target_purchase_id for update;
  if not found then raise exception 'Purchase receipt not found' using errcode = 'P0002'; end if;
  if receipt.status = 'posted' then
    if receipt.posting_key = request_key then return receipt.id; end if;
    raise exception 'Purchase receipt is already posted' using errcode = '23505';
  end if;
  if receipt.status <> 'draft' then raise exception 'Only draft receipts can be posted' using errcode = '23514'; end if;
  if exists (select 1 from public.purchase_receipts where posting_key = request_key and id <> target_purchase_id) then
    raise exception 'Posting key is already used' using errcode = '23505';
  end if;
  perform p.id from public.products p where p.id in (select product_id from public.purchase_items where purchase_id = target_purchase_id) order by p.id for update;
  for item in select product_id, quantity, id from public.purchase_items where purchase_id = target_purchase_id order by product_id, id loop
    insert into public.stock_movements(product_id, quantity_delta, movement_type, reason, source_type, source_id, idempotency_key, actor_id)
    values (item.product_id, item.quantity, 'purchase', 'Purchase receipt ' || receipt.receipt_number::text,
      'purchase', target_purchase_id, 'purchase:' || target_purchase_id::text || ':' || item.id::text, auth.uid())
    on conflict (idempotency_key) do nothing;
  end loop;
  update public.purchase_receipts set status = 'posted', posting_key = request_key, posted_at = now(), updated_at = now() where id = target_purchase_id;
  return target_purchase_id;
end;
$$;

alter table public.suppliers enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_items enable row level security;
grant select, insert, update on public.suppliers to authenticated;
grant select on public.purchase_receipts, public.purchase_items to authenticated;

create policy "Purchasing roles read suppliers" on public.suppliers for select to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Purchasing roles manage suppliers" on public.suppliers for all to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[])) with check (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Purchasing roles read receipts" on public.purchase_receipts for select to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));
create policy "Purchasing roles read purchase items" on public.purchase_items for select to authenticated using (public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]));

create trigger audit_suppliers_change after insert or update on public.suppliers for each row execute function public.audit_catalog_change();
create trigger audit_purchases_change after insert or update on public.purchase_receipts for each row execute function public.audit_catalog_change();

revoke all on function public.create_purchase_draft(jsonb) from public;
revoke all on function public.post_purchase(uuid, text) from public;
grant execute on function public.create_purchase_draft(jsonb) to authenticated;
grant execute on function public.post_purchase(uuid, text) to authenticated;
