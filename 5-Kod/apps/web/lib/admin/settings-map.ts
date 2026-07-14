import type { IconName } from '@/components/portal/ui/Icon'
import type { AdminArea } from '@/lib/auth/admin-areas'
import { resolveTerm, termPlural, type Terminology } from '@/lib/platform/verticals-shared'

/** L3 C-01 — Inställningar är en KARTA över de ytor som redan finns, inte en ny
 *  yta. Varje kategori pekar på en RIKTIG route. Ingen sida flyttas, inget byggs om.
 *
 *  Regeln från nav-items.ts gäller här också: inga 404-platshållare. Kategorier vi
 *  STRÖK för att sidan inte finns:
 *   · "Moduler" — vilka moduler som är på ägs av plattformen (tenant_modules-vakten
 *     i migration 0026 gör off→på super-admin-only). Kunden har ingen modul-yta.
 *   · "Drift" — finns bara i super-adminens kundkort (/salonger/[id]), aldrig här.
 *   · "Notiser" — bor som reglage INNE i Företag och profil (SettingsForm), inte
 *     som egen sida. En kategori utan sida bakom är precis den utfyllnad Zivar
 *     förbjuder. */

export type SettingsCategoryId =
  | 'foretag'
  | 'bokning'
  | 'tjanster'
  | 'personal'
  | 'scheman'
  | 'platser'
  | 'sida'
  | 'betalning'
  | 'konto'

export type SettingsCategory = {
  id: SettingsCategoryId
  href: string
  label: string
  /** En rad. Kortet ska gå att förstå UTAN brödtext. */
  hint: string
  icon: IconName
  /** Ytan som routen gatas på (lib/auth/admin-areas.ts) — alla nio kräver nivå 6. */
  area: AdminArea
}

/**
 * De nio kategorierna. Etiketterna för personal/tjänster går genom branschlagret
 * (resolveTerm/termPlural) — en restaurang ser sina ord, aldrig frisörns.
 */
export function settingsCategories(terminology?: Terminology | null): SettingsCategory[] {
  const staff = termPlural(terminology, 'staff', resolveTerm(terminology, 'staff', 'Personal'))
  const service = termPlural(terminology, 'service', 'Tjänster')
  return [
    {
      id: 'foretag',
      href: '/admin/installningar/foretag',
      label: 'Företag och profil',
      hint: 'Namn, kontakt, tidszon, adress och domän',
      icon: 'building',
      area: 'installningar',
    },
    {
      id: 'bokning',
      href: '/admin/installningar/bokning',
      label: 'Bokningsregler',
      hint: 'På, pausad eller av — och avbokningsregeln',
      icon: 'calendar',
      area: 'installningar',
    },
    {
      id: 'tjanster',
      href: '/admin/tjanster',
      label: service,
      hint: 'Vad kunderna kan boka, pris och längd',
      icon: 'scissors',
      area: 'tjanster',
    },
    {
      id: 'personal',
      href: '/admin/personal',
      label: staff,
      hint: 'Vilka som tar emot bokningar',
      icon: 'users',
      area: 'personal',
    },
    {
      id: 'scheman',
      href: '/admin/scheman',
      label: 'Öppettider och schema',
      hint: 'Arbetstider och frånvaro',
      icon: 'clock',
      area: 'scheman',
    },
    {
      id: 'platser',
      href: '/admin/platser',
      label: 'Platser',
      hint: 'Adresser kunderna kan besöka',
      icon: 'mapPin',
      area: 'platser',
    },
    {
      id: 'sida',
      href: '/admin/sida',
      label: 'Din sida',
      hint: 'Färger, texter och bilder på hemsidan',
      icon: 'palette',
      area: 'sida',
    },
    {
      id: 'betalning',
      href: '/admin/installningar/betalning',
      label: 'Betalning',
      hint: 'Stripe-konto och betalning vid bokning',
      icon: 'creditCard',
      area: 'installningar',
    },
    {
      id: 'konto',
      href: '/admin/installningar/konto',
      label: 'Konto och säkerhet',
      hint: 'Lösenord och utloggning av andra enheter',
      icon: 'shield',
      area: 'installningar',
    },
  ]
}
