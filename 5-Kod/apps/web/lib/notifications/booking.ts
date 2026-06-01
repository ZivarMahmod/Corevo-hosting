import 'server-only'
import { sendEmail } from './email'
import { logger } from '@/lib/observability'
import {
  confirmationEmail,
  cancellationEmail,
  reminderEmail,
  receiptEmail,
  type BookingEmailData,
} from './templates'

// Booking notification orchestration (G10 step 3). Each function is BEST-EFFORT:
// it never throws and never returns a rejected promise into the caller, so a mail
// hiccup can't break a booking/cancel/payment. Callers may `await` (to keep the
// Workers request alive long enough to send) or fire-and-forget.

// Guest-note parsers live in ./parse (pure, unit-tested); re-exported here so
// callers keep importing them from the orchestration module.
export { parseGuestEmail, parseGuestName } from './parse'

async function safeSend(kind: string, to: string | null | undefined, mail: { subject: string; html: string }): Promise<void> {
  if (!to) {
    logger.info('notify.skipped_no_recipient', { kind })
    return
  }
  const res = await sendEmail({ to, subject: mail.subject, html: mail.html })
  if (res.ok) logger.info('notify.sent', { kind, to })
  else if (!res.skipped) logger.warn('notify.failed', { kind, to, error: res.error })
}

export async function sendBookingConfirmation(to: string, d: BookingEmailData): Promise<void> {
  await safeSend('booking.confirmation', to, confirmationEmail(d))
}

export async function sendBookingCancellation(to: string, d: BookingEmailData): Promise<void> {
  await safeSend('booking.cancellation', to, cancellationEmail(d))
}

export async function sendBookingReminder(to: string, d: BookingEmailData): Promise<void> {
  await safeSend('booking.reminder', to, reminderEmail(d))
}

export async function sendPaymentReceipt(
  to: string | null,
  d: BookingEmailData & { amountCents: number; currency: string },
): Promise<void> {
  await safeSend('payment.receipt', to, receiptEmail(d))
}
