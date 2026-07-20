import type { IconName } from './ui/Icon'
import type { CommandItem } from './ui/CommandPalette'
import { ADMIN_AREA_MIN_LEVEL as A, adminAreaForPath } from '@/lib/auth/admin-areas'

/** ENDA källan för back-office-navigationen. Både PortalSidebar (railen) och
 *  PortalShell (⌘K-paletten via paletteFromNav) konsumerar SAMMA lista — de kan
 *  inte drifta isär (goal-55 steg 1; tidigare handkopierades paletten i
 *  PortalShell och gled ifrån sidomenyn). */

export type PortalRole = 'admin' | 'platform' | 'personal'

export type NavItem = {
  href: string
  label: string
  icon: IconName
  /** tenant_modules-nyckel — posten visas BARA när kundens modul är aktiverad
   *  (Zivar: "de moduler som är aktiva är de som syns för kunden"). */
  module?: string
  /** Lägsta rollnivå som ser posten (roll-separationen; se lib/auth/admin-areas.ts).
   *  Utelämnad → alla i portalen ser den. OBS: att dölja en länk är INTE
   *  behörighetskontroll — serversidan (requireAdminArea) är sanningen. */
  minLevel?: number
  /** Självserviceyta som bara är meningsfull när kontot är kopplat till en aktiv
   *  staff-rad. Hindrar ägare utan egen personalprofil från att hamna i PERSONAL-
   *  skalets permanenta tomläge via sidomenyn eller kommandopaletten. */
  requiresStaffProfile?: boolean
}
/** A nav entry is either a group header (handoff Sidebar groups the rail by
 *  area: Insyn/Tenants… for super, Din dag/Hantera/Din sida for salon) or a
 *  link. We only group items whose routes actually exist — no 404 placeholders. */
export type NavEntry = { group: string } | NavItem
export type NavConfig = { sub: string; items: NavEntry[] }

export const isGroup = (e: NavEntry): e is { group: string } => 'group' in e

/** Role-driven nav sets + their active-path matching. The three back-office
 *  portals live at different roots (admin → /admin, platform → / on
 *  booking.corevo.se, personal → /personal), so each keeps its own match rule —
 *  these are NOT unified (matches the existing AdminNav/PlatformNav/PersonalNav).
 *  Grouping + order follow the v3 handoff (design_handoff_backoffice/Shell.jsx → NAV). */
export const NAV: Record<PortalRole, NavConfig> = {
  platform: {
    sub: 'Plattform',
    // Groups/labels/order/icons are the rendered handoff (Shell.jsx → NAV.super):
    //   Insyn · Tenants · Data & drift · Plattform. ASCII routes only (the å in
    //   "Inställningar" → /installningar, matching /admin/installningar — non-ASCII
    //   in build paths is documented-fragile here). All icons are in IconName.
    items: [
      // Insyn = plattform-övergripande. IA-vision punkt 3: den gamla egna gruppen
      // "Data & drift" är borta; per-kund-data bor i kundkortet (/kunder/[id] →
      // flikar Data/Personal/Drift). De GLOBALA tvär-kund-verktygen (slutkund-sök
      // över alla, all-personal, alla loggar) hör hemma här under Insyn, inte som
      // egen konkurrerande grupp — de är insyn över hela plattformen.
      { group: 'Insyn' },
      { href: '/', label: 'Översikt', icon: 'grid' },
      { href: '/fakturering', label: 'Fakturering', icon: 'dollar' },
      { href: '/slutkunder', label: 'Slutkunder', icon: 'users' },
      { href: '/personal-plattform', label: 'Personal', icon: 'scissors' },
      { href: '/utskick', label: 'Utskick', icon: 'message' },
      { href: '/drift-och-logg', label: 'Loggar', icon: 'alert' },
      { group: 'Kunder' },
      { href: '/kunder', label: 'Kunder', icon: 'building' },
      { href: '/kunder/ny', label: 'Onboarda kund', icon: 'plus' },
      { href: '/branscher', label: 'Branscher', icon: 'layers' },
      { group: 'Plattform' },
      { href: '/partners', label: 'Partners', icon: 'building' },
      { href: '/integrationer', label: 'Integrationer', icon: 'layers' },
      { href: '/domaner', label: 'Domäner', icon: 'link' },
      { href: '/roller', label: 'Roller', icon: 'shield' },
      { href: '/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  admin: {
    sub: 'Adminpanel',
    // minLevel = ADMIN_AREA_MIN_LEVEL (lib/auth/admin-areas.ts) — SAMMA tabell som
    // sidorna och de muterande actions gatar på. Personal (3) ser sin arbetsdag;
    // systemytorna kräver ägare/administratör (6).
    items: [
      { group: 'Din dag' },
      { href: '/admin', label: 'Översikt', icon: 'home', minLevel: A.oversikt },
      { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar', minLevel: A.bokningar },
      // Personalens egna ytor (schema/frånvaro) bor i (personal)-portalen men nås
      // från SAMMA meny — hela arbetsdagen bakom en inloggning.
      {
        href: '/personal/arbetstider',
        label: 'Mitt schema',
        icon: 'clock',
        requiresStaffProfile: true,
      },
      {
        href: '/personal/franvaro',
        label: 'Frånvaro',
        icon: 'coffee',
        requiresStaffProfile: true,
      },
      // goal-67: statistiken hör till "Din dag" — det är frågan man ställer när dagen
      // är slut, inte en systeminställning. Ägaren/administratören ser den; personalen
      // gör det inte (A.statistik = 6).
      { href: '/admin/statistik', label: 'Statistik', icon: 'trendUp', minLevel: A.statistik },
      { group: 'Hantera' },
      { href: '/admin/kunder', label: 'Kunder', icon: 'user', minLevel: A.kunder },
      // Kontaktformuläret finns på VARJE mall (ingen modul, kan aldrig stängas av) —
      // inkorgen är därför en fast Hantera-post, inte en modulpost (plan 007).
      { href: '/admin/kontakt', label: 'Meddelanden', icon: 'mail', minLevel: A.kontakt },
      { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors', minLevel: A.tjanster },
      { href: '/admin/personal', label: 'Personal', icon: 'users', minLevel: A.personal },
      { href: '/admin/platser', label: 'Platser', icon: 'building', minLevel: A.platser },
      { href: '/admin/scheman', label: 'Scheman', icon: 'clock', minLevel: A.scheman },
      // Kundens språk, inte plattformens: "Moduler" är en intern term (Zivar).
      { group: 'Din verksamhet' },
      // Kurser = egen opt-in-modul sedan 0056 (rad krävs, isModuleActivated).
      { href: '/admin/kurser', label: 'Kurser', icon: 'calendar', module: 'kurser', minLevel: A.kurser },
      { href: '/admin/media', label: 'Bildbibliotek', icon: 'upload', module: 'media_library', minLevel: A.media },
      { href: '/admin/webshop', label: 'Webshop', icon: 'grid', module: 'shop', minLevel: A.webshop },
      { href: '/admin/blogg', label: 'Blogg', icon: 'edit', module: 'blogg', minLevel: A.blogg },
      { href: '/admin/offerter', label: 'Offerter', icon: 'mail', module: 'offert', minLevel: A.offerter },
      { href: '/admin/lojalitet', label: 'Lojalitet', icon: 'star', module: 'lojalitet', minLevel: A.lojalitet },
      { href: '/admin/presentkort', label: 'Presentkort', icon: 'gift', module: 'presentkort', minLevel: A.presentkort },
      { group: 'Din sida' },
      // Bokningsflödet (bokningssätt/tid-väljare/bilder) bor som flik INNE i
      // Redigera sidan — en yta, en preview (Zivar 2026-07-10).
      { href: '/admin/sida', label: 'Redigera sidan', icon: 'palette', minLevel: A.sida },
      { href: '/admin/installningar', label: 'Inställningar', icon: 'settings', minLevel: A.installningar },
    ],
  },
  personal: {
    sub: 'Personal',
    // EXAKT två destinationer (Zivar): Kalender + Min profil — samma bottenflik-
    // mönster som kund-adminen. Arbetstider/Frånvaro finns kvar som rutter men nås
    // från profilsidan, inte ur naven.
    items: [
      { href: '/personal', label: 'Kalender', icon: 'calendar' },
      { href: '/personal/profil', label: 'Min profil', icon: 'user' },
    ],
  },
}

/** Syns posten? Modul-gating (aktiverad modul) OCH roll-gating (minLevel).
 *  `roleLevel` undefined → ingen roll-gating (bakåtkompatibelt).
 *  `grantedAreas` = personliga tillägg ur tenant_member_permissions (goal-71):
 *  en yta som beviljats DÄR ska ha en synlig väg fast rollnivån inte räcker —
 *  samma beslut som sidgrinden (hasAdminAreaPermission), aldrig en egen regel. */
export function isNavItemVisible(
  item: NavItem,
  opts: {
    activeModuleKeys?: string[]
    roleLevel?: number
    grantedAreas?: readonly string[]
    hasStaffProfile?: boolean
  },
): boolean {
  if (item.requiresStaffProfile && opts.hasStaffProfile === false) return false
  if (item.module && opts.activeModuleKeys && !opts.activeModuleKeys.includes(item.module)) return false
  if (item.minLevel !== undefined && opts.roleLevel !== undefined && opts.roleLevel < item.minLevel) {
    const area = adminAreaForPath(item.href)
    return area !== null && (opts.grantedAreas?.includes(area) ?? false)
  }
  return true
}

/** ⌘K-palettens "Gå till"-lista, härledd ur SAMMA NAV som sidomenyn. Samma
 *  modul- och roll-gating som PortalSidebar: `activeModuleKeys` undefined → ingen
 *  modul-gating (platform/personal); [] → alla modul-poster döljs. */
export function paletteFromNav(
  role: PortalRole,
  activeModuleKeys?: string[],
  roleLevel?: number,
  grantedAreas?: readonly string[],
  hasStaffProfile?: boolean,
): CommandItem[] {
  return NAV[role].items
    .filter(
      (e): e is NavItem =>
        !isGroup(e) &&
        isNavItemVisible(e, { activeModuleKeys, roleLevel, grantedAreas, hasStaffProfile }),
    )
    .map(({ href, label, icon }) => ({ href, label, icon, kind: 'Gå till' }))
}
