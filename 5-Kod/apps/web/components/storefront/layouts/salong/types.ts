/**
 * SALONG-SVITEN (goal-64) — Källa · Siluett · Snitt, ur Claude Design-paketen.
 *
 * Kontraktet är IDENTISKT med florist-svitens (goal-58/59): en mall är ett helt paket som
 * äger sitt sidhuvud, sin sidfot, sina undersidor och sina modul-vyer, medan modulen äger
 * sin funktion. Det finns ingen anledning att skriva ett andra, likadant kontrakt — då kan
 * de två sviterna glida isär utan att något test märker det. Typerna bor kvar i
 * florist/types.ts (där de skrevs) och återexporteras här; namnet "FloristTheme" är
 * historiskt, innebörden är "mall-paket".
 */
export type {
  FloristTheme as SalongTheme,
  FloristPalette,
  FloristFonts,
  ThemeNavProps,
  ThemeFooterProps,
  ThemePageProps,
  ThemeChrome,
  ThemePages,
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeProductViewProps,
  ThemeCartViewProps,
  ThemeCheckoutViewProps,
  ThemeModuleViews,
} from '../florist/types'
export { floristThemeBlock as salongThemeBlock } from '../florist/types'
