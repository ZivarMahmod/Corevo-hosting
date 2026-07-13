// Kontaktformuläret — SHARED types + pure helpers (goal-64).
//
// PURE, NO I/O, NO 'server-only'. Client-safe twin av lib/storefront/offert/types.ts:
// den importeras av BÅDE server-actionen (intake.ts) OCH klientön (ContactForm.tsx).
// Den får därför ALDRIG importera en 'server-only'-modul — det kraschar `next build`
// i samma sekund en klientkomponent hämtar en typ härifrån (samma 18h-fälla som
// offert-formuläret bär en varning om).
//
// VARFÖR ingen modul-gate: /kontakt är ingen modul. Sidan finns ALLTID i varje mall
// (alla 12 .dc.html ritar formuläret), och kan alltså inte stängas av som shop/offert.
// Därför finns det heller ingen `state !== 'live'`-spärr i intaken.

/** Fälten en mall kan be om. `contact_messages` (0057) bär exakt dessa kolumner. */
export const CONTACT_FIELDS = ['name', 'email', 'phone', 'subject', 'message'] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]

/**
 * Honeypot-fältet. Namnet ska se lockande ut för en bot men betyda ingenting för oss —
 * en riktig besökare ser det aldrig (dolt i CSS + aria-hidden + tabIndex -1). Ifyllt
 * → vi låtsas att allt gick bra men skriver ingenting. Tyst avvisning, aldrig ett
 * felmeddelande: ett fel talar om för boten vad den ska undvika nästa gång.
 */
export const CONTACT_HONEYPOT = 'company_website'

/** Discriminated state för useActionState. PURE — klientön importerar den. */
export type ContactSubmitState =
  | { phase: 'idle' }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

export const CONTACT_SUBMIT_INITIAL: ContactSubmitState = { phase: 'idle' }

/** Maxlängder — speglar valideringen i intake.ts så klienten kan sätta maxLength. */
export const CONTACT_MAX = {
  name: 120,
  email: 160,
  phone: 40,
  subject: 200,
  message: 4000,
} as const satisfies Record<ContactField, number>
