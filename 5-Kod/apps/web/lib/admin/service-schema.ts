import { z } from 'zod'
import { parseTenantMoneyInput } from '@/lib/tenant-region'

const DURATION_ERROR = 'Ange en giltig varaktighet (minuter).'
const PRICE_ERROR = 'Ange ett giltigt pris större än 0 kr.'

export function servicePriceCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const cents = parseTenantMoneyInput(normalized)
  return cents !== null && Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, 'Ange ett namn.'),
  category: z.string().trim(),
  duration_min: z.number({ error: DURATION_ERROR }).int(DURATION_ERROR).positive(DURATION_ERROR),
  price: z
    .string()
    .trim()
    .refine((value) => servicePriceCents(value) !== null, PRICE_ERROR),
})

export type ServiceFormValues = z.infer<typeof serviceFormSchema>

export function parseServiceFormData(formData: FormData) {
  return serviceFormSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    category: String(formData.get('category') ?? ''),
    duration_min: Number(formData.get('duration_min')),
    price: String(formData.get('price') ?? ''),
  })
}
