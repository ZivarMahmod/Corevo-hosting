import type { ComponentType } from 'react'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { StorefrontExperience } from '@/lib/storefront/experience'
import { THEME_SUITES } from '@/lib/storefront/themes/registry'
import { EditLayout } from './EditLayout'
import { FloraLayout } from './FloraLayout'
import { FreshCutFooter, FreshCutNav } from './FreshCutChrome'
import { FreshCutLayout } from './FreshCutLayout'
import { FreshCutMotionLayout } from './FreshCutMotionLayout'
import { LeanderLayout } from './LeanderLayout'
import { LinneaLayout } from './LinneaLayout'
import { SalviaLayout } from './SalviaLayout'
import type { StorefrontLayoutProps } from './types'
import type { ThemeChrome, ThemeModuleViews, ThemePages } from './florist/types'
import { ZiggeLayout } from './ZiggeLayout'
import { ZentumLayout } from './ekonomi/ZentumLayout'
import { AteljeVinterLayout } from './florist/AteljeVinterLayout'
import { AuroraLayout } from './florist/AuroraLayout'
import { BlomstertorgetLayout } from './florist/BlomstertorgetLayout'
import { CalytrixLayout } from './florist/CalytrixLayout'
import { EloriaLayout } from './florist/EloriaLayout'
import { LunariaLayout } from './florist/LunariaLayout'
import { OnyxLayout } from './florist/OnyxLayout'
import { SivSavLayout } from './florist/SivSavLayout'
import { SolSaltLayout } from './florist/SolSaltLayout'
import { AteljeVinterNav, AteljeVinterFooter } from './florist/ateljevinter.chrome'
import {
  AteljeVinterOm,
  AteljeVinterTjanster,
  AteljeVinterKontakt,
} from './florist/ateljevinter.pages'
import { AteljeVinterCart } from './florist/ateljevinter.cart'
import {
  AteljeVinterBlogg,
  AteljeVinterGalleri,
  AteljeVinterKurser,
  AteljeVinterLojalitet,
  AteljeVinterOffert,
  AteljeVinterPresentkort,
  AteljeVinterShop,
} from './florist/ateljevinter.modules'
import { AuroraNav, AuroraFooter } from './florist/aurora.chrome'
import { AuroraOm, AuroraTjanster, AuroraKontakt } from './florist/aurora.pages'
import { AuroraBlogg, AuroraGalleri, AuroraLojalitet, AuroraShop } from './florist/aurora.modules'
import { BlomstertorgetNav, BlomstertorgetFooter } from './florist/blomstertorget.chrome'
import {
  BlomstertorgetOm,
  BlomstertorgetTjanster,
  BlomstertorgetKontakt,
} from './florist/blomstertorget.pages'
import {
  BlomstertorgetBlogg,
  BlomstertorgetGalleri,
  BlomstertorgetLojalitet,
  BlomstertorgetShop,
} from './florist/blomstertorget.modules'
import { CalytrixNav, CalytrixFooter } from './florist/calytrix.chrome'
import { CalytrixOm, CalytrixTjanster, CalytrixKontakt } from './florist/calytrix.pages'
import {
  CalytrixBlogg,
  CalytrixGalleri,
  CalytrixLojalitet,
  CalytrixShop,
} from './florist/calytrix.modules'
import { CalytrixProduct } from './florist/calytrix.product'
import { CalytrixCart } from './florist/calytrix.cart'
import { CalytrixCheckout } from './florist/calytrix.checkout'
import { EloriaNav, EloriaFooter } from './florist/eloria.chrome'
import { EloriaOm, EloriaTjanster, EloriaKontakt } from './florist/eloria.pages'
import { EloriaBlogg, EloriaGalleri, EloriaLojalitet, EloriaShop } from './florist/eloria.modules'
import { LunariaNav, LunariaFooter } from './florist/lunaria.chrome'
import { LunariaOm, LunariaTjanster, LunariaKontakt } from './florist/lunaria.pages'
import {
  LunariaBlogg,
  LunariaGalleri,
  LunariaLojalitet,
  LunariaShop,
} from './florist/lunaria.modules'
import { OnyxNav, OnyxFooter } from './florist/onyx.chrome'
import { OnyxOm, OnyxTjanster, OnyxKontakt } from './florist/onyx.pages'
import { OnyxBlogg, OnyxGalleri, OnyxLojalitet, OnyxShop } from './florist/onyx.modules'
import { SivSavNav, SivSavFooter } from './florist/sivsav.chrome'
import { SivSavOm, SivSavTjanster, SivSavKontakt } from './florist/sivsav.pages'
import { SivSavBlogg, SivSavGalleri, SivSavLojalitet, SivSavShop } from './florist/sivsav.modules'
import { SolSaltNav, SolSaltFooter } from './florist/solsalt.chrome'
import { SolSaltOm, SolSaltTjanster, SolSaltKontakt } from './florist/solsalt.pages'
import {
  SolSaltBlogg,
  SolSaltGalleri,
  SolSaltLojalitet,
  SolSaltShop,
} from './florist/solsalt.modules'
import { ZentumNav, ZentumFooter } from './ekonomi/zentum.chrome'
import { ZentumOm, ZentumTjanster, ZentumKontakt } from './ekonomi/zentum.pages'
import { KallaLayout } from './salong/KallaLayout'
import { SiluettLayout } from './salong/SiluettLayout'
import { SnittLayout } from './salong/SnittLayout'
import { KallaNav, KallaFooter } from './salong/kalla.chrome'
import { KallaOm, KallaTjanster, KallaKontakt } from './salong/kalla.pages'
import {
  KallaBlogg,
  KallaGalleri,
  KallaLojalitet,
  KallaShop,
  KallaTeam,
} from './salong/kalla.modules'
import { SiluettNav, SiluettFooter } from './salong/siluett.chrome'
import { SiluettOm, SiluettTjanster, SiluettKontakt } from './salong/siluett.pages'
import {
  SiluettBlogg,
  SiluettGalleri,
  SiluettLojalitet,
  SiluettShop,
  SiluettTeam,
} from './salong/siluett.modules'
import { SnittNav, SnittFooter } from './salong/snitt.chrome'
import { SnittOm, SnittTjanster, SnittKontakt } from './salong/snitt.pages'
import {
  SnittBlogg,
  SnittGalleri,
  SnittLojalitet,
  SnittShop,
  SnittTeam,
} from './salong/snitt.modules'
import {
  AuroraPresentkort,
  BlomstertorgetPresentkort,
  CalytrixPresentkort,
  EloriaPresentkort,
  KallaPresentkort,
  LunariaPresentkort,
  OnyxPresentkort,
  SiluettPresentkort,
  SivSavPresentkort,
  SnittPresentkort,
  SolSaltPresentkort,
} from './presentkort-views'

type ThemeRuntime = {
  layout: ComponentType<StorefrontLayoutProps>
  chrome?: ThemeChrome
  pages?: ThemePages
  moduleViews?: ThemeModuleViews
}

const THEME_RUNTIME: Readonly<Record<string, ThemeRuntime>> = {
  salvia: { layout: SalviaLayout },
  leander: { layout: LeanderLayout },
  zigge: { layout: ZiggeLayout },
  linnea: { layout: LinneaLayout },
  edit: { layout: EditLayout },
  flora: { layout: FloraLayout },
  freshcut: {
    layout: FreshCutLayout,
    chrome: { Nav: FreshCutNav, Footer: FreshCutFooter, ownsUtility: true },
  },
  ateljevinter: {
    layout: AteljeVinterLayout,
    chrome: { Nav: AteljeVinterNav, Footer: AteljeVinterFooter, ownsUtility: true },
    pages: { om: AteljeVinterOm, tjanster: AteljeVinterTjanster, kontakt: AteljeVinterKontakt },
    moduleViews: {
      shop: AteljeVinterShop,
      blogg: AteljeVinterBlogg,
      galleri: AteljeVinterGalleri,
      lojalitet: AteljeVinterLojalitet,
      offert: AteljeVinterOffert,
      presentkort: AteljeVinterPresentkort,
      kurser: AteljeVinterKurser,
      cart: AteljeVinterCart,
    },
  },
  aurora: {
    layout: AuroraLayout,
    chrome: { Nav: AuroraNav, Footer: AuroraFooter },
    pages: { om: AuroraOm, tjanster: AuroraTjanster, kontakt: AuroraKontakt },
    moduleViews: {
      shop: AuroraShop,
      blogg: AuroraBlogg,
      galleri: AuroraGalleri,
      lojalitet: AuroraLojalitet,
      presentkort: AuroraPresentkort,
    },
  },
  blomstertorget: {
    layout: BlomstertorgetLayout,
    chrome: { Nav: BlomstertorgetNav, Footer: BlomstertorgetFooter, ownsUtility: true },
    pages: {
      om: BlomstertorgetOm,
      tjanster: BlomstertorgetTjanster,
      kontakt: BlomstertorgetKontakt,
    },
    moduleViews: {
      shop: BlomstertorgetShop,
      blogg: BlomstertorgetBlogg,
      galleri: BlomstertorgetGalleri,
      lojalitet: BlomstertorgetLojalitet,
      presentkort: BlomstertorgetPresentkort,
    },
  },
  calytrix: {
    layout: CalytrixLayout,
    chrome: { Nav: CalytrixNav, Footer: CalytrixFooter, ownsUtility: true },
    pages: { om: CalytrixOm, tjanster: CalytrixTjanster, kontakt: CalytrixKontakt },
    moduleViews: {
      shop: CalytrixShop,
      blogg: CalytrixBlogg,
      galleri: CalytrixGalleri,
      lojalitet: CalytrixLojalitet,
      presentkort: CalytrixPresentkort,
      product: CalytrixProduct,
      cart: CalytrixCart,
      checkout: CalytrixCheckout,
    },
  },
  eloria: {
    layout: EloriaLayout,
    chrome: { Nav: EloriaNav, Footer: EloriaFooter, ownsUtility: true },
    pages: { om: EloriaOm, tjanster: EloriaTjanster, kontakt: EloriaKontakt },
    moduleViews: {
      shop: EloriaShop,
      blogg: EloriaBlogg,
      galleri: EloriaGalleri,
      lojalitet: EloriaLojalitet,
      presentkort: EloriaPresentkort,
    },
  },
  kalla: {
    layout: KallaLayout,
    chrome: { Nav: KallaNav, Footer: KallaFooter },
    pages: { om: KallaOm, tjanster: KallaTjanster, kontakt: KallaKontakt },
    moduleViews: {
      shop: KallaShop,
      blogg: KallaBlogg,
      galleri: KallaGalleri,
      lojalitet: KallaLojalitet,
      team: KallaTeam,
      presentkort: KallaPresentkort,
    },
  },
  lunaria: {
    layout: LunariaLayout,
    chrome: { Nav: LunariaNav, Footer: LunariaFooter },
    pages: { om: LunariaOm, tjanster: LunariaTjanster, kontakt: LunariaKontakt },
    moduleViews: {
      shop: LunariaShop,
      blogg: LunariaBlogg,
      galleri: LunariaGalleri,
      lojalitet: LunariaLojalitet,
      presentkort: LunariaPresentkort,
    },
  },
  onyx: {
    layout: OnyxLayout,
    chrome: { Nav: OnyxNav, Footer: OnyxFooter },
    pages: { om: OnyxOm, tjanster: OnyxTjanster, kontakt: OnyxKontakt },
    moduleViews: {
      shop: OnyxShop,
      blogg: OnyxBlogg,
      galleri: OnyxGalleri,
      lojalitet: OnyxLojalitet,
      presentkort: OnyxPresentkort,
    },
  },
  siluett: {
    layout: SiluettLayout,
    chrome: { Nav: SiluettNav, Footer: SiluettFooter },
    pages: { om: SiluettOm, tjanster: SiluettTjanster, kontakt: SiluettKontakt },
    moduleViews: {
      shop: SiluettShop,
      blogg: SiluettBlogg,
      galleri: SiluettGalleri,
      lojalitet: SiluettLojalitet,
      team: SiluettTeam,
      presentkort: SiluettPresentkort,
    },
  },
  sivsav: {
    layout: SivSavLayout,
    chrome: { Nav: SivSavNav, Footer: SivSavFooter },
    pages: { om: SivSavOm, tjanster: SivSavTjanster, kontakt: SivSavKontakt },
    moduleViews: {
      shop: SivSavShop,
      blogg: SivSavBlogg,
      galleri: SivSavGalleri,
      lojalitet: SivSavLojalitet,
      presentkort: SivSavPresentkort,
    },
  },
  snitt: {
    layout: SnittLayout,
    chrome: { Nav: SnittNav, Footer: SnittFooter, ownsUtility: true },
    pages: { om: SnittOm, tjanster: SnittTjanster, kontakt: SnittKontakt },
    moduleViews: {
      shop: SnittShop,
      blogg: SnittBlogg,
      galleri: SnittGalleri,
      lojalitet: SnittLojalitet,
      team: SnittTeam,
      presentkort: SnittPresentkort,
    },
  },
  solsalt: {
    layout: SolSaltLayout,
    chrome: { Nav: SolSaltNav, Footer: SolSaltFooter, ownsUtility: true },
    pages: { om: SolSaltOm, tjanster: SolSaltTjanster, kontakt: SolSaltKontakt },
    moduleViews: {
      shop: SolSaltShop,
      blogg: SolSaltBlogg,
      galleri: SolSaltGalleri,
      lojalitet: SolSaltLojalitet,
      presentkort: SolSaltPresentkort,
    },
  },
  zentum: {
    layout: ZentumLayout,
    chrome: { Nav: ZentumNav, Footer: ZentumFooter, ownsUtility: true },
    pages: { om: ZentumOm, tjanster: ZentumTjanster, kontakt: ZentumKontakt },
  },
} satisfies Record<StorefrontTheme, ThemeRuntime>

export const STOREFRONT_LAYOUTS = Object.fromEntries(
  Object.entries(THEME_RUNTIME).map(([key, runtime]) => [key, runtime.layout]),
) as Record<StorefrontTheme, ComponentType<StorefrontLayoutProps>>

export function resolveStorefrontLayout(
  theme: StorefrontTheme,
  experience: StorefrontExperience,
): ComponentType<StorefrontLayoutProps> {
  return theme === 'freshcut' && experience === 'freshcut-motiontest'
    ? FreshCutMotionLayout
    : STOREFRONT_LAYOUTS[theme]
}

export const THEME_OWNS_MODULES: ReadonlySet<StorefrontTheme> = new Set<StorefrontTheme>([
  'flora',
  'salvia',
  'leander',
  'zigge',
  'linnea',
  'edit',
  ...THEME_SUITES.florist.map((theme) => theme.key as StorefrontTheme),
  ...THEME_SUITES.salong.map((theme) => theme.key as StorefrontTheme),
])

export const THEME_LOADS_LAYOUT_MODULES: ReadonlySet<StorefrontTheme> = new Set<StorefrontTheme>([
  ...THEME_OWNS_MODULES,
  'freshcut',
])

export function themeChrome(key: string): ThemeChrome {
  return THEME_RUNTIME[key]?.chrome ?? {}
}

export function themePages(key: string): ThemePages {
  return THEME_RUNTIME[key]?.pages ?? {}
}

export function themeModuleViews(key: string): ThemeModuleViews {
  return THEME_RUNTIME[key]?.moduleViews ?? {}
}
