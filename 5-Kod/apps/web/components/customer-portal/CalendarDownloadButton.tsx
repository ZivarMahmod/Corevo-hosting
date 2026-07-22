'use client'

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

type CalendarState = 'idle' | 'pending' | 'success' | 'error'
type CalendarViewState = { bookingPublicId: string; state: CalendarState }

const CalendarBookingContext = createContext<string | null>(null)

export function CalendarBookingProvider({
  bookingPublicId,
  children,
}: {
  bookingPublicId: string
  children: ReactNode
}) {
  return (
    <CalendarBookingContext.Provider value={bookingPublicId}>
      {children}
    </CalendarBookingContext.Provider>
  )
}

export function CalendarDownloadButton({
  variant = 'secondary',
}: {
  variant?: 'primary' | 'secondary'
}) {
  const contextBookingPublicId = useContext(CalendarBookingContext)
  if (!contextBookingPublicId) {
    throw new Error('CalendarDownloadButton requires a booking context')
  }
  const bookingPublicId: string = contextBookingPublicId

  const [viewState, setViewState] = useState<CalendarViewState>({
    bookingPublicId,
    state: 'idle',
  })
  const pending = useRef(false)
  const generationRef = useRef(0)
  const activeRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const generation = ++generationRef.current
    pending.current = false

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
      activeRequestRef.current?.abort()
      activeRequestRef.current = null
      pending.current = false
    }
  }, [bookingPublicId])

  async function download() {
    if (pending.current) return
    pending.current = true
    const generation = generationRef.current
    const request = new AbortController()
    activeRequestRef.current = request
    const isCurrent = () => (
      !request.signal.aborted && generationRef.current === generation
    )
    setViewState({ bookingPublicId, state: 'pending' })

    try {
      const response = await fetch(
        `/api/customer-portal/bookings/${encodeURIComponent(bookingPublicId)}/calendar`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: request.signal,
        },
      )
      if (!isCurrent()) return
      if (!response.ok) throw new Error('calendar_unavailable')

      const blob = await response.blob()
      if (!isCurrent()) return
      const objectUrl = URL.createObjectURL(blob)
      if (!isCurrent()) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = 'corevo-bokning.ics'
      anchor.hidden = true
      document.body.append(anchor)
      try {
        anchor.click()
      } finally {
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      }
      if (isCurrent()) setViewState({ bookingPublicId, state: 'success' })
    } catch {
      if (isCurrent()) setViewState({ bookingPublicId, state: 'error' })
    } finally {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null
        pending.current = false
      }
    }
  }

  const state = viewState.bookingPublicId === bookingPublicId ? viewState.state : 'idle'
  const busy = state === 'pending'
  return (
    <div
      className="cp-calendar-download"
      data-state={state === 'idle' ? undefined : `calendar_${state}`}
    >
      <button
        className={`cp-btn${variant === 'primary' ? ' cp-btn-primary' : ''}`}
        type="button"
        aria-disabled={busy || undefined}
        onClick={download}
      >
        <svg className="cp-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M6 2v4M14 2v4M3 8h14M10 11v4M8 13h4" />
        </svg>
        {busy ? 'Hämtar…' : 'Lägg i kalender'}
      </button>
      {state === 'success' && (
        <p className="cp-calendar-status cp-calendar-status-success" role="status">
          <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
          Kalenderfilen är klar
        </p>
      )}
      {state === 'error' && (
        <p className="cp-calendar-status cp-calendar-status-error" role="alert">
          <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11.5h.01" /></svg>
          Kalenderfilen kunde inte skapas. Försök igen.
        </p>
      )}
    </div>
  )
}
