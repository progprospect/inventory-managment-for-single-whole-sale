import { z } from "zod";

export const businessSettingsSchema = z.object({
  shop_name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).nullable(),
  phone: z.string().trim().max(30).nullable(),
  email: z.union([z.email(), z.literal("")]).nullable(),
  gstin: z.string().trim().toUpperCase().max(15).nullable(),
  state: z.string().trim().max(100).nullable(),
  state_code: z.string().regex(/^\d{2}$/).nullable(),
  invoice_prefix: z.string().trim().min(1).max(20),
  default_gst_rate: z.number().min(0).max(100),
  prices_include_tax: z.boolean(),
  invoice_footer: z.string().trim().max(1000).nullable(),
  invoice_terms: z.string().trim().max(2000).nullable(),
});

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
