'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function PortalRouteFocus() {
  const pathname = usePathname()

  useEffect(() => {
    document.getElementById('huvudinnehall')?.focus()
  }, [pathname])

  return null
}
