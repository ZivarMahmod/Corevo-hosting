import type { ComponentType } from 'react'
import type { StorefrontLayoutProps } from '../types'
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
