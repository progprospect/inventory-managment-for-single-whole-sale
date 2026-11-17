create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  billing_address text,
  state text,
  state_code varchar(2) check (state_code is null or state_code ~ '^[0-9]{2}$'),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  customer_type text not null default 'wholesale' check (customer_type in ('retail','wholesale','business')),
  opening_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(name) between 1 and 160),
  check (email is null or length(email) <= 254),
  check (billing_address is null or length(billing_address) <= 800)
);

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  invoice_date timestamptz,
  customer_id uuid references public.customers(id) on delete restrict,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  customer_address text,
  customer_state text,
  customer_state_code varchar(2),
  customer_gstin text,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','partially_paid','unpaid')),
  payment_method text check (payment_method in ('cash','upi','card','bank_transfer','credit')),
  payment_amount numeric(14,2) not null default 0 check (payment_amount >= 0),
  invoice_discount_amount numeric(14,2) not null default 0 check (invoice_discount_amount >= 0),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_total numeric(14,2) not null default 0,
  cgst_total numeric(14,2) not null default 0,
  sgst_total numeric(14,2) not null default 0,
  igst_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  posting_key text unique,
  shop_name text,
  shop_address text,
  shop_phone text,
  shop_email text,
  shop_gstin text,
  shop_state text,
  shop_state_code varchar(2),
  invoice_footer text,
  invoice_terms text,
  created_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  unit_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14,2) not null default 0,
  invoice_discount_allocated numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null check (gst_rate between 0 and 100),
  taxable_amount numeric(14,2) not null default 0,
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','upi','card','bank_transfer')),
  reference text,
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers using gin (to_tsvector('simple', name));
create index customers_phone_idx on public.customers(phone) where phone is not null;
create index sales_invoices_date_status_idx on public.sales_invoices(invoice_date desc, status);
create index sales_invoices_customer_idx on public.sales_invoices(customer_id, invoice_date desc);
create index sales_items_invoice_idx on public.sales_items(invoice_id);
create index sales_items_product_idx on public.sales_items(product_id);
create index payments_invoice_idx on public.payments(sales_invoice_id, created_at desc);

create or replace function public.create_sale_draft(sale_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  invoice_uuid uuid := gen_random_uuid();
  customer_uuid uuid := nullif(sale_data ->> 'customer_id','')::uuid;
  customer_row public.customers%rowtype;
  line jsonb;
  product_row public.products%rowtype;
  unit_row public.units%rowtype;
  qty numeric(14,3);
  price numeric(14,2);
  discount_pct numeric(5,2);
  payment_value numeric(14,2) := coalesce(nullif(sale_data ->> 'payment_amount','')::numeric, 0);
  method text := nullif(sale_data ->> 'payment_method','');
  invoice_discount numeric(14,2) := coalesce(nullif(sale_data ->> 'invoice_discount_amount','')::numeric, 0);
begin
  if not public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]) then
    raise exception 'Not allowed to create sales invoices' using errcode = '42501';
  end if;
  if jsonb_typeof(sale_data -> 'items') <> 'array' or jsonb_array_length(sale_data -> 'items') = 0 or jsonb_array_length(sale_data -> 'items') > 200 then
    raise exception 'A sale must contain between 1 and 200 items' using errcode = '23514';
  end if;
  if payment_value < 0 or invoice_discount < 0 then raise exception 'Payment and discount cannot be negative' using errcode = '23514'; end if;
  if customer_uuid is not null then
    select * into customer_row from public.customers where id = customer_uuid and not is_archived;
    if not found then raise exception 'Customer not found or archived' using errcode = 'P0002'; end if;
  end if;
  insert into public.sales_invoices(customer_id, customer_name, customer_phone, customer_email, customer_address, customer_state, customer_state_code, customer_gstin, payment_method, payment_amount, invoice_discount_amount, created_by)
  values (customer_uuid, case when customer_uuid is null then 'Walk-in Customer' else customer_row.name end,
    customer_row.phone, customer_row.email, customer_row.billing_address, customer_row.state, customer_row.state_code,
    customer_row.gstin, method, payment_value, invoice_discount, auth.uid())
  returning id into invoice_uuid;
  for line in select value from jsonb_array_elements(sale_data -> 'items') loop
    select * into product_row from public.products where id = (line ->> 'product_id')::uuid and not is_archived;
    if not found then raise exception 'A selected product is unavailable' using errcode = 'P0002'; end if;
    select * into unit_row from public.units where id = product_row.unit_id;
    qty := (line ->> 'quantity')::numeric;
    price := (line ->> 'unit_price')::numeric;
    discount_pct := coalesce(nullif(line ->> 'discount_percent','')::numeric, 0);
    if qty <= 0 or price < 0 or discount_pct < 0 or discount_pct > 100 then
      raise exception 'Sales item values are outside allowed ranges' using errcode = '23514';
    end if;
    insert into public.sales_items(invoice_id, product_id, product_name, sku, unit_name, quantity, unit_price, discount_percent, gst_rate)
    values (invoice_uuid, product_row.id, product_row.name, product_row.sku, unit_row.abbreviation, qty, price, discount_pct, product_row.gst_rate);
  end loop;
  return invoice_uuid;
end;
$$;

create or replace function public.post_sale(target_invoice_id uuid, request_key text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  invoice public.sales_invoices%rowtype;
  settings public.business_settings%rowtype;
  customer_state varchar(2);
  interstate boolean;
  needs record;
  line record;
  balance numeric(14,3);
  gross numeric(14,2);
  after_item_discount numeric(14,2);
  raw_taxable numeric(14,2);
  before_item_taxable numeric(14,2);
  item_discount_taxable numeric(14,2);
  raw_taxable_total numeric(14,2) := 0;
  original_subtotal numeric(14,2) := 0;
  item_discount_total numeric(14,2) := 0;
  allocated_total numeric(14,2) := 0;
  allocated numeric(14,2);
  final_taxable numeric(14,2);
  tax_value numeric(14,2);
  cgst_value numeric(14,2);
  sgst_value numeric(14,2);
  igst_value numeric(14,2);
  cgst_sum numeric(14,2) := 0;
  sgst_sum numeric(14,2) := 0;
  igst_sum numeric(14,2) := 0;
  taxable_sum numeric(14,2) := 0;
  grand numeric(14,2) := 0;
  invoice_no text;
  fy text;
  seq_no bigint;
  line_index integer := 0;
  line_count integer;
  payment_state text;
  invoice_local_date date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]) then
    raise exception 'Not allowed to post sales invoices' using errcode = '42501';
  end if;
  if nullif(btrim(request_key),'') is null then raise exception 'Posting key is required' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key, 0));
  select * into invoice from public.sales_invoices where id = target_invoice_id for update;
  if not found then raise exception 'Sales invoice not found' using errcode = 'P0002'; end if;
  if invoice.status = 'posted' then
    if invoice.posting_key = request_key then return invoice.invoice_number; end if;
    raise exception 'Sales invoice is already posted' using errcode = '23505';
  end if;
  if invoice.status <> 'draft' then raise exception 'Only draft invoices can be posted' using errcode = '23514'; end if;
  if exists (select 1 from public.sales_invoices where posting_key = request_key and id <> target_invoice_id) then raise exception 'Posting key is already used' using errcode = '23505'; end if;
  select * into settings from public.business_settings where id = 1 for update;
  if settings.state_code is null and exists (select 1 from public.sales_items where invoice_id = target_invoice_id and gst_rate > 0) then
    raise exception 'Set the shop state code before posting a taxable invoice' using errcode = '23514';
  end if;
  customer_state := invoice.customer_state_code;
  interstate := customer_state is not null and settings.state_code is not null and customer_state <> settings.state_code;
  perform p.id from public.products p where p.id in (select distinct product_id from public.sales_items where invoice_id = target_invoice_id) order by p.id for update;
  for needs in select product_id, sum(quantity) as quantity from public.sales_items where invoice_id = target_invoice_id group by product_id order by product_id loop
    select coalesce(sum(quantity_delta),0) into balance from public.stock_movements where product_id = needs.product_id;
    if balance < needs.quantity then raise exception 'Insufficient stock for product %', needs.product_id using errcode = '23514'; end if;
  end loop;

  select count(*) into line_count from public.sales_items where invoice_id = target_invoice_id;
  for line in select * from public.sales_items where invoice_id = target_invoice_id order by id for update loop
    gross := round(line.quantity * line.unit_price, 2);
    after_item_discount := gross - round(gross * line.discount_percent / 100, 2);
    before_item_taxable := case when settings.prices_include_tax and line.gst_rate > 0 then round(gross * 100 / (100 + line.gst_rate), 2) else gross end;
    raw_taxable := case when settings.prices_include_tax and line.gst_rate > 0 then round(after_item_discount * 100 / (100 + line.gst_rate), 2) else after_item_discount end;
    item_discount_taxable := before_item_taxable - raw_taxable;
    raw_taxable_total := raw_taxable_total + raw_taxable;
    original_subtotal := original_subtotal + before_item_taxable;
    item_discount_total := item_discount_total + item_discount_taxable;
  end loop;
  if invoice.invoice_discount_amount > raw_taxable_total then raise exception 'Invoice discount cannot exceed the taxable subtotal' using errcode = '23514'; end if;
  for line in select * from public.sales_items where invoice_id = target_invoice_id order by id for update loop
    line_index := line_index + 1;
    gross := round(line.quantity * line.unit_price, 2);
    after_item_discount := gross - round(gross * line.discount_percent / 100, 2);
    before_item_taxable := case when settings.prices_include_tax and line.gst_rate > 0 then round(gross * 100 / (100 + line.gst_rate), 2) else gross end;
    raw_taxable := case when settings.prices_include_tax and line.gst_rate > 0 then round(after_item_discount * 100 / (100 + line.gst_rate), 2) else after_item_discount end;
    if line_index = line_count then allocated := invoice.invoice_discount_amount - allocated_total;
    elsif raw_taxable_total = 0 then allocated := 0;
    else allocated := round(invoice.invoice_discount_amount * raw_taxable / raw_taxable_total, 2); end if;
    allocated_total := allocated_total + allocated;
    final_taxable := raw_taxable - allocated;
    tax_value := round(final_taxable * line.gst_rate / 100, 2);
    cgst_value := case when interstate then 0 else round(tax_value / 2, 2) end;
    sgst_value := case when interstate then 0 else tax_value - cgst_value end;
    igst_value := case when interstate then tax_value else 0 end;
    update public.sales_items set discount_amount = before_item_taxable - raw_taxable,
      invoice_discount_allocated = allocated, taxable_amount = final_taxable,
      cgst_amount = cgst_value, sgst_amount = sgst_value, igst_amount = igst_value,
      line_total = final_taxable + tax_value where id = line.id;
    taxable_sum := taxable_sum + final_taxable;
    cgst_sum := cgst_sum + cgst_value;
    sgst_sum := sgst_sum + sgst_value;
    igst_sum := igst_sum + igst_value;
    grand := grand + final_taxable + tax_value;
  end loop;
  if invoice.payment_amount > grand then raise exception 'Payment exceeds the invoice total' using errcode = '23514'; end if;
  if invoice.payment_amount > 0 and (invoice.payment_method is null or invoice.payment_method = 'credit') then raise exception 'Select a valid payment method for an amount received' using errcode = '23514'; end if;
  if invoice.payment_amount = 0 then payment_state := 'unpaid';
  elsif invoice.payment_amount >= grand then payment_state := 'paid';
  else payment_state := 'partially_paid'; end if;
  if settings.financial_year_aware then
    fy := case when extract(month from invoice_local_date) >= 4 then to_char(invoice_local_date, 'YY') || '-' || to_char(invoice_local_date + interval '1 year', 'YY') else to_char(invoice_local_date - interval '1 year', 'YY') || '-' || to_char(invoice_local_date, 'YY') end;
    invoice_no := settings.invoice_prefix || '/' || fy || '/' || lpad(settings.next_invoice_number::text, 6, '0');
  else
    invoice_no := settings.invoice_prefix || '/' || lpad(settings.next_invoice_number::text, 6, '0');
  end if;
  update public.business_settings set next_invoice_number = next_invoice_number + 1, updated_at = now() where id = 1;
  update public.sales_invoices set invoice_number = invoice_no, invoice_date = now(), status = 'posted', payment_status = payment_state,
    subtotal = original_subtotal, discount_total = item_discount_total + invoice.invoice_discount_amount,
    taxable_total = taxable_sum, cgst_total = cgst_sum, sgst_total = sgst_sum, igst_total = igst_sum,
    grand_total = grand, amount_paid = invoice.payment_amount, balance_due = grand - invoice.payment_amount,
    posting_key = request_key, posted_at = now(), updated_at = now(), shop_name = settings.shop_name,
    shop_address = settings.address, shop_phone = settings.phone, shop_email = settings.email, shop_gstin = settings.gstin,
    shop_state = settings.state, shop_state_code = settings.state_code, invoice_footer = settings.invoice_footer, invoice_terms = settings.invoice_terms
    where id = target_invoice_id;
  for line in select product_id, id, quantity from public.sales_items where invoice_id = target_invoice_id order by product_id, id loop
    insert into public.stock_movements(product_id, quantity_delta, movement_type, reason, source_type, source_id, idempotency_key, actor_id)
    values (line.product_id, -line.quantity, 'sale', 'Sales invoice ' || invoice_no, 'sale', target_invoice_id,
      'sale:' || target_invoice_id::text || ':' || line.id::text, auth.uid()) on conflict (idempotency_key) do nothing;
  end loop;
  if invoice.payment_amount > 0 then
    insert into public.payments(sales_invoice_id, amount, method, received_by)
    values (target_invoice_id, invoice.payment_amount, invoice.payment_method, auth.uid());
  end if;
  return invoice_no;
end;
$$;

alter table public.customers enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_items enable row level security;
alter table public.payments enable row level security;
grant select, insert, update on public.customers to authenticated;
grant select on public.sales_invoices, public.sales_items, public.payments to authenticated;

create policy "Customer roles read customers" on public.customers for select to authenticated using (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]));
create policy "Customer roles manage customers" on public.customers for all to authenticated using (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[])) with check (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]));
create policy "Sales roles read invoices" on public.sales_invoices for select to authenticated using (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]));
create policy "Sales roles read invoice items" on public.sales_items for select to authenticated using (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]));
create policy "Sales roles read payments" on public.payments for select to authenticated using (public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]));

create trigger audit_customers_change after insert or update on public.customers for each row execute function public.audit_catalog_change();
create trigger audit_sales_change after insert or update on public.sales_invoices for each row execute function public.audit_catalog_change();

revoke all on function public.create_sale_draft(jsonb) from public;
revoke all on function public.post_sale(uuid, text) from public;
grant execute on function public.create_sale_draft(jsonb) to authenticated;
grant execute on function public.post_sale(uuid, text) to authenticated;
