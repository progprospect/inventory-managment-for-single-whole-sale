create or replace function public.dashboard_summary(day_start timestamptz, month_start timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  app_role public.app_role := public.current_app_role();
  sales_today numeric(14,2) := 0;
  sales_month numeric(14,2) := 0;
  purchases_month numeric(14,2) := 0;
  stock_cost numeric(18,2) := 0;
  low_count bigint := 0;
  out_count bigint := 0;
  due_total numeric(18,2) := 0;
  open_count bigint := 0;
begin
  if app_role is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if app_role in ('owner_admin','manager','billing_staff') then
    select coalesce(sum(grand_total),0)::numeric(14,2)
    into sales_today from public.sales_invoices
    where status='posted' and invoice_date >= day_start and invoice_date < now();
    select coalesce(sum(grand_total),0)::numeric(14,2)
    into sales_month from public.sales_invoices
    where status='posted' and invoice_date >= month_start and invoice_date < now();
    select coalesce(sum(balance_due),0)::numeric(18,2) into due_total from public.sales_invoices where status='posted';
    select count(*) into open_count from public.sales_invoices where status='posted' and balance_due > 0;
    select due_total + coalesce(sum(opening_balance),0) into due_total from public.customers where not is_archived;
  end if;
  if app_role in ('owner_admin','manager','inventory_staff') then
    select coalesce(sum(grand_total),0)::numeric(14,2) into purchases_month from public.purchase_receipts
    where status='posted' and posted_at >= month_start and posted_at < now();
  end if;
  if app_role in ('owner_admin','manager','inventory_staff','billing_staff') then
    select coalesce(sum(coalesce(balance.current_stock,0) * p.purchase_price),0)::numeric(18,2),
      count(*) filter (where balance.stock_status='low_stock'), count(*) filter (where balance.stock_status='out_of_stock')
    into stock_cost, low_count, out_count
    from public.products p left join public.product_stock balance on balance.product_id=p.id where not p.is_archived;
  end if;
  return jsonb_build_object(
    'today_sales', sales_today, 'month_sales', sales_month, 'month_purchases', purchases_month,
    'stock_value', stock_cost, 'low_stock_count', low_count, 'out_of_stock_count', out_count,
    'outstanding_balance', due_total, 'open_invoices', open_count
  );
end;
$$;

revoke all on function public.dashboard_summary(timestamptz, timestamptz) from public;
grant execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;

create or replace function public.report_summary(period_start timestamptz, period_end timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  app_role public.app_role := public.current_app_role();
  sales_total numeric(18,2) := 0;
  sales_returns numeric(18,2) := 0;
  sales_taxable numeric(18,2) := 0;
  sales_cgst numeric(18,2) := 0;
  sales_sgst numeric(18,2) := 0;
  sales_igst numeric(18,2) := 0;
  sales_return_cgst numeric(18,2) := 0;
  sales_return_sgst numeric(18,2) := 0;
  sales_return_igst numeric(18,2) := 0;
  purchase_total numeric(18,2) := 0;
  purchase_returns numeric(18,2) := 0;
  purchase_cgst numeric(18,2) := 0;
  purchase_sgst numeric(18,2) := 0;
  purchase_igst numeric(18,2) := 0;
  purchase_return_cgst numeric(18,2) := 0;
  purchase_return_sgst numeric(18,2) := 0;
  purchase_return_igst numeric(18,2) := 0;
  sales_count bigint := 0;
  purchase_count bigint := 0;
begin
  if app_role not in ('owner_admin','manager','billing_staff','inventory_staff') then raise exception 'Not authorized to view reports' using errcode = '42501'; end if;
  if period_end <= period_start then raise exception 'Report end must follow report start' using errcode = '23514'; end if;
  if app_role in ('owner_admin','manager','billing_staff') then
    select coalesce(sum(grand_total),0), coalesce(sum(taxable_total),0), coalesce(sum(cgst_total),0),
      coalesce(sum(sgst_total),0), coalesce(sum(igst_total),0), count(*)
    into sales_total,sales_taxable,sales_cgst,sales_sgst,sales_igst,sales_count
    from public.sales_invoices where status='posted' and invoice_date >= period_start and invoice_date < period_end;
    select coalesce(sum(amount),0) into sales_returns from public.returns
    where return_type='sales_return' and status='posted' and created_at >= period_start and created_at < period_end;
    select coalesce(sum(ri.cgst_amount),0), coalesce(sum(ri.sgst_amount),0), coalesce(sum(ri.igst_amount),0)
    into sales_return_cgst,sales_return_sgst,sales_return_igst
    from public.return_items ri join public.returns r on r.id=ri.return_id
    where r.return_type='sales_return' and r.status='posted' and r.created_at >= period_start and r.created_at < period_end;
  end if;
  if app_role in ('owner_admin','manager','inventory_staff') then
    select coalesce(sum(grand_total),0), coalesce(sum(cgst_total),0), coalesce(sum(sgst_total),0), coalesce(sum(igst_total),0), count(*)
    into purchase_total,purchase_cgst,purchase_sgst,purchase_igst,purchase_count
    from public.purchase_receipts where status='posted' and posted_at >= period_start and posted_at < period_end;
    select coalesce(sum(amount),0) into purchase_returns from public.returns
    where return_type='purchase_return' and status='posted' and created_at >= period_start and created_at < period_end;
    select coalesce(sum(ri.cgst_amount),0), coalesce(sum(ri.sgst_amount),0), coalesce(sum(ri.igst_amount),0)
    into purchase_return_cgst,purchase_return_sgst,purchase_return_igst
    from public.return_items ri join public.returns r on r.id=ri.return_id
    where r.return_type='purchase_return' and r.status='posted' and r.created_at >= period_start and r.created_at < period_end;
  end if;
  return jsonb_build_object(
    'sales_total',sales_total,'sales_returns',sales_returns,'sales_net',sales_total-sales_returns,
    'sales_taxable',sales_taxable,'sales_cgst',sales_cgst,'sales_sgst',sales_sgst,'sales_igst',sales_igst,
    'sales_net_cgst',sales_cgst-sales_return_cgst,'sales_net_sgst',sales_sgst-sales_return_sgst,'sales_net_igst',sales_igst-sales_return_igst,'sales_count',sales_count,
    'purchase_total',purchase_total,'purchase_returns',purchase_returns,'purchase_net',purchase_total-purchase_returns,
    'purchase_cgst',purchase_cgst,'purchase_sgst',purchase_sgst,'purchase_igst',purchase_igst,
    'purchase_net_cgst',purchase_cgst-purchase_return_cgst,'purchase_net_sgst',purchase_sgst-purchase_return_sgst,'purchase_net_igst',purchase_igst-purchase_return_igst,'purchase_count',purchase_count
  );
end;
$$;

revoke all on function public.report_summary(timestamptz, timestamptz) from public;
grant execute on function public.report_summary(timestamptz, timestamptz) to authenticated;

create or replace function public.report_daily_sales(period_start timestamptz, period_end timestamptz)
returns table(sale_day date, invoice_count bigint, sales_total numeric, tax_total numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if public.current_app_role() not in ('owner_admin','manager','billing_staff') then raise exception 'Not authorized to view sales reports' using errcode = '42501'; end if;
  return query select (i.invoice_date at time zone 'Asia/Kolkata')::date, count(*)::bigint,
    coalesce(sum(i.grand_total),0)::numeric(18,2), coalesce(sum(i.cgst_total+i.sgst_total+i.igst_total),0)::numeric(18,2)
  from public.sales_invoices i where i.status='posted' and i.invoice_date >= period_start and i.invoice_date < period_end
  group by (i.invoice_date at time zone 'Asia/Kolkata')::date order by 1;
end;
$$;

revoke all on function public.report_daily_sales(timestamptz, timestamptz) from public;
grant execute on function public.report_daily_sales(timestamptz, timestamptz) to authenticated;
