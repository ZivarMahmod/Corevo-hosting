// Plain (NON-'use client') module-key lists. SERVER components (the look preview
// route) MUST import these from here, not from preview-modules.tsx ('use client'):
// a plain value imported across the RSC boundary becomes a client-reference proxy on
// the server (symptom: `ALL_PREVIEW_MODULES.includes is not a function` → 500).
// preview-modules.tsx re-exports these so existing client importers are unaffected.

// The 5 BUILT main sections — the real *Section set (app/(public)/page.tsx), in the
// real composition order. booking is covered by the look/layout, never a section.
export const BUILT_MAIN = ['shop', 'offert', 'blogg', 'lojalitet', 'presentkort'] as const
// Roadmap modules that live in the public main flow → the honest dashed card.
export const ROADMAP_MAIN = ['portfolio', 'meny', 'recurring', 'deposit', 'inlamning'] as const
// defaultPos:"konto" modules → the separate inloggad-kundportal panel.
export const KONTO_KEYS = ['husdjur', 'fordon', 'intag', 'orderstatus'] as const

/** Every module key the preview can render (5 built mains + roadmap + konto), EXCLUDING
 *  booking (woven into the look/layout itself, never a separate section). */
export const ALL_PREVIEW_MODULES: string[] = [...BUILT_MAIN, ...ROADMAP_MAIN, ...KONTO_KEYS]
