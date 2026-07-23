'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { logoutPortalAction } from '@/app/(customer-portal)/mina/actions'

type LogoutContextValue = {
  complete: (tenantSlug: string | null) => void
  expire: () => void
}
const LogoutContext = createContext<LogoutContextValue | null>(null)

export function installPortalPageShowGuard(
  reload: () => void = () => window.location.reload(),
  target: EventTarget = window,
): () => void {
  const onPageShow: EventListener = (event) => {
    if ((event as PageTransitionEvent).persisted) reload()
  }
  target.addEventListener('pageshow', onPageShow)
  return () => target.removeEventListener('pageshow', onPageShow)
}

export function PortalSessionBoundary({
  tenantSlug,
  children,
}: {
  tenantSlug: string
  children: ReactNode
}) {
  const router = useRouter()
  const [loggedOutTenant, setLoggedOutTenant] = useState<string | null>(null)
  useEffect(() => installPortalPageShowGuard(), [])

  if (loggedOutTenant) return <LoggedOutPortal tenantSlug={loggedOutTenant} />
  return (
    <LogoutContext.Provider value={{
      complete: (resultTenantSlug) => setLoggedOutTenant(resultTenantSlug ?? tenantSlug),
      expire: () => router.replace(`/aterhamta/${tenantSlug}?session=expired`),
    }}>
      {children}
    </LogoutContext.Provider>
  )
}

export function usePortalSessionExpiry(): () => void {
  const boundary = useContext(LogoutContext)
  return boundary?.expire ?? (() => undefined)
}

function LoggedOutPortal({ tenantSlug }: { tenantSlug: string }) {
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { mainRef.current?.focus() }, [])
  return (
    <div className="customer-portal">
      <a className="cp-skip" href="#huvudinnehall">Hoppa till innehåll</a>
      <header className="cp-topbar">
        <div className="cp-topbar-inner">
          <div className="cp-brand"><span>COREVO</span><small>MINA BOKNINGAR</small></div>
        </div>
      </header>
      <div className="cp-layout cp-layout-recovery">
        <main id="huvudinnehall" tabIndex={-1} ref={mainRef}>
          <section className="cp-screen cp-recovery-screen">
            <h1>Du är utloggad</h1>
            <Link className="cp-btn cp-btn-primary" href={`/aterhamta/${tenantSlug}`}>
              Få en ny kod
            </Link>
            <p>En giltig, oanvänd bokningslänk kan också öppna Mina bokningar.</p>
            <p className="cp-meta">Dina bokningar finns kvar och påverkas inte.</p>
          </section>
        </main>
      </div>
    </div>
  )
}

export function PortalLogoutTrigger({
  className,
  children = 'Logga ut',
}: {
  className?: string
  children?: ReactNode
}) {
  const boundary = useContext(LogoutContext)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const pendingRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<'closed' | 'confirm' | 'pending' | 'error'>('closed')
  const open = state !== 'closed'
  const pending = state === 'pending'

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (state === 'confirm') cancelRef.current?.focus()
  }, [state])
  useEffect(() => {
    if (state === 'pending') dialogRef.current?.focus()
  }, [state])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  const close = useCallback(() => {
    if (pendingRef.current) return
    setState('closed')
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        close()
        return
      }
      if (event.key !== 'Tab') return
      if (pendingRef.current) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not([disabled]):not([aria-disabled="true"])',
      ) ?? [])]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [close, open])

  async function submit() {
    if (pendingRef.current) return
    pendingRef.current = true
    setState('pending')
    try {
      const result = await logoutPortalAction()
      if (result.ok && boundary) {
        boundary.complete(result.tenantSlug)
        return
      }
      setState('error')
    } catch {
      setState('error')
    } finally {
      pendingRef.current = false
    }
  }

  const dialog = mounted && open ? createPortal(
    <div className="cp-cancel-layer">
      <div className="cp-cancel-scrim" aria-hidden="true" />
      <div
        className="cp-cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-current-title"
        aria-describedby="logout-current-description"
        aria-busy={pending ? 'true' : undefined}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="cp-cancel-handle" aria-hidden="true" />
        <h2 id="logout-current-title">Logga ut från den här enheten?</h2>
        <p id="logout-current-description">
          Du loggas ut från dina bokningar på den här enheten. Du kan verifiera dig igen med en ny kod.
        </p>
        {state === 'error' && (
          <p className="cp-cancel-error" role="alert">
            <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11.5h.01" /></svg>
            Åtgärden kunde inte genomföras. Försök igen.
          </p>
        )}
        <div className="cp-cancel-actions">
          <button
            className="cp-btn"
            type="button"
            ref={cancelRef}
            aria-disabled={pending ? 'true' : undefined}
            onClick={close}
          >
            Avbryt
          </button>
          <button
            className="cp-btn cp-btn-danger"
            type="button"
            aria-disabled={pending ? 'true' : undefined}
            onClick={submit}
          >
            {pending ? 'Loggar ut…' : 'Logga ut'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button className={className} type="button" ref={triggerRef} onClick={() => setState('confirm')}>
        {children}
      </button>
      {dialog}
    </>
  )
}
