import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(160), phone: z.string().trim().max(30).optional(),
  email: z.union([z.email(), z.literal("")]).optional(), billing_address: z.string().trim().max(800).optional(),
  state: z.string().trim().max(100).optional(), state_code: z.union([z.string().regex(/^\d{2}$/), z.literal("")]).optional(),
  gstin: z.string().trim().toUpperCase().max(15).optional(), customer_type: z.enum(["retail", "wholesale", "business"]),
  opening_balance: z.coerce.number().min(0).max(999999999).default(0),
});
