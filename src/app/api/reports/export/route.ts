import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { indiaDateString, indiaDayBounds, indiaMonthStart, isDateString } from "@/lib/time/india";

type Row = Record<string, unknown>;
const kinds = ["sales", "purchases", "stock", "sales-returns", "purchase-returns", "gst"] as const;
type Kind = typeof kinds[number];

function toCsv(rows: Row[], headers: string[]) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[=+@\t\r]/.test(text) || (typeof value === "string" && /^-/.test(text))) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers.map(cell).join(","), ...rows.map((row) => headers.map((key) => cell(row[key])).join(","))].join("\r\n");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const role = roleData?.role ?? "";
  const url = request.nextUrl;
  const kind = url.searchParams.get("kind") as Kind | null;
  if (!kind || !kinds.includes(kind)) return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  if (["sales", "sales-returns", "gst"].includes(kind) && !["owner_admin", "manager", "billing_staff"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (["purchases", "purchase-returns"].includes(kind) && !["owner_admin", "manager", "inventory_staff"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (kind === "stock" && !["owner_admin", "manager", "inventory_staff", "billing_staff"].includes(role)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const today = indiaDateString();
  const from = isDateString(fromDate) ? fromDate : indiaMonthStart(today);
  const to = isDateString(toDate) ? toDate : today;
  if (from > to) return NextResponse.json({ error: "The end date must be on or after the start date." }, { status: 400 });
  const start = indiaDayBounds(from).start;
  const end = indiaDayBounds(to).end;
  let rows: Row[] = [];
  let headers: string[] = [];

  if (kind === "sales") {
    const { data, error } = await supabase.from("sales_invoices").select("invoice_number,invoice_date,customer_name,customer_gstin,subtotal,discount_total,taxable_total,cgst_total,sgst_total,igst_total,grand_total,amount_paid,balance_due,payment_status").eq("status", "posted").gte("invoice_date", start).lt("invoice_date", end).order("invoice_date").limit(50000);
    if (error) return NextResponse.json({ error: "Could not export sales." }, { status: 500 });
    rows = (data ?? []).map((item) => ({ ...item, invoice_date: new Date(item.invoice_date).toISOString() }));
    headers = ["invoice_number","invoice_date","customer_name","customer_gstin","subtotal","discount_total","taxable_total","cgst_total","sgst_total","igst_total","grand_total","amount_paid","balance_due","payment_status"];
  } else if (kind === "purchases") {
    const { data, error } = await supabase.from("purchase_receipts").select("receipt_number,supplier_id,supplier_invoice_number,supplier_invoice_date,subtotal,discount_total,taxable_total,cgst_total,sgst_total,igst_total,grand_total,posted_at").eq("status", "posted").gte("posted_at", start).lt("posted_at", end).order("posted_at").limit(50000);
    if (error) return NextResponse.json({ error: "Could not export purchases." }, { status: 500 });
    const supplierIds = [...new Set((data ?? []).map((item) => item.supplier_id))];
    const { data: suppliers } = supplierIds.length ? await supabase.from("suppliers").select("id,name").in("id", supplierIds) : { data: [] };
    const supplierMap = new Map((suppliers ?? []).map((item) => [item.id, item.name]));
    rows = (data ?? []).map((item) => ({ ...item, supplier_name: supplierMap.get(item.supplier_id) ?? "", receipt_number: `PUR-${item.receipt_number}` }));
    headers = ["receipt_number","supplier_name","supplier_invoice_number","supplier_invoice_date","subtotal","discount_total","taxable_total","cgst_total","sgst_total","igst_total","grand_total","posted_at"];
  } else if (kind === "stock") {
    const { data: stock, error } = await supabase.from("product_stock").select("product_id,current_stock,stock_status").limit(50000);
    if (error) return NextResponse.json({ error: "Could not export stock." }, { status: 500 });
    const ids = (stock ?? []).map((item) => item.product_id);
    const [{ data: products }, { data: units }] = await Promise.all([
      supabase.from("products").select("id,name,sku,barcode,purchase_price,wholesale_price,minimum_stock,unit_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("is_archived", false),
      supabase.from("units").select("id,abbreviation"),
    ]);
    const unitMap = new Map((units ?? []).map((item) => [item.id, item.abbreviation]));
    const stockMap = new Map((stock ?? []).map((item) => [item.product_id, item]));
    rows = (products ?? []).map((product) => ({ ...product, ...stockMap.get(product.id), unit: unitMap.get(product.unit_id) ?? "" }));
    headers = ["name","sku","barcode","current_stock","unit","minimum_stock","stock_status","purchase_price","wholesale_price"];
  } else if (kind === "sales-returns" || kind === "purchase-returns") {
    const type = kind === "sales-returns" ? "sales_return" : "purchase_return";
    const { data, error } = await supabase.from("returns").select("return_number,return_type,sales_invoice_id,purchase_receipt_id,reason,amount,disposition,created_at").eq("return_type", type).eq("status", "posted").gte("created_at", start).lt("created_at", end).order("created_at").limit(50000);
    if (error) return NextResponse.json({ error: "Could not export returns." }, { status: 500 });
    rows = (data ?? []).map((item) => ({ ...item, return_number: `RET-${item.return_number}` }));
    headers = ["return_number","return_type","sales_invoice_id","purchase_receipt_id","reason","amount","disposition","created_at"];
  } else {
    const { data, error } = await supabase.rpc("report_summary", { period_start: start, period_end: end });
    if (error) return NextResponse.json({ error: "Could not export GST summary." }, { status: 500 });
    rows = data ? [data as Row] : [];
    headers = Object.keys(rows[0] ?? {});
  }

  const body = `\ufeff${toCsv(rows, headers)}`;
  return new NextResponse(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${kind}-${from}-to-${to}.csv"`,
    "Cache-Control": "no-store",
  } });
}
