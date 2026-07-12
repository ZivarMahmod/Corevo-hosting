import type { ComponentType } from 'react'
import type { StorefrontLayoutProps } from '../types'
import { ZentumLayout } from './ZentumLayout'

/** Ekonomi-svitens HEM-layouter. Splittad från registry.ts så klient-ytor som bara
 *  behöver paletter/nycklar slipper dra in React-komponenterna. */
export const EKONOMI_LAYOUTS: Record<string, ComponentType<StorefrontLayoutProps>> = {
  zentum: ZentumLayout,
}
