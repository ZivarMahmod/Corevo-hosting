import type { ComponentType } from 'react'
import type { StorefrontLayoutProps } from '../types'
import { KallaLayout } from './KallaLayout'
import { SiluettLayout } from './SiluettLayout'
import { SnittLayout } from './SnittLayout'

/** Salong-svitens HEM-layouter (goal-64). Splittad från registry.ts så klient-ytor som
 *  bara behöver paletter/nycklar slipper dra in tre React-träd. */
export const SALONG_LAYOUTS: Record<string, ComponentType<StorefrontLayoutProps>> = {
  kalla: KallaLayout,
  siluett: SiluettLayout,
  snitt: SnittLayout,
}
