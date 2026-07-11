import type { ComponentType } from 'react'
import type { StorefrontLayoutProps } from '../types'
import type { ThemeChrome, ThemePages, ThemeModuleViews } from './types'
import { FLORIST_THEMES } from './registry'
import { CalytrixLayout } from './CalytrixLayout'
import { AuroraLayout } from './AuroraLayout'
import { SageLayout } from './SageLayout'
import { OliviaThymeLayout } from './OliviaThymeLayout'
import { PaisleyLayout } from './PaisleyLayout'
import { OnyxLayout } from './OnyxLayout'
import { VioraLayout } from './VioraLayout'
import { IsalaraLayout } from './IsalaraLayout'
import { SeraphinaLayout } from './SeraphinaLayout'
import { WildThistleLayout } from './WildThistleLayout'
import { MinaLayout } from './MinaLayout'
import { LunariaLayout } from './LunariaLayout'
import { EloriaLayout } from './EloriaLayout'

/** Florist-svitens 13 HEM-layouter. Splittad från registry.ts så klient-ytor som
 *  bara behöver paletter/nycklar slipper dra in 13 React-komponenter. */
export const FLORIST_LAYOUTS: Record<string, ComponentType<StorefrontLayoutProps>> = {
  calytrix: CalytrixLayout,
  aurora: AuroraLayout,
  sage: SageLayout,
  oliviathyme: OliviaThymeLayout,
  paisley: PaisleyLayout,
  onyx: OnyxLayout,
  viora: VioraLayout,
  isalara: IsalaraLayout,
  seraphina: SeraphinaLayout,
  wildthistle: WildThistleLayout,
  mina: MinaLayout,
  lunaria: LunariaLayout,
  eloria: EloriaLayout,
}

/**
 * Mallens EGNA sidhuvud/sidfot (goal-59). Tomt objekt = mallen kör plattformens delade
 * Nav/Footer. app/(public)/layout.tsx frågar hit — ett tema utanför florist-sviten får
 * `undefined` och renderar exakt som förr.
 */
export function themeChrome(key: string): ThemeChrome {
  return FLORIST_THEMES.find((t) => t.key === key)?.chrome ?? {}
}

/** Mallens EGNA undersidor (/om, /tjanster, /kontakt). Saknas → delade sektioner. */
export function themePages(key: string): ThemePages {
  return FLORIST_THEMES.find((t) => t.key === key)?.pages ?? {}
}

/**
 * Mallens EGNA modul-vyer (butik/blogg). Modulen laddar sin data och gatar sin
 * livscykel; hittar den en vy här renderas datan i MALLENS formspråk — annars i
 * modulens delade sektion, byte-identiskt. Zivars vektor-regel: mallens vektor är
 * apex för modulens, men modulens funktion är alltid densamma.
 */
export function themeModuleViews(key: string): ThemeModuleViews {
  return FLORIST_THEMES.find((t) => t.key === key)?.moduleViews ?? {}
}
