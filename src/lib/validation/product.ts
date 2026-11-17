import { z } from "zod";

export const productSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().max(40).optional().default(""),
  barcode: z.string().trim().max(80).optional().default(""),
  name: z.string().trim().min(1, "Product name is required.").max(160),
  description: z.string().trim().max(1000).optional().default(""),
  category_id: z.union([z.uuid(), z.literal("")]).optional().default(""),
  unit_id: z.uuid("Select a unit."),
  purchase_price: z.coerce.number().min(0).max(999999999),
  wholesale_price: z.coerce.number().min(0).max(999999999),
  alternate_price: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().min(0).max(999999999).optional()),
  gst_rate: z.coerce.number().min(0).max(100),
  hsn_code: z.string().trim().max(20).optional().default(""),
  opening_stock: z.coerce.number().min(0).max(999999999).optional().default(0),
  minimum_stock: z.coerce.number().min(0).max(999999999).optional().default(0),
});

export type ProductInput = z.infer<typeof productSchema>;

export const stockAdjustmentSchema = z.object({
  product_id: z.uuid(),
  quantity_delta: z.coerce.number().refine((value) => value !== 0, "Adjustment quantity cannot be zero."),
  reason: z.string().trim().min(3).max(240),
  request_key: z.uuid(),
});
