'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

type CancellationFeedback = {
  scheduleSuccess: (tenantName: string) => number
  focusPortalContent: () => void
}

const CancellationFeedbackContext = createContext<CancellationFeedback | null>(null)
const EXIT_DURATION_MS = 140

function focusPortalContent() {
  document.getElementById('huvudinnehall')?.focus()
}

export function PortalCancellationFeedbackProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pendingSuccessTimerRef = useRef<number | null>(null)
  const [success, setSuccess] = useState<{ id: number; tenantName: string } | null>(null)
  const [paused, setPaused] = useState(false)

  const scheduleSuccess = useCallback((tenantName: string) => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const delay = reducedMotion ? 0 : EXIT_DURATION_MS
    if (pendingSuccessTimerRef.current !== null) {
      window.clearTimeout(pendingSuccessTimerRef.current)
    }
    pendingSuccessTimerRef.current = window.setTimeout(() => {
      pendingSuccessTimerRef.current = null
      focusPortalContent()
      setPaused(false)
      setSuccess((current) => ({ id: (current?.id ?? 0) + 1, tenantName }))
      router.refresh()
    }, delay)
    return delay
  }, [router])

  const value = useMemo(() => ({ scheduleSuccess, focusPortalContent }), [scheduleSuccess])

  useEffect(() => () => {
    if (pendingSuccessTimerRef.current !== null) {
      window.clearTimeout(pendingSuccessTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!success || paused) return
    const timeout = window.setTimeout(() => setSuccess(null), 6_000)
    return () => window.clearTimeout(timeout)
  }, [paused, success])

  useEffect(() => {
    if (success) focusPortalContent()
  }, [children, success])

  return (
    <CancellationFeedbackContext.Provider value={value}>
      {children}
      {success && (
        <p
          className="cp-toast cp-cancel-toast"
          role="status"
          tabIndex={0}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
          }}
        >
          <svg className="cp-icon" viewBox="0 0 20 20" aria-hidden="true">
            <path d="m4 10 4 4 8-8" />
          </svg>
          Bokningen är avbokad. {success.tenantName} har fått besked.
        </p>
      )}
    </CancellationFeedbackContext.Provider>
  )
}

export function usePortalCancellationFeedback() {
  return useContext(CancellationFeedbackContext)
}
