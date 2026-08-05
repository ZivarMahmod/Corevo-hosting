import { NAV, isGroup, isNavItemVisible } from './nav-items'
import { settingsCategories } from '@/lib/admin/settings-map'
import { ADMIN_AREA_MIN_LEVEL as A } from '@/lib/auth/admin-areas'
import type { AdminArea } from '@/lib/auth/admin-areas'
import type { TopnavArea, TopnavQuickAction } from './Topnav'

/** Kund-adminens toppnavigation — samma form som platform-navigation.ts, samma
 *  <Topnav>-komponent, samma CSS. Skillnaden är rollen: superadmin styr plattformen,
 *  kund-admin styr EN verksamhet (goal-65, låst beslut codex/00 §1).
 *
 *  De fasta huvudvalen är fem + Inställningar. Aktiva moduler läggs in emellan som
 *  egna poster (Zivar 2026-07-14) — en verksamhet utan moduler ser exakt sex val,
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
 *  ingen gating, samma kontrakt som paletteFromNav. */
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

/** One navigation/action truth matching requireAdminArea: role floor OR explicit grant. */
export function canUseAdminArea(
  area: AdminArea,
  roleLevel: number | undefined,
  grantedAreas?: readonly string[],
): boolean {
  return (
    roleLevel === undefined ||
    roleLevel >= A[area] ||
    (grantedAreas?.includes(area) ?? false)
  )
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
  const lockUnless = (ok: boolean) => (ok ? {} : { locked: true as const })
  return [
    // exact: /admin är prefix till varenda annan adminroute — utan detta hade
    // Översikt markerats som aktiv överallt.
    { id: 'oversikt', href: '/admin', label: 'Översikt', prefixes: ['/admin'], exact: true },
    // Bokningsytan ÄR kalendern (goal-66 byter innehållet på routen, inte routen).
    { id: 'kalender', href: '/admin/bokningar', label: 'Kalender', prefixes: ['/admin/bokningar'] },
    { id: 'kunder', href: '/admin/kunder', label: 'Kunder', prefixes: ['/admin/kunder'] },
    {
      id: 'kontakt',
      href: '/admin/kontakt',
      label: 'Meddelanden',
      prefixes: ['/admin/kontakt'],
      ...lockUnless(canUseAdminArea('kontakt', roleLevel, grantedAreas)),
    },
    ...moduleAreas(activeModuleKeys, roleLevel, grantedAreas),
    {
      id: 'sida',
      href: '/admin/sida',
      label: 'Redigera sidan',
      prefixes: ['/admin/sida'],
      ...lockUnless(canUseAdminArea('sida', roleLevel, grantedAreas)),
    },
    {
      id: 'installningar',
      href: '/admin/installningar',
      label: 'Inställningar',
      prefixes: SETTINGS_PREFIXES,
      ...lockUnless(
        canUseAdminArea('installningar', roleLevel, grantedAreas) && organizationScope !== false,
      ),
    },
  ]
}

export type AdminMobileNavigation = {
  /** De tre fasta destinationerna i mobilens nederkant. */
  tabs: TopnavArea[]
  /** Varje övrig, redan tillåten adminyta samlas under Mer — inget döljs. */
  more: TopnavArea[]
  /** Kalenderns befintliga skapaflöde, exponerat som den centrala FAB-knappen. */
  action?: { href: string; label: string }
}

/** Mobilen arrangerar om samma adminnavigation som desktop. Funktionen tar den redan
 * modul- och rollfiltrerade listan, så den kan varken lägga till en otillåten yta eller
 * tappa en aktiverad modul. Låsta ytor hamnar aldrig i flikraden — de visas låsta i Mer. */
export function adminMobileNavigation(
  areas: readonly TopnavArea[],
  canManageBookings = true,
): AdminMobileNavigation {
  const tabIds = new Set(['oversikt', 'kalender', 'kunder'])
  return {
    tabs: areas.filter((area) => tabIds.has(area.id) && !area.locked),
    more: areas.filter((area) => !tabIds.has(area.id)),
    ...(canManageBookings
      ? { action: { href: '/admin/bokningar?ny', label: 'Ny bokning' } }
      : {}),
  }
}

/** Toppbannerns genvägar är handlingar, inte reklam för låsta ytor. Kunder är
 * personalens frysta basåtkomst; boknings- och Statistikgenvägar följer exakt
 * samma roll/grant-sanning som respektive sidgrind. */
export function adminQuickActions(input: {
  roleLevel: number
  grantedAreas?: readonly string[]
  canManageBookings: boolean
  tenantActive?: boolean
}): TopnavQuickAction[] {
  const canMutateBookings =
    input.tenantActive !== false && input.canManageBookings
  const canViewStatistics = canUseAdminArea('statistik', input.roleLevel, input.grantedAreas)
  return [
    ...(canMutateBookings
      ? ([
          { href: '/admin/bokningar?ny=1', label: 'Ny bokning', icon: 'plus' },
          { href: '/admin/bokningar?blockera=1', label: 'Blockera tid', icon: 'block' },
        ] satisfies TopnavQuickAction[])
      : []),
    { href: '/admin/kunder', label: 'Kunder', icon: 'users' },
    ...(canViewStatistics
      ? ([{ href: '/admin/statistik', label: 'Statistik', icon: 'chartBars' }] satisfies TopnavQuickAction[])
      : []),
  ]
}
