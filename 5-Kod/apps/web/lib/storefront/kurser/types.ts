// Kurser/event-modul (goal-54 körning 4) — PURE twin. No I/O, no 'server-only':
// this file is safe to import from BOTH the server loader/action and the
// 'use client' anmälningsformulär (same fence as lib/storefront/offert/types).

/** Ett kommande kurstillfälle, format-klart för storefront-rendering. */
export type UpcomingEvent = {
  id: string
  title: string
  description: string | null
  startsAt: string // ISO
  durationMin: number
  capacity: number
  priceCents: number
  /**
   * Summa bekräftade platser (party_size för status='confirmed').
   * null = kunde inte räknas (service-nyckel saknas) → UI:t visar bara
   * kapaciteten ("Max Y platser") istället för "Y platser kvar".
   */
  taken: number | null
}

/**
 * goal-64 — BETALAS KURSEN PÅ PLATS ELLER I KASSAN?
 *
 * 0052 byggde anmälan UTAN betalning ("avgiften visas och bekräftas, betalas på plats").
 * Calytrix designar kursen som ett KÖP: "Boka din plats direkt — kursplatsen läggs i
 * varukorgen och betalas i kassan som allt annat."
 *
 * Båda är sanna, för olika kunder. Alltså: ett val per kund
 * (tenant_modules.config.payment), inte ett bransch-if och inte ett byte som tvingar
 * någon att ändra sitt sätt att ta betalt.
 *
 *   'onsite'   — DEFAULT. KursAnmalanForm, oförändrad. Ingen kassa, ingen korg.
 *   'checkout' — kursplatsen läggs i varukorgen (radtyp 'event', 0059), håller en plats
 *                i capacity precis som en produkt håller lager, och betalas i kassan.
 *                Anmälan (event_registrations) skapas när ordern är BETALD.
 */
export const KURS_PAYMENTS = ['onsite', 'checkout'] as const
export type KursPayment = (typeof KURS_PAYMENTS)[number]

export type KurserConfig = {
  payment: KursPayment
}

/** Defensiv coercion av tenant_modules.config för kurser-modulen (0056 seedar {}).
 *  Okänt/saknat värde → 'onsite': ingen kund börjar plötsligt ta betalt i kassan för
 *  att en config-rad var trasig. */
export function parseKurserConfig(raw: unknown): KurserConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { payment: 'onsite' }
  const p = (raw as Record<string, unknown>).payment
  return { payment: p === 'checkout' ? 'checkout' : 'onsite' }
}

export type KursSubmitState =
  | { phase: 'idle' }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

export const KURS_SUBMIT_INITIAL: KursSubmitState = { phase: 'idle' }

/** 'Gratis' vid 0, annars 'X kr' (heltal, sv-SE-grupperat). */
export function formatEventPrice(priceCents: number): string {
  if (priceCents <= 0) return 'Gratis'
  return `${Math.round(priceCents / 100).toLocaleString('sv-SE')} kr`
}

/** Datum + tid i Europe/Stockholm, sv-SE — t.ex. "torsdag 12 mars 2026 · 18.00". */
export function formatEventStart(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${date} · ${time}`
}
