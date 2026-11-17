import { describe, expect, it } from "vitest";
import { productSchema, stockAdjustmentSchema } from "@/lib/validation/product";

describe("product validation", () => {
  it("accepts a product with numeric financial and stock values", () => {
    const parsed = productSchema.safeParse({
      name: "Cooking Oil 1 L", unit_id: "3b04bb6d-183d-4bc8-93ee-b835f7157791",
      purchase_price: "120.25", wholesale_price: "145.50", gst_rate: "5", minimum_stock: "6", opening_stock: "20",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.purchase_price).toBe(120.25);
      expect(parsed.data.opening_stock).toBe(20);
    }
  });

  it("rejects negative prices, invalid tax rates, and missing units", () => {
    const parsed = productSchema.safeParse({ name: "Test", unit_id: "", purchase_price: "-1", wholesale_price: "3", gst_rate: "101" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a SKU longer than the catalogue limit", () => {
    expect(productSchema.safeParse({ name: "Test", unit_id: "c5cd2005-b555-4426-a5f2-8cf98d645846", purchase_price: 0, wholesale_price: 0, gst_rate: 0, sku: "A".repeat(41) }).success).toBe(false);
  });
});

describe("stock adjustment validation", () => {
  it("requires a nonzero quantity, reason, UUID product, and idempotency key", () => {
    const values = { product_id: "3b04bb6d-183d-4bc8-93ee-b835f7157791", quantity_delta: "-2.5", reason: "Physical count correction", request_key: "c5cd2005-b555-4426-a5f2-8cf98d645846" };
    expect(stockAdjustmentSchema.safeParse(values).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ ...values, quantity_delta: "0" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ ...values, request_key: "retry" }).success).toBe(false);
  });
});
