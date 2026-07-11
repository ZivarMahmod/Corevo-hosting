import type { BadgeTone } from './Badge'

/** EN delad status→Badge-tone-tabell för alla admin-moduler (goal-55 steg 1).
 *  Ersätter de tre motstridiga lokala statusTone-mapparna (Blogg/Kurs/Offert).
 *  OBS: cancelled = neutral (normerar Kurs-avvikelsen som sa warning) —
 *  avslutade/inställda lägen är neutrala, varning reserveras för väntande. */
export const STATUS_TONE: Record<string, BadgeTone> = {
  // Live/positivt
  published: 'success',
  open: 'success',
  active: 'success',
  confirmed: 'success',
  accepted: 'success',
  paid: 'success',
  // Väntande
  draft: 'warning',
  reviewing: 'warning',
  pending: 'warning',
  // Inkommet
  new: 'info',
  // Offererad
  quoted: 'gold',
  // Avslutat/inaktivt
  archived: 'neutral',
  closed: 'neutral',
  declined: 'neutral',
  done: 'neutral',
  cancelled: 'neutral',
}

export function statusTone(status: string): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral'
}
