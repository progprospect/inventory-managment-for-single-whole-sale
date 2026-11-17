import { describe, expect, it } from "vitest";
import { customerSchema } from "@/lib/validation/customer";
import { purchaseDraftSchema, supplierSchema } from "@/lib/validation/purchasing";
import { saleDraftSchema } from "@/lib/validation/sales";
import { returnSchema } from "@/lib/validation/returns";

const uuid = "3b04bb6d-183d-4bc8-93ee-b835f7157791";

describe("customer and supplier validation", () => {
  it("accepts walk-in style customer records with no GSTIN", () => {
    expect(customerSchema.safeParse({ name: "Local Retailer", customer_type: "wholesale", opening_balance: "0" }).success).toBe(true);
  });
  it("requires supplier names and valid state codes", () => {
    expect(supplierSchema.safeParse({ name: "", state_code: "1", opening_balance: "0" }).success).toBe(false);
  });
});

describe("purchase and sales draft validation", () => {
  it("requires a purchase supplier, invoice reference, and at least one line", () => {
    expect(purchaseDraftSchema.safeParse({ supplier_id: uuid, supplier_invoice_number: "A-1", supplier_invoice_date: "2026-11-17", items: [{ product_id: uuid, quantity: "3", purchase_rate: "10", discount_percent: "5", gst_rate: "18" }] }).success).toBe(true);
    expect(purchaseDraftSchema.safeParse({ supplier_id: uuid, supplier_invoice_number: "A-1", supplier_invoice_date: "2026-11-17", items: [] }).success).toBe(false);
  });
  it("rejects negative payment and discounts over 100 percent", () => {
    const sale = { customer_id: "", invoice_discount_amount: "0", payment_amount: "0", payment_method: "cash", items: [{ product_id: uuid, quantity: "1", unit_price: "20", discount_percent: "0" }] };
    expect(saleDraftSchema.safeParse(sale).success).toBe(true);
    expect(saleDraftSchema.safeParse({ ...sale, payment_amount: "-1" }).success).toBe(false);
    expect(saleDraftSchema.safeParse({ ...sale, items: [{ ...sale.items[0], discount_percent: "100.1" }] }).success).toBe(false);
  });
});

describe("return validation", () => {
  it("requires positive return quantities and a reason", () => {
    const value = { return_type: "sales_return", source_id: uuid, reason: "Damaged goods", disposition: "cash", items: [{ sales_item_id: uuid, quantity: "1" }] };
    expect(returnSchema.safeParse(value).success).toBe(true);
    expect(returnSchema.safeParse({ ...value, items: [{ sales_item_id: uuid, quantity: "0" }] }).success).toBe(false);
    expect(returnSchema.safeParse({ ...value, reason: "" }).success).toBe(false);
  });
});
