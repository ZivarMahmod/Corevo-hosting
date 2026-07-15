'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import styles from './kunder-v2.module.css'

/** Master–detalj-skalet. Klient bara för att veta VILKEN panel mobilen ska visa:
 *  på /admin/kunder/<id> är en kund vald → visa kortet (+ ←-tillbaka), annars listan.
 *  `list` är en server-renderad panel som skickas in som prop (RSC-vänligt). */
export function KunderBoard({ list, children }: { list: ReactNode; children: ReactNode }) {
  const pathname = usePathname()
  const hasSelection = /^\/admin\/kunder\/[^/]+$/.test(pathname)
  return (
    <div className={`workbench ${styles.board}`} data-mobile-view={hasSelection ? 'card' : 'list'}>
      {list}
      {children}
    </div>
  )
}
