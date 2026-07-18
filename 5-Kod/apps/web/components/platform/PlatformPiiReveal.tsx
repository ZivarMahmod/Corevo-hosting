'use client'

import {
  PiiReveal,
  type PiiContact,
} from '@/components/portal/ui/PiiReveal'
import { revealPlatformCustomerContact } from '@/lib/platform/actions'

/** Client-only bridge from the shared reveal UI to the platform server action. */
export function PlatformPiiReveal({
  customerId,
  tenantId,
  maskedEmail,
  maskedPhone,
  label,
  note,
  onContactChange,
}: {
  customerId: string
  tenantId: string
  maskedEmail: string
  maskedPhone: string
  label?: string
  note?: string
  onContactChange?: (contact: PiiContact | null) => void
}) {
  return (
    <PiiReveal
      maskedEmail={maskedEmail}
      maskedPhone={maskedPhone}
      loadContact={() => revealPlatformCustomerContact({ customerId, tenantId })}
      label={label}
      note={note}
      onContactChange={onContactChange}
    />
  )
}
