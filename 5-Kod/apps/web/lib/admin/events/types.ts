// Pure types for the Kurser & event module admin surface (goal-54 körning 4).
// ZERO imports — this file is safe to import from both client and server code.

export type EventRow = {
  id: string
  tenant_id: string
  title: string
  description: string | null
  starts_at: string
  duration_min: number
  capacity: number
  price_cents: number
  status: string
  /** Summa party_size för alla CONFIRMED anmälningar — beräknas i data-lagret. */
  taken: number
}

export type RegistrationRow = {
  id: string
  tenant_id: string
  event_id: string
  name: string
  email: string | null
  phone: string | null
  party_size: number
  message: string | null
  status: string
}

export const EVENT_STATUSES = ['open', 'cancelled', 'done'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  open: 'Öppen',
  cancelled: 'Inställd',
  done: 'Genomförd',
}
