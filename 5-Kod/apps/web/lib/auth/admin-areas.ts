// ROLL-SEPARATION i adminportalen — EN sanning för vem som får vara var.
//
// Zivars krav: personal (staff, nivå 3) ska ha FULL FRIHET I KALENDERN men INGEN
// systemadministration. Ägare/administratör (salon_admin, nivå 6) får allt.
//
// Portalen (app/(admin)) släpper därför in redan från STAFF-nivån — men VARJE yta
// har sin egen lägstanivå här. Både sidorna (requireAdminArea i page.tsx) och de
// muterande server actions (lib/admin/**) läser SAMMA tabell: RLS är tenant-scopad,
// INTE rollmedveten, så en action som saknar vakt är öppen för personalen.
// Att dölja en nav-länk är INTE behörighetskontroll — servern är sanningen.
//
// Nivåer = de fyra REALA DB-nivåerna (roles.level): kund 2, staff 3,
// salon_admin 6, super_admin 8.

export const ROLE_LEVEL = {
  kund: 2,
  staff: 3,
  salonAdmin: 6,
  superAdmin: 8,
} as const

/** Varje yta i adminportalen (motsvarar en rutt under /admin). */
export type AdminArea =
  | 'oversikt'
  | 'bokningar'
  | 'kunder'
  | 'statistik'
  | 'tjanster'
  | 'personal'
  | 'platser'
  | 'scheman'
  | 'kurser'
  | 'media'
  | 'webshop'
  | 'blogg'
  | 'offerter'
  | 'kontakt'
  | 'lojalitet'
  | 'presentkort'
  | 'sida'
  | 'varumarke'
  | 'installningar'

/**
 * Yta → lägsta rollnivå. Personal (3) = arbetsdagen: översikt, kalender, kunder.
 * Allt som konfigurerar FÖRETAGET (tjänster, personal, priser, sida, inställningar,
 * moduler, statistik) kräver salon_admin (6).
 */
export const ADMIN_AREA_MIN_LEVEL: Record<AdminArea, number> = {
  // Personalens arbetsdag — full frihet.
  oversikt: ROLE_LEVEL.staff,
  bokningar: ROLE_LEVEL.staff,
  kunder: ROLE_LEVEL.staff,
  // Systemadministration — ägare/administratör.
  statistik: ROLE_LEVEL.salonAdmin,
  tjanster: ROLE_LEVEL.salonAdmin,
  personal: ROLE_LEVEL.salonAdmin,
  platser: ROLE_LEVEL.salonAdmin,
  scheman: ROLE_LEVEL.salonAdmin,
  kurser: ROLE_LEVEL.salonAdmin,
  media: ROLE_LEVEL.salonAdmin,
  webshop: ROLE_LEVEL.salonAdmin,
  blogg: ROLE_LEVEL.salonAdmin,
  offerter: ROLE_LEVEL.salonAdmin,
  kontakt: ROLE_LEVEL.salonAdmin,
  lojalitet: ROLE_LEVEL.salonAdmin,
  presentkort: ROLE_LEVEL.salonAdmin,
  sida: ROLE_LEVEL.salonAdmin,
  varumarke: ROLE_LEVEL.salonAdmin,
  installningar: ROLE_LEVEL.salonAdmin,
}

/**
 * Portalens golv = den LÄGSTA ytnivån. Layouten (app/(admin)/layout.tsx) släpper in
 * hit — sedan gatar varje sida sin egen yta. Härleds ur tabellen så att golvet aldrig
 * kan glida ifrån den.
 */
export const ADMIN_PORTAL_FLOOR: number = Math.min(...Object.values(ADMIN_AREA_MIN_LEVEL))

/** Rutt-prefix per yta (längsta träffen vinner). '/admin' = översikt. */
const AREA_PREFIX: ReadonlyArray<readonly [string, AdminArea]> = [
  ['/admin/bokningar', 'bokningar'],
  ['/admin/kunder', 'kunder'],
  ['/admin/statistik', 'statistik'],
  ['/admin/tjanster', 'tjanster'],
  ['/admin/personal', 'personal'],
  ['/admin/platser', 'platser'],
  ['/admin/scheman', 'scheman'],
  ['/admin/kurser', 'kurser'],
  ['/admin/media', 'media'],
  ['/admin/webshop', 'webshop'],
  ['/admin/blogg', 'blogg'],
  ['/admin/offerter', 'offerter'],
  ['/admin/kontakt', 'kontakt'],
  ['/admin/lojalitet', 'lojalitet'],
  ['/admin/presentkort', 'presentkort'],
  ['/admin/sida', 'sida'],
  ['/admin/varumarke', 'varumarke'],
  ['/admin/installningar', 'installningar'],
  ['/admin', 'oversikt'],
]

/** Vilken yta en /admin-rutt tillhör (null = inte en adminrutt). */
export function adminAreaForPath(pathname: string): AdminArea | null {
  for (const [prefix, area] of AREA_PREFIX) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return area
  }
  return null
}

/** Får den här rollen se/röra ytan? platform_admin passerar alltid. */
export function canAccessAdminArea(
  area: AdminArea,
  user: { roleLevel: number; platformAdmin?: boolean },
): boolean {
  if (user.platformAdmin) return true
  return user.roleLevel >= ADMIN_AREA_MIN_LEVEL[area]
}
