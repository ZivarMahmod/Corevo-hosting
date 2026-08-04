'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parsePortalLinkFragment } from '@/lib/customer-portal/link'

type State = 'checking' | 'error'

function exchangeDestination(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (result.ok !== true || typeof result.destination !== 'string') return null
  return result.destination === '/mina'
    || /^\/mina\/bokningar\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.destination)
    ? result.destination
    : null
}

export function OpenLinkExchange({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    const fragment = window.location.hash
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    )

    const credential = parsePortalLinkFragment(fragment)
    if (!credential) {
      setState('error')
      return
    }

    const controller = new AbortController()
    void fetch('/api/customer-portal/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantSlug, ...credential }),
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('exchange_failed')
        const destination = exchangeDestination(await response.json())
        if (!destination) throw new Error('exchange_failed')
        if (!controller.signal.aborted) router.replace(destination)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState('error')
      })

    return () => controller.abort()
  }, [router, tenantSlug])

  if (state === 'error') {
    return (
      <section aria-live="polite">
        <h1>Länken kan inte användas</h1>
        <p>Be om en ny länk och försök igen.</p>
      </section>
    )
  }

  return (
    <section aria-live="polite" aria-busy="true">
      <h1>Öppnar din bokning</h1>
      <p>Vi kontrollerar länken säkert. Det tar oftast bara ett ögonblick.</p>
    </section>
  )
}
