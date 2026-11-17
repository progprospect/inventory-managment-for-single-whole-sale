import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160), contact_person: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(), email: z.union([z.email(), z.literal("")]).optional(),
  address: z.string().trim().max(800).optional(), gstin: z.string().trim().toUpperCase().max(15).optional(),
  state: z.string().trim().max(100).optional(), state_code: z.union([z.string().regex(/^\d{2}$/), z.literal("")]).optional(),
  opening_balance: z.coerce.number().min(0).max(999999999).default(0),
});

export const purchaseDraftSchema = z.object({
  supplier_id: z.uuid(), supplier_invoice_number: z.string().trim().min(1).max(80),
  supplier_invoice_date: z.iso.date(),
  items: z.array(z.object({
    product_id: z.uuid(), quantity: z.coerce.number().positive(), purchase_rate: z.coerce.number().min(0),
    discount_percent: z.coerce.number().min(0).max(100), gst_rate: z.coerce.number().min(0).max(100),
  })).min(1),
});
