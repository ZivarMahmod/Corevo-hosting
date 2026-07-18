'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import type { KundCardVM } from './KunderBoard'
import styles from './kunder-v2.module.css'

const KunderBoard = dynamic(
  () => import('./KunderBoard').then((module) => module.KunderBoard),
  {
    ssr: false,
    loading: () => (
      <div className={styles.board} aria-busy="true" aria-label="Laddar kunder">
        <div className={styles.list}>Laddar kundlistan…</div>
      </div>
    ),
  },
)

/** Keeps the interactive master board out of the size-limited Worker bundle. */
export function KunderBoardLazy({
  tenants,
  children,
}: {
  tenants: KundCardVM[]
  children: ReactNode
}) {
  return <KunderBoard tenants={tenants}>{children}</KunderBoard>
}
