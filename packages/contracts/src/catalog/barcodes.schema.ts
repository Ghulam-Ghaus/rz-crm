import { z } from 'zod';

export const BarcodeLookupInputSchema = z.object({
  barcodeValue: z.string().min(1).max(100),
});

export type BarcodeLookupInput = z.infer<typeof BarcodeLookupInputSchema>;

export const ResolvedBarcodeResultSchema = z.object({
  barcodeValue: z.string(),
  product: z.object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
  }),
  variant: z.object({
    id: z.number().int().positive(),
    sku: z.string(),
    name: z.string(),
    priceMinorUnits: z.number().int(),
    currencyCode: z.string(),
  }),
  baseUnitCode: z.string(),
  taxBasisPoints: z.number().int().default(0),
});

export type ResolvedBarcodeResult = z.infer<typeof ResolvedBarcodeResultSchema>;
