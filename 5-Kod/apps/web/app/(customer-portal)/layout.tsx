import type { ReactNode } from 'react'
import './portal.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function CustomerPortalLayout({ children }: { children: ReactNode }) {
  return children
}
