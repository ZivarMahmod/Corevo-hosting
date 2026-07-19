import { NAV, isGroup } from './nav-items'
import type { TopnavArea, TopnavMobileNavigation } from './Topnav'

/** Personal-portalens toppnavigation — samma form och samma <Topnav>-komponent som
 *  kund-adminen (admin-navigation.ts), bara med personalens två destinationer. Källan
 *  är NAV.personal (nav-items.ts), enda sanningen för både ⌘K-paletten och detta nav. */

const areaId = (href: string): string => (href === '/personal' ? 'kalender' : 'profil')

export function personalAreas(): TopnavArea[] {
  return NAV.personal.items.flatMap((entry) => {
    if (isGroup(entry)) return []
    return [
      {
        id: areaId(entry.href),
        href: entry.href,
        label: entry.label,
        prefixes: [entry.href],
        // /personal är prefix till /personal/profil — utan exact hade Kalender
        // markerats som aktiv även på profilsidan (samma mönster som admins Översikt).
        ...(entry.href === '/personal' ? { exact: true } : {}),
      },
    ]
  })
}

/** Mobilen arrangerar om samma två personaldestinationer som desktop. Två flikar, inget
 *  under Mer, ingen FAB (kalendern har sin egen walk-in-knapp i innehållet). Samma
 *  {tabs, more, action}-form som adminMobileNavigation. */
export function personalMobileNavigation(
  areas: readonly TopnavArea[],
): TopnavMobileNavigation {
  return { tabs: [...areas], more: [] }
}
