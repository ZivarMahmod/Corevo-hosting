import type { IconName } from './ui/Icon'
import type { CommandItem } from './ui/CommandPalette'

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
      // "Data & drift" är borta; per-kund-data bor i kundkortet (/salonger/[id] →
      // flikar Data/Personal/Drift). De GLOBALA tvär-kund-verktygen (slutkund-sök
      // över alla, all-personal, alla loggar) hör hemma här under Insyn, inte som
      // egen konkurrerande grupp — de är insyn över hela plattformen.
      { group: 'Insyn' },
      { href: '/', label: 'Översikt', icon: 'grid' },
      { href: '/fakturering', label: 'Fakturering', icon: 'dollar' },
      { href: '/kunder', label: 'Slutkunder', icon: 'users' },
      { href: '/personal-plattform', label: 'Personal', icon: 'scissors' },
      { href: '/drift-och-logg', label: 'Loggar', icon: 'alert' },
      { group: 'Kunder' },
      { href: '/salonger', label: 'Kunder', icon: 'building' },
      { href: '/salonger/ny', label: 'Onboarda kund', icon: 'plus' },
      { href: '/branscher', label: 'Branscher', icon: 'layers' },
      { group: 'Plattform' },
      { href: '/integrationer', label: 'Integrationer', icon: 'layers' },
      { href: '/domaner', label: 'Domäner', icon: 'link' },
      { href: '/roller', label: 'Roller', icon: 'shield' },
      { href: '/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  admin: {
    sub: 'Salong-admin',
    items: [
      { group: 'Din dag' },
      { href: '/admin', label: 'Översikt', icon: 'home' },
      { href: '/admin/bokningar', label: 'Bokningar', icon: 'calendar' },
      { group: 'Hantera' },
      { href: '/admin/kunder', label: 'Kunder', icon: 'user' },
      { href: '/admin/tjanster', label: 'Tjänster', icon: 'scissors' },
      { href: '/admin/personal', label: 'Personal', icon: 'users' },
      { href: '/admin/platser', label: 'Platser', icon: 'building' },
      { href: '/admin/scheman', label: 'Scheman', icon: 'clock' },
      // Kundens språk, inte plattformens: "Moduler" är en intern term (Zivar).
      { group: 'Din verksamhet' },
      // 'booking' är default-live utan tenant_modules-rad — PortalShell lägger då
      // med 'booking' i activeModuleKeys (isBookingActivated) så posten syns.
      { href: '/admin/kurser', label: 'Kurser', icon: 'calendar', module: 'booking' },
      { href: '/admin/media', label: 'Bildbibliotek', icon: 'upload', module: 'media_library' },
      { href: '/admin/webshop', label: 'Webshop', icon: 'grid', module: 'shop' },
      { href: '/admin/blogg', label: 'Blogg', icon: 'edit', module: 'blogg' },
      { href: '/admin/offerter', label: 'Offerter', icon: 'mail', module: 'offert' },
      { href: '/admin/lojalitet', label: 'Lojalitet', icon: 'star', module: 'lojalitet' },
      { href: '/admin/presentkort', label: 'Presentkort', icon: 'gift', module: 'presentkort' },
      { group: 'Din sida' },
      // Bokningsflödet (bokningssätt/tid-väljare/bilder) bor som flik INNE i
      // Redigera sidan — en yta, en preview (Zivar 2026-07-10).
      { href: '/admin/sida', label: 'Redigera sidan', icon: 'palette' },
      { href: '/admin/installningar', label: 'Inställningar', icon: 'settings' },
    ],
  },
  personal: {
    sub: 'Personal',
    items: [
      { href: '/personal', label: 'Idag', icon: 'home' },
      { href: '/personal/arbetstider', label: 'Mitt schema', icon: 'calendar' },
      { href: '/personal/franvaro', label: 'Frånvaro', icon: 'coffee' },
    ],
  },
}

/** ⌘K-palettens "Gå till"-lista, härledd ur SAMMA NAV som sidomenyn. Samma
 *  modul-gating som PortalSidebar: `activeModuleKeys` undefined → ingen gating
 *  (platform/personal); [] → alla modul-poster döljs. */
export function paletteFromNav(role: PortalRole, activeModuleKeys?: string[]): CommandItem[] {
  return NAV[role].items
    .filter(
      (e): e is NavItem =>
        !isGroup(e) && (!e.module || !activeModuleKeys || activeModuleKeys.includes(e.module)),
    )
    .map(({ href, label, icon }) => ({ href, label, icon, kind: 'Gå till' }))
}
