import { z } from "zod";

export const saleDraftSchema = z.object({
  customer_id: z.union([z.uuid(), z.literal("")]),
  invoice_discount_amount: z.coerce.number().min(0).max(999999999),
  payment_amount: z.coerce.number().min(0).max(999999999),
  payment_method: z.enum(["cash", "upi", "card", "bank_transfer", "credit"]),
  items: z.array(z.object({
    product_id: z.uuid(), quantity: z.coerce.number().positive().max(999999999),
    unit_price: z.coerce.number().min(0).max(999999999), discount_percent: z.coerce.number().min(0).max(100),
  })).min(1).max(200),
});
