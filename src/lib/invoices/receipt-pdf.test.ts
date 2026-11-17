import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createReceiptPdf, type ReceiptInvoice, type ReceiptItem } from "@/lib/invoices/receipt-pdf";

const invoice: ReceiptInvoice = {
  invoice_number: "INV/26-27/000001", invoice_date: "2026-11-17T10:00:00.000Z", customer_name: "अनिल ट्रेडर्स",
  customer_phone: "9876543210", customer_address: "Market Road", customer_gstin: null, payment_status: "partially_paid",
  shop_name: "Wholesale Desk", shop_address: "12 Market Road", shop_phone: "9999999999", shop_email: null,
  shop_gstin: "27ABCDE1234F1Z5", invoice_footer: "Thank you", invoice_terms: null,
  subtotal: 100, discount_total: 5, cgst_total: 8.55, sgst_total: 8.55, igst_total: 0,
  grand_total: 112.1, amount_paid: 50, balance_due: 62.1,
};
const items: ReceiptItem[] = [{
  product_name: "चाय पत्ती 1kg", sku: "TEA-1", quantity: 1, unit_name: "pc", unit_price: 100,
  discount_amount: 5, invoice_discount_allocated: 0, taxable_amount: 95, gst_rate: 18,
  cgst_amount: 8.55, sgst_amount: 8.55, igst_amount: 0, line_total: 112.1,
}];

describe("invoice receipt PDF", () => {
  it("generates a compact PDF with embedded Devanagari font support", async () => {
    const fontsPath = path.join(process.cwd(), "public", "fonts");
    const [latin, devanagari] = await Promise.all([
      readFile(path.join(fontsPath, "noto-sans-latin.woff")),
      readFile(path.join(fontsPath, "noto-sans-devanagari.woff")),
    ]);
    const bytes = await createReceiptPdf(invoice, items, { latin, devanagari });
    const signature = Buffer.from(bytes.slice(0, 8)).toString("ascii");
    expect(signature).toContain("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
