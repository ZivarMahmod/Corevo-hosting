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
