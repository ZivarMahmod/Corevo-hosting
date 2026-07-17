import type { IconName } from '@/components/portal/ui/Icon'
import type { AdminArea } from '@/lib/auth/admin-areas'
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

export type SettingsCategory = {
  id: SettingsCategoryId
  group: SettingsGroup
  href: string
  label: string
  hint: string
  icon: IconName
  area: AdminArea
  keywords: string
  warning?: 'warning' | 'danger'
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
      id: 'bokningsflode', group: 'BOKNING', href: '/admin/sida?flik=bokning', label: 'Bokningsflöde',
      hint: 'Kalender, tidsväljare och utseende', icon: 'arrowRight', area: 'sida',
      keywords: 'bokningssätt kalender avatar färg tidsväljare utseende',
    },
    {
      id: 'betalning', group: 'PENGAR', href: '/admin/installningar/betalning', label: 'Betalning',
      hint: 'Stripe, betala vid bokning och utbetalning', icon: 'creditCard', area: 'installningar',
      keywords: 'stripe betalning kort swish utbetalning pengar',
    },
    {
      id: 'paminnelser', group: 'KOMMUNIKATION', href: '/admin/installningar/foretag#paminnelser', label: 'Påminnelser & utskick',
      hint: 'Bekräftelser, påminnelser och kanaler', icon: 'mail', area: 'installningar',
      keywords: 'påminnelse sms mejl e-post utskick notis bekräftelse',
    },
    {
      id: 'integrationer', group: 'KOMMUNIKATION', href: '/admin/sida?flik=kontakt', label: 'Integrationer',
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
      id: 'sekretess', group: 'KONTO', href: '/admin/kunder', label: 'Sekretess & GDPR',
      hint: 'Kunddata, export och anonymisering', icon: 'lock', area: 'kunder',
      keywords: 'gdpr sekretess export radera anonymisera kunddata biträdesavtal',
    },
  ]
}
