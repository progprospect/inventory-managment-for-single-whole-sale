create table public.returns (
  id uuid primary key default gen_random_uuid(),
  return_number bigint generated always as identity unique,
  return_type text not null check (return_type in ('sales_return','purchase_return')),
  sales_invoice_id uuid references public.sales_invoices(id) on delete restrict,
  purchase_receipt_id uuid references public.purchase_receipts(id) on delete restrict,
  reason text not null,
  status text not null default 'posted' check (status in ('posted','cancelled')),
  amount numeric(14,2) not null default 0,
  disposition text not null check (disposition in ('cash','upi','card','bank_transfer','credit_adjustment','supplier_credit')),
  posting_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((return_type = 'sales_return' and sales_invoice_id is not null and purchase_receipt_id is null)
      or (return_type = 'purchase_return' and purchase_receipt_id is not null and sales_invoice_id is null))
);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete restrict,
  sales_item_id uuid references public.sales_items(id) on delete restrict,
  purchase_item_id uuid references public.purchase_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_amount numeric(14,2) not null check (unit_amount >= 0),
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  line_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  check ((sales_item_id is not null and purchase_item_id is null) or (sales_item_id is null and purchase_item_id is not null))
);

create table public.return_payments (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  disposition text not null check (disposition in ('cash','upi','card','bank_transfer','credit_adjustment','supplier_credit')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index returns_type_date_idx on public.returns(return_type, created_at desc);
create index returns_sales_invoice_idx on public.returns(sales_invoice_id) where sales_invoice_id is not null;
create index returns_purchase_idx on public.returns(purchase_receipt_id) where purchase_receipt_id is not null;
create index return_items_sales_line_idx on public.return_items(sales_item_id) where sales_item_id is not null;
create index return_items_purchase_line_idx on public.return_items(purchase_item_id) where purchase_item_id is not null;

create or replace function public.post_return(return_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  kind text := return_data ->> 'return_type';
  source_id uuid := (return_data ->> 'source_id')::uuid;
  reason_value text := nullif(btrim(return_data ->> 'reason'), '');
  disposition_value text := return_data ->> 'disposition';
  request_key text := nullif(btrim(return_data ->> 'request_key'), '');
  new_return_id uuid := gen_random_uuid();
  source_invoice public.sales_invoices%rowtype;
  source_purchase public.purchase_receipts%rowtype;
  prior_return public.returns%rowtype;
  row_data jsonb;
  original record;
  returned numeric(14,3);
  eligible numeric(14,3);
  qty numeric(14,3);
  amount_value numeric(14,2);
  cgst_value numeric(14,2);
  sgst_value numeric(14,2);
  igst_value numeric(14,2);
  total_amount numeric(14,2) := 0;
  return_movement text;
begin
  if kind = 'sales_return' and not public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]) then
    raise exception 'Not allowed to post sales returns' using errcode = '42501';
  elsif kind = 'purchase_return' and not public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]) then
    raise exception 'Not allowed to post purchase returns' using errcode = '42501';
  elsif kind not in ('sales_return','purchase_return') then
    raise exception 'Invalid return type' using errcode = '23514';
  end if;
  if reason_value is null or request_key is null or jsonb_typeof(return_data -> 'items') <> 'array' or jsonb_array_length(return_data -> 'items') = 0 then
    raise exception 'Reason, idempotency key, and at least one return item are required' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key, 0));
  select * into prior_return from public.returns where posting_key = request_key;
  if found then
    if prior_return.return_type <> kind or prior_return.sales_invoice_id is distinct from case when kind='sales_return' then source_id end
       or prior_return.purchase_receipt_id is distinct from case when kind='purchase_return' then source_id end then
      raise exception 'Idempotency key was already used for another return' using errcode = '23505';
    end if;
    return prior_return.id;
  end if;
  if kind = 'sales_return' then
    select * into source_invoice from public.sales_invoices where id = source_id and status = 'posted' for update;
    if not found then raise exception 'Posted sales invoice not found' using errcode = 'P0002'; end if;
    return_movement := 'sales_return';
  else
    select * into source_purchase from public.purchase_receipts where id = source_id and status = 'posted' for update;
    if not found then raise exception 'Posted purchase receipt not found' using errcode = 'P0002'; end if;
    return_movement := 'purchase_return';
  end if;
  if (kind = 'sales_return' and disposition_value not in ('cash','upi','card','bank_transfer','credit_adjustment'))
     or (kind = 'purchase_return' and disposition_value not in ('supplier_credit','credit_adjustment')) then
    raise exception 'Invalid return adjustment method' using errcode = '23514';
  end if;
  insert into public.returns(id, return_type, sales_invoice_id, purchase_receipt_id, reason, amount, disposition, posting_key, created_by)
  values (new_return_id, kind, case when kind='sales_return' then source_id end, case when kind='purchase_return' then source_id end,
    reason_value, 0, disposition_value, request_key, auth.uid());

  for row_data in select value from jsonb_array_elements(return_data -> 'items') loop
    if kind = 'sales_return' then
      select si.*, si.quantity - coalesce((select sum(ri.quantity) from public.return_items ri join public.returns r on r.id=ri.return_id where ri.sales_item_id=si.id and r.status='posted'),0) as remaining
      into original from public.sales_items si where si.id=(row_data ->> 'sales_item_id')::uuid and si.invoice_id=source_id for update;
      if not found then raise exception 'Sales invoice item not found' using errcode = 'P0002'; end if;
      qty := (row_data ->> 'quantity')::numeric;
      eligible := original.remaining;
      if qty <= 0 or qty > eligible then raise exception 'Return quantity exceeds the eligible sales quantity' using errcode = '23514'; end if;
      amount_value := round(qty * original.line_total / original.quantity, 2);
      cgst_value := round(qty * original.cgst_amount / original.quantity, 2);
      sgst_value := round(qty * original.sgst_amount / original.quantity, 2);
      igst_value := round(qty * original.igst_amount / original.quantity, 2);
      insert into public.return_items(return_id, sales_item_id, product_id, product_name, sku, quantity, unit_amount, cgst_amount, sgst_amount, igst_amount, line_amount)
      values (new_return_id, original.id, original.product_id, original.product_name, original.sku, qty,
        round(original.unit_price * (1 - original.discount_percent / 100), 2), cgst_value, sgst_value, igst_value, amount_value);
      total_amount := total_amount + amount_value;
    else
      select pi.*, pi.quantity - coalesce((select sum(ri.quantity) from public.return_items ri join public.returns r on r.id=ri.return_id where ri.purchase_item_id=pi.id and r.status='posted'),0) as remaining
      into original from public.purchase_items pi where pi.id=(row_data ->> 'purchase_item_id')::uuid and pi.purchase_id=source_id for update;
      if not found then raise exception 'Purchase receipt item not found' using errcode = 'P0002'; end if;
      qty := (row_data ->> 'quantity')::numeric;
      eligible := original.remaining;
      if qty <= 0 or qty > eligible then raise exception 'Return quantity exceeds the eligible purchase quantity' using errcode = '23514'; end if;
      amount_value := round(qty * original.line_total / original.quantity, 2);
      cgst_value := round(qty * original.cgst_amount / original.quantity, 2);
      sgst_value := round(qty * original.sgst_amount / original.quantity, 2);
      igst_value := round(qty * original.igst_amount / original.quantity, 2);
      insert into public.return_items(return_id, purchase_item_id, product_id, product_name, sku, quantity, unit_amount, cgst_amount, sgst_amount, igst_amount, line_amount)
      values (new_return_id, original.id, original.product_id, original.product_name, original.sku, qty,
        original.purchase_rate, cgst_value, sgst_value, igst_value, amount_value);
      total_amount := total_amount + amount_value;
    end if;
  end loop;

  perform p.id from public.products p where p.id in (select product_id from public.return_items where return_id=new_return_id) order by p.id for update;
  if kind = 'purchase_return' and exists (
    select 1 from (select product_id, sum(quantity) quantity from public.return_items where return_id=new_return_id group by product_id) r
    where coalesce((select sum(sm.quantity_delta) from public.stock_movements sm where sm.product_id=r.product_id),0) < r.quantity
  ) then raise exception 'Insufficient stock for this purchase return' using errcode = '23514'; end if;

  update public.returns set amount = total_amount where id = new_return_id;

  if kind = 'sales_return' then
    insert into public.stock_movements(product_id, quantity_delta, movement_type, reason, source_type, source_id, idempotency_key, actor_id)
    select product_id, quantity, 'sales_return', reason_value, 'return', new_return_id, 'return:'||new_return_id::text||':'||id::text, auth.uid()
    from public.return_items where return_id=new_return_id;
  else
    insert into public.stock_movements(product_id, quantity_delta, movement_type, reason, source_type, source_id, idempotency_key, actor_id)
    select product_id, -quantity, 'purchase_return', reason_value, 'return', new_return_id, 'return:'||new_return_id::text||':'||id::text, auth.uid()
    from public.return_items where return_id=new_return_id;
  end if;
  if total_amount > 0 then insert into public.return_payments(return_id, amount, disposition, created_by) values (new_return_id,total_amount,disposition_value,auth.uid()); end if;
  return new_return_id;
end;
$$;

alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.return_payments enable row level security;
grant select on public.returns, public.return_items, public.return_payments to authenticated;
create policy "Sales or purchase roles read returns" on public.returns for select to authenticated using (
  (return_type='sales_return' and public.has_any_role(array['owner_admin','manager','billing_staff']::public.app_role[]))
  or (return_type='purchase_return' and public.has_any_role(array['owner_admin','manager','inventory_staff']::public.app_role[]))
);
create policy "Authorized staff read return items" on public.return_items for select to authenticated using (
  exists (select 1 from public.returns r where r.id=return_id)
);
create policy "Authorized staff read return payments" on public.return_payments for select to authenticated using (
  exists (select 1 from public.returns r where r.id=return_id)
);

create trigger audit_returns_change after insert or update on public.returns for each row execute function public.audit_catalog_change();
revoke all on function public.post_return(jsonb) from public;
grant execute on function public.post_return(jsonb) to authenticated;
