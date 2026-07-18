import type { AdminArea } from '@/lib/auth/admin-areas'
import type {
  SettingsNavigationCategory,
  SettingsNavigationSearchEntry,
} from '@/lib/settings-navigation'
import { resolveTerm, termPlural, type Terminology } from '@/lib/platform/verticals-shared'

export type SettingsGroup = 'VERKSAMHET' | 'BOKNING' | 'PENGAR' | 'KOMMUNIKATION' | 'KONTO'

export type SettingsCategoryId =
  | 'tjanster'
  | 'personal'
  | 'scheman'
  | 'platser'
  | 'bokningsregler'
  | 'bokningsflode'
  | 'betalning'
  | 'paminnelser'
  | 'integrationer'
  | 'roller'
  | 'konto'
  | 'sekretess'

export type SettingsCategory = SettingsNavigationCategory & {
  id: SettingsCategoryId
  group: SettingsGroup
  area: AdminArea
  warning?: 'warning' | 'danger'
}

export type SettingsSearchEntry = SettingsNavigationSearchEntry & {
  categoryId: SettingsCategoryId
  category: SettingsCategory
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  'VERKSAMHET',
  'BOKNING',
  'PENGAR',
  'KOMMUNIKATION',
  'KONTO',
]

/**
 * Inställningar är en karta, inte en andra skrivyta. Varje kategori pekar till den
 * befintliga route som äger datan. Samma lista matar nav, sök och Ctrl-K.
 */
export function settingsCategories(terminology?: Terminology | null): SettingsCategory[] {
  const staff = termPlural(terminology, 'staff', resolveTerm(terminology, 'staff', 'Personal'))
  const services = termPlural(terminology, 'service', 'Tjänster')

  return [
    {
      id: 'tjanster', group: 'VERKSAMHET', href: '/admin/tjanster', label: `${services} & priser`,
      hint: 'Utbud, längder och priser', icon: 'scissors', area: 'tjanster',
      keywords: 'pris tjänst utbud längd ordning populär',
    },
    {
      id: 'personal', group: 'VERKSAMHET', href: '/admin/personal', label: staff,
      hint: 'Medarbetare, foton och synlighet', icon: 'users', area: 'personal',
      keywords: 'personal medarbetare anställd konto foto visa ta bort',
    },
    {
      id: 'scheman', group: 'VERKSAMHET', href: '/admin/scheman', label: 'Scheman & frånvaro',
      hint: 'Arbetstider, semester och schemalås', icon: 'clock', area: 'scheman',
      keywords: 'öppettider arbetstid schema semester frånvaro ledig sjuk pass',
    },
    {
      id: 'platser', group: 'VERKSAMHET', href: '/admin/platser', label: 'Platser',
      hint: 'Adresser och tidszon', icon: 'mapPin', area: 'platser',
      keywords: 'plats adress tidszon filial lokal',
    },
    {
      id: 'bokningsregler', group: 'BOKNING', href: '/admin/installningar/bokning', label: 'Bokningsregler',
      hint: 'På, pausad, av och avbokning', icon: 'calendar', area: 'installningar',
      keywords: 'onlinebokning pausa av boka bokningsfönster avbokningsgräns nya kunder',
    },
    {
      id: 'bokningsflode', group: 'BOKNING', href: '/admin/installningar/bokningsflode', label: 'Bokningsflöde',
      hint: 'Kalender, tidsväljare och utseende', icon: 'arrowRight', area: 'sida',
      keywords: 'bokningssätt kalender avatar färg tidsväljare utseende',
    },
    {
      id: 'betalning', group: 'PENGAR', href: '/admin/installningar/betalning', label: 'Betalning',
      hint: 'Stripe, betala vid bokning och utbetalning', icon: 'creditCard', area: 'installningar',
      keywords: 'stripe betalning kort swish utbetalning pengar',
    },
    {
      id: 'paminnelser', group: 'KOMMUNIKATION', href: '/admin/installningar/paminnelser', label: 'Påminnelser & utskick',
      hint: 'Bekräftelser, påminnelser och kanaler', icon: 'mail', area: 'installningar',
      keywords: 'påminnelse sms mejl e-post utskick notis bekräftelse',
    },
    {
      id: 'integrationer', group: 'KOMMUNIKATION', href: '/admin/installningar/integrationer', label: 'Integrationer',
      hint: 'Externa kopplingar och recensioner', icon: 'link', area: 'sida',
      keywords: 'google recension betyg stjärnor integration koppla',
    },
    {
      id: 'roller', group: 'KONTO', href: '/admin/installningar?kategori=roller', label: 'Roller & behörigheter',
      hint: 'Vem får göra vad — allt loggas', icon: 'shield', area: 'installningar',
      keywords: 'roll behörighet rättighet ägare platschef anställd logg aktivitet vem',
    },
    {
      id: 'konto', group: 'KONTO', href: '/admin/installningar/konto', label: 'Konto & säkerhet',
      hint: 'Lösenord och aktiva enheter', icon: 'user', area: 'installningar',
      keywords: 'lösenord byta säkerhet logga ut enhet session e-post',
    },
    {
      id: 'sekretess', group: 'KONTO', href: '/admin/installningar/sekretess', label: 'Sekretess & GDPR',
      hint: 'Kunddata, export och anonymisering', icon: 'lock', area: 'kunder',
      keywords: 'gdpr sekretess export radera anonymisera kunddata biträdesavtal',
    },
  ]
}

const SETTINGS_SEARCH_DEFS: ReadonlyArray<{
  id: string
  label: string
  hint: string
  categoryId: SettingsCategoryId
  keywords: string
  href?: string
}> = [
  { id: 'site-hours', label: 'Öppettider på sidan', hint: 'Redigera sidan → Kontakt', categoryId: 'bokningsregler', href: '/admin/sida?flik=kontakt', keywords: 'öppettider öppet tider kontakt hemsida' },
  { id: 'bookable-hours', label: 'Bokningsbara tider', hint: 'Scheman & frånvaro — personalens arbetstider', categoryId: 'scheman', keywords: 'öppettider tider arbetstid schema bokningsbar' },
  { id: 'service-price', label: 'Pris på en tjänst', hint: 'Tjänster & priser', categoryId: 'tjanster', keywords: 'pris tjänst utbud längd ändra pris' },
  { id: 'add-staff', label: 'Lägg till medarbetare', hint: 'Personal', categoryId: 'personal', keywords: 'personal medarbetare anställd konto lägg till' },
  { id: 'time-off', label: 'Semester / frånvaro', hint: 'Scheman & frånvaro', categoryId: 'scheman', keywords: 'semester frånvaro ledig sjuk' },
  { id: 'pause-booking', label: 'Pausa onlinebokningen', hint: 'Bokningsregler', categoryId: 'bokningsregler', keywords: 'pausa stäng bokning på av' },
  { id: 'cancellation', label: 'Avbokningsregler', hint: 'Bokningsregler', categoryId: 'bokningsregler', keywords: 'avboka avbokning regler timmar' },
  { id: 'booking-appearance', label: 'Bokningens utseende', hint: 'Bokningsflöde', categoryId: 'bokningsflode', keywords: 'utseende kalender avatar färg bokningsflöde presentation datumväljare' },
  { id: 'stripe', label: 'Koppla Stripe / kortbetalning', hint: 'Betalning', categoryId: 'betalning', keywords: 'stripe betalning kort swish utbetalning pengar' },
  { id: 'reminders', label: 'Påminnelser till kunder', hint: 'Påminnelser & utskick', categoryId: 'paminnelser', keywords: 'påminnelse sms mejl e-post utskick notis bekräftelse' },
  { id: 'reviews', label: 'Google-recensioner', hint: 'Integrationer', categoryId: 'integrationer', keywords: 'google recension betyg stjärnor integration koppla' },
  { id: 'password', label: 'Byt lösenord', hint: 'Konto & säkerhet', categoryId: 'konto', keywords: 'lösenord byta säkerhet konto' },
  { id: 'sessions', label: 'Logga ut en enhet', hint: 'Konto & säkerhet', categoryId: 'konto', keywords: 'logga ut enhet session säkerhet' },
  { id: 'customer-data', label: 'Exportera / radera kunddata', hint: 'Sekretess & GDPR', categoryId: 'sekretess', keywords: 'gdpr export radera kunddata sekretess anonymisera' },
  { id: 'site-copy', label: 'Färger & texter på sidan', hint: 'Redigera sidan', categoryId: 'bokningsflode', href: '/admin/sida', keywords: 'färg text bild hemsida logga redigera sidan' },
  { id: 'location', label: 'Ny plats / adress', hint: 'Platser', categoryId: 'platser', keywords: 'plats adress lokal filial tidszon ny' },
  { id: 'permissions', label: 'Ge en anställd behörighet', hint: 'Roller & behörigheter', categoryId: 'roller', keywords: 'roll behörighet rättighet ägare platschef anställd' },
  { id: 'activity-log', label: 'Vem gjorde vad? (logg)', hint: 'Roller & behörigheter', categoryId: 'roller', keywords: 'logg spåra aktivitet historik vem' },
]

/** Samma sökindex driver både inställningsnavet och den globala Ctrl-K-paletten. */
export function settingsSearchEntries(categories: SettingsCategory[]): SettingsSearchEntry[]
export function settingsSearchEntries(
  categories: SettingsNavigationCategory[],
): SettingsNavigationSearchEntry[]
export function settingsSearchEntries(
  categories: SettingsNavigationCategory[],
): SettingsNavigationSearchEntry[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return SETTINGS_SEARCH_DEFS.flatMap((entry) => {
    const category = byId.get(entry.categoryId)
    if (!category) return []
    return [{
      ...entry,
      href: entry.href ?? category.href,
      keywords: `${entry.keywords} ${category.label} ${category.hint} ${category.keywords}`,
      category,
    }]
  })
}
