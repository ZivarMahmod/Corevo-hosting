import { NAV, isGroup, isNavItemVisible } from './nav-items'
import { settingsCategories } from '@/lib/admin/settings-map'
import { ADMIN_AREA_MIN_LEVEL as A } from '@/lib/auth/admin-areas'
import type { TopnavArea } from './Topnav'

/** Kund-adminens toppnavigation — samma form som platform-navigation.ts, samma
 *  <Topnav>-komponent, samma CSS. Skillnaden är rollen: superadmin styr plattformen,
 *  kund-admin styr EN verksamhet (goal-65, låst beslut codex/00 §1).
 *
 *  De fasta huvudvalen är fyra + Inställningar. Aktiva moduler läggs in emellan som
 *  egna poster (Zivar 2026-07-14) — en verksamhet utan moduler ser exakt fem val,
 *  vilket ÄR Wavy-enkelheten. Modulnycklarna och deras hrefs/labels kommer ur
 *  nav-items.ts, som förblir enda sanningen för både sidomeny, ⌘K och detta nav. */

/** Inställningar v2 har ETT kategorinav inne i ytan. Toppnaven behöver fortfarande
 * känna igen de befintliga äganderouterna som Inställningar, men får inte rendera
 * samma karta en gång till som en horisontell flikrad. Query/hash tas bort eftersom
 * aktivmarkeringen arbetar med pathname. */
const SETTINGS_PREFIXES = [
  '/admin/installningar',
  ...new Set(settingsCategories().map((category) => category.href.split(/[?#]/, 1)[0]!)),
]

/** Modulposterna ur NAV.admin (de som har en `module`-nyckel). En modul som inte är
 *  AKTIVERAD döljs helt (ej köpt ≠ behörighet). En aktiverad modul som rollen inte
 *  når visas LÅST (Zivar 2026-07-18: "syns men låst" — frisören/platschefen ska se
 *  att ytan finns och att ägaren kan bevilja den). `activeModuleKeys` undefined ⇒
 *  ingen gating (samma kontrakt som PortalSidebar/paletteFromNav). */
function moduleAreas(
  activeModuleKeys?: string[],
  roleLevel?: number,
  grantedAreas?: readonly string[],
): TopnavArea[] {
  return NAV.admin.items.flatMap((entry) => {
    if (isGroup(entry) || !entry.module) return []
    if (activeModuleKeys && !activeModuleKeys.includes(entry.module)) return []
    const visible = isNavItemVisible(entry, { activeModuleKeys, roleLevel, grantedAreas })
    return [
      {
        id: `modul-${entry.module}`,
        href: entry.href,
        label: entry.label,
        prefixes: [entry.href],
        ...(visible ? {} : { locked: true }),
      },
    ]
  })
}

export function adminAreas(
  activeModuleKeys?: string[],
  roleLevel?: number,
  grantedAreas?: readonly string[],
  /** Ägargrinden (owner-guard): Inställningar kräver organisations-scope. false ⇒
   *  posten visas låst även om rollnivån räcker. undefined ⇒ okänd/ej relevant. */
  organizationScope?: boolean,
): TopnavArea[] {
  // Personliga tillägg (goal-71): en yta beviljad i tenant_member_permissions är
  // tillåten fast rollnivån inte når minLevel — samma beslut som sidgrinden.
  const allowed = (minimum: number, area?: string) =>
    roleLevel === undefined ||
    roleLevel >= minimum ||
    (area !== undefined && (grantedAreas?.includes(area) ?? false))
  const lockUnless = (ok: boolean) => (ok ? {} : { locked: true as const })
  return [
    // exact: /admin är prefix till varenda annan adminroute — utan detta hade
    // Översikt markerats som aktiv överallt.
    { id: 'oversikt', href: '/admin', label: 'Översikt', prefixes: ['/admin'], exact: true },
    // Bokningsytan ÄR kalendern (goal-66 byter innehållet på routen, inte routen).
    { id: 'kalender', href: '/admin/bokningar', label: 'Kalender', prefixes: ['/admin/bokningar'] },
    { id: 'kunder', href: '/admin/kunder', label: 'Kunder', prefixes: ['/admin/kunder'] },
    ...moduleAreas(activeModuleKeys, roleLevel, grantedAreas),
    {
      id: 'sida',
      href: '/admin/sida',
      label: 'Redigera sidan',
      prefixes: ['/admin/sida'],
      ...lockUnless(allowed(A.sida, 'sida')),
    },
    {
      id: 'installningar',
      href: '/admin/installningar',
      label: 'Inställningar',
      prefixes: SETTINGS_PREFIXES,
      ...lockUnless(allowed(A.installningar, 'installningar') && organizationScope !== false),
    },
  ]
}

export type AdminMobileNavigation = {
  /** De tre fasta destinationerna i mobilens nederkant. */
  tabs: TopnavArea[]
  /** Varje övrig, redan tillåten adminyta samlas under Mer — inget döljs. */
  more: TopnavArea[]
  /** Kalenderns befintliga skapaflöde, exponerat som den centrala FAB-knappen. */
  action: { href: string; label: string }
}

/** Mobilen arrangerar om samma adminnavigation som desktop. Funktionen tar den redan
 * modul- och rollfiltrerade listan, så den kan varken lägga till en otillåten yta eller
 * tappa en aktiverad modul. Låsta ytor hamnar aldrig i flikraden — de visas låsta i Mer. */
export function adminMobileNavigation(areas: readonly TopnavArea[]): AdminMobileNavigation {
  const tabIds = new Set(['oversikt', 'kalender', 'kunder'])
  return {
    tabs: areas.filter((area) => tabIds.has(area.id) && !area.locked),
    more: areas.filter((area) => !tabIds.has(area.id)),
    action: { href: '/admin/bokningar?ny', label: 'Ny bokning' },
  }
}
