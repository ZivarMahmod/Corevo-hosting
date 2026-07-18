'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { KunderView as KunderViewComponent } from './KunderView'

const KunderView = dynamic(
  () => import('./KunderView').then((module) => module.KunderView),
  { ssr: false, loading: () => <div aria-busy="true">Laddar slutkunder…</div> },
)

export function KunderViewLazy(props: ComponentProps<typeof KunderViewComponent>) {
  return <KunderView {...props} />
}
