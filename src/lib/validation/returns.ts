import { z } from "zod";

export const returnSchema = z.object({
  return_type: z.enum(["sales_return", "purchase_return"]), source_id: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  disposition: z.enum(["cash", "upi", "card", "bank_transfer", "credit_adjustment", "supplier_credit"]),
  items: z.array(z.object({ sales_item_id: z.uuid().optional(), purchase_item_id: z.uuid().optional(), quantity: z.coerce.number().positive() })).min(1).max(200),
});
