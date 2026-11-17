import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReceiptPdf } from "@/lib/invoices/receipt-pdf";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager", "billing_staff"].includes(role?.role ?? "")) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("sales_invoices").select("*").eq("id", id).eq("status", "posted").single(),
    supabase.from("sales_items").select("*").eq("invoice_id", id).order("created_at"),
  ]);
  if (error || !invoice) return NextResponse.json({ error: "Posted invoice not found." }, { status: 404 });
  if (itemsError) return NextResponse.json({ error: "Could not load invoice items." }, { status: 500 });
  try {
    const fontsPath = path.join(process.cwd(), "public", "fonts");
    const [latin, devanagari] = await Promise.all([
      readFile(path.join(fontsPath, "noto-sans-latin.woff")),
      readFile(path.join(fontsPath, "noto-sans-devanagari.woff")),
    ]);
    const bytes = await createReceiptPdf(invoice, items ?? [], { latin, devanagari });
    const filename = `${String(invoice.invoice_number).replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(Buffer.from(bytes), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return NextResponse.json({ error: "Could not generate the invoice PDF." }, { status: 500 });
  }
}
