import { NAV, isGroup } from './nav-items'
import type { TopnavArea, TopnavItem } from './Topnav'

/** Kund-adminens toppnavigation — samma form som platform-navigation.ts, samma
 *  <Topnav>-komponent, samma CSS. Skillnaden är rollen: superadmin styr plattformen,
 *  kund-admin styr EN verksamhet (goal-65, låst beslut codex/00 §1).
 *
 *  De fasta huvudvalen är fyra + Inställningar. Aktiva moduler läggs in emellan som
 *  egna poster (Zivar 2026-07-14) — en verksamhet utan moduler ser exakt fem val,
 *  vilket ÄR Wavy-enkelheten. Modulnycklarna och deras hrefs/labels kommer ur
 *  nav-items.ts, som förblir enda sanningen för både sidomeny, ⌘K och detta nav. */

/** Inställningarnas undernavigation. De nio kategorierna i codex/00 §5 är målbilden,
 *  men bara routes som FINNS får ligga här — nav-items.ts-regeln: inga 404-platshållare.
 *  Tjänster/Personal/Scheman/Platser var egna sidomenyposter; de blir undersidor till
 *  Inställningar utan att koden i sidorna ändras. Resterande kategorier (bokningsregler,
 *  notiser, konto/säkerhet, data/export) får egna routes i L3 och läggs till här då. */
const SETTINGS_SUBNAV: readonly TopnavItem[] = [
  { href: '/admin/installningar', label: 'Företag och profil' },
  { href: '/admin/personal', label: 'Personal' },
  { href: '/admin/tjanster', label: 'Tjänster' },
  { href: '/admin/scheman', label: 'Öppettider och schema' },
  { href: '/admin/platser', label: 'Platser' },
] as const

const SETTINGS_PREFIXES = SETTINGS_SUBNAV.map((item) => item.href)

/** Modulposterna ur NAV.admin (de som har en `module`-nyckel), filtrerade på kundens
 *  aktiverade moduler. `activeModuleKeys` undefined ⇒ ingen gating (samma kontrakt som
 *  PortalSidebar/paletteFromNav); [] ⇒ inga modulposter alls. */
function moduleAreas(activeModuleKeys?: string[]): TopnavArea[] {
  return NAV.admin.items.flatMap((entry) => {
    if (isGroup(entry) || !entry.module) return []
    if (activeModuleKeys && !activeModuleKeys.includes(entry.module)) return []
    return [
      {
        id: `modul-${entry.module}`,
        href: entry.href,
        label: entry.label,
        prefixes: [entry.href],
      },
    ]
  })
}

export function adminAreas(activeModuleKeys?: string[]): TopnavArea[] {
  return [
    // exact: /admin är prefix till varenda annan adminroute — utan detta hade
    // Översikt markerats som aktiv överallt.
    { id: 'oversikt', href: '/admin', label: 'Översikt', prefixes: ['/admin'], exact: true },
    // Bokningsytan ÄR kalendern (goal-66 byter innehållet på routen, inte routen).
    { id: 'kalender', href: '/admin/bokningar', label: 'Kalender', prefixes: ['/admin/bokningar'] },
    { id: 'kunder', href: '/admin/kunder', label: 'Kunder', prefixes: ['/admin/kunder'] },
    ...moduleAreas(activeModuleKeys),
    { id: 'sida', href: '/admin/sida', label: 'Redigera sidan', prefixes: ['/admin/sida'] },
    {
      id: 'installningar',
      href: '/admin/installningar',
      label: 'Inställningar',
      prefixes: SETTINGS_PREFIXES,
      subnav: SETTINGS_SUBNAV,
    },
  ]
}
