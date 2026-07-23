'use client'

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { updatePortalNameAction } from '@/app/(customer-portal)/mina/actions'
import type {
  PortalContactChangeAction,
  PortalSecondaryContact,
  PortalVerifiedContact,
} from '@/lib/customer-portal/types'
import { containsUnicode17Forbidden } from '@/lib/customer-portal/unicode17-policy'
import { PortalLogoutTrigger, usePortalSessionExpiry } from './PortalSessionBoundary'
import { ContactChangeFlow } from './ContactChangeFlow'

const NAME_ERROR = 'Namnet måste vara 2–120 tecken.'
const SAVE_ERROR = 'Namnet kunde inte sparas. Försök igen.'

function normalizeName(value: string): string | null {
  let normalized: string
  try {
    normalized = value.normalize('NFC').trim()
  } catch {
    return null
  }
  const length = [...normalized].length
  return length >= 2 && length <= 120 &&
    !containsUnicode17Forbidden(normalized)
    ? normalized
    : null
}

function Chevron() {
  return <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
}

function ContactIcon({ channel }: { channel: 'sms' | 'email' }) {
  return channel === 'sms' ? (
    <svg className="cp-icon cp-contact-icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="5" y="2" width="10" height="16" rx="2" /><path d="M8 5h4M9 15h2" />
    </svg>
  ) : (
    <svg className="cp-icon cp-contact-icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2" /><path d="m3 6 7 5 7-5" />
    </svg>
  )
}

function MenuIcon({ kind }: { kind: 'profile' | 'security' | 'install' | 'logout' }) {
  return kind === 'profile' ? (
    <svg className="cp-icon cp-menu-leading-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3" /><path d="M5 20c1-4 3-6 7-6s6 2 7 6" />
    </svg>
  ) : kind === 'security' ? (
    <svg className="cp-icon cp-menu-leading-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  ) : kind === 'install' ? (
    <svg className="cp-icon cp-menu-leading-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M12 7v7m-3-3 3 3 3-3M10 18h4" />
    </svg>
  ) : (
    <svg className="cp-icon cp-menu-leading-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H5v14h5M13 8l4 4-4 4M8 12h9" />
    </svg>
  )
}

export function CustomerProfileCard({
  tenantName,
  customerName,
  verifiedContact,
  secondaryContact,
  contactChangeActions,
}: {
  tenantName: string
  customerName: string
  verifiedContact: PortalVerifiedContact
  secondaryContact: PortalSecondaryContact | null
  contactChangeActions: PortalContactChangeAction[]
}) {
  const expireSession = usePortalSessionExpiry()
  const [name, setName] = useState(customerName)
  const [draft, setDraft] = useState(customerName)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const requestPendingRef = useRef(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const restoreEditFocusRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const toastStartedAtRef = useRef(0)
  const toastRemainingRef = useRef(5_000)
  const [contactAction, setContactAction] = useState<PortalContactChangeAction | null>(null)
  const changePhoneRef = useRef<HTMLButtonElement>(null)
  const addPhoneRef = useRef<HTMLButtonElement>(null)
  const changeEmailRef = useRef<HTMLButtonElement>(null)

  const contactActionRef = contactAction === 'change_phone'
    ? changePhoneRef
    : contactAction === 'add_phone'
      ? addPhoneRef
      : changeEmailRef

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    input?.focus()
    input?.setSelectionRange(input.value.length, input.value.length)
  }, [editing])

  useEffect(() => {
    if (editing || !restoreEditFocusRef.current) return
    restoreEditFocusRef.current = false
    editRef.current?.focus()
  }, [editing])

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = null
  }, [])

  const scheduleToast = useCallback((milliseconds: number) => {
    clearToastTimer()
    toastRemainingRef.current = milliseconds
    toastStartedAtRef.current = Date.now()
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null
      setSaved(false)
    }, milliseconds)
  }, [clearToastTimer])

  useEffect(() => {
    if (!saved) return
    toastRemainingRef.current = 5_000
    scheduleToast(5_000)
    return clearToastTimer
  }, [clearToastTimer, saved, scheduleToast])

  function pauseToast() {
    if (toastTimerRef.current === null) return
    toastRemainingRef.current = Math.max(
      0,
      toastRemainingRef.current - (Date.now() - toastStartedAtRef.current),
    )
    clearToastTimer()
  }

  function resumeToast() {
    if (!saved || toastTimerRef.current !== null) return
    scheduleToast(toastRemainingRef.current)
  }

  useEffect(() => {
    if (!editing) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || requestPendingRef.current) return
      event.preventDefault()
      setEditing(false)
      restoreEditFocusRef.current = true
      setError(null)
      setDraft(name)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editing, name])

  function beginEdit() {
    setDraft(name)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    if (requestPendingRef.current) return
    setEditing(false)
    restoreEditFocusRef.current = true
    setDraft(name)
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestPendingRef.current) return
    const normalized = normalizeName(draft)
    if (!normalized) {
      setError(NAME_ERROR)
      return
    }
    requestPendingRef.current = true
    setPending(true)
    setError(null)
    try {
      const result = await updatePortalNameAction(normalized)
      if (result.outcome === 'expired') {
        expireSession()
        return
      }
      if (result.outcome !== 'success') {
        setError(result.outcome === 'invalid' ? NAME_ERROR : SAVE_ERROR)
        return
      }
      setName(result.name)
      setDraft(result.name)
      setEditing(false)
      restoreEditFocusRef.current = true
      setSaved(true)
    } catch {
      setError(SAVE_ERROR)
    } finally {
      requestPendingRef.current = false
      setPending(false)
    }
  }

  function focusCard(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    cardRef.current?.scrollIntoView({ block: 'start' })
    cardRef.current?.focus()
  }

  return (
    <section className="cp-screen cp-profile-screen">
      <h1>Profil</h1>
      <section
        className="cp-card cp-profile-card"
        aria-labelledby="uppgifter"
        id="uppgiftskort"
        tabIndex={-1}
        ref={cardRef}
      >
        <h2 id="uppgifter">Mina uppgifter</h2>
        <p>Uppgifterna gäller hos {tenantName}.</p>
        {editing ? (
          <form className="cp-stack cp-name-form" noValidate onSubmit={submit}>
            <label className="cp-field" htmlFor="profilnamn">
              <span>Namn</span>
              <input
                id="profilnamn"
                name="name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                aria-describedby={error ? 'profilnamn-fel' : undefined}
                value={draft}
                disabled={pending}
                ref={inputRef}
                onInput={(event) => setDraft(event.currentTarget.value)}
              />
            </label>
            {error && <p className="cp-error" id="profilnamn-fel" role="alert">{error}</p>}
            <div className="cp-actions cp-name-actions">
              <button
                className="cp-btn cp-btn-primary"
                type="submit"
                aria-disabled={pending ? 'true' : undefined}
              >
                {pending ? 'Sparar…' : 'Spara'}
              </button>
              <button
                className="cp-btn"
                type="button"
                aria-disabled={pending ? 'true' : undefined}
                onClick={cancelEdit}
              >
                Avbryt
              </button>
            </div>
          </form>
        ) : (
          <div className="cp-row cp-between cp-profile-name">
            <div><div className="cp-label">Namn</div><strong>{name}</strong></div>
            <button className="cp-btn cp-btn-ghost" type="button" ref={editRef} onClick={beginEdit}>
              Ändra
            </button>
          </div>
        )}
        <section className="cp-card cp-verified-contact" aria-label="Verifierad kontakt">
          <div className="cp-label">Verifierad kontakt</div>
          <ContactRow contact={{ ...verifiedContact, verified: true }} />
          {secondaryContact && <ContactRow contact={secondaryContact} />}
          <div className="cp-contact-actions">
            {contactChangeActions.includes('change_phone') && (
              <button className="cp-btn" type="button" ref={changePhoneRef} onClick={() => setContactAction('change_phone')}>
                Byt telefonnummer
              </button>
            )}
            {contactChangeActions.includes('add_phone') && (
              <button className="cp-btn" type="button" ref={addPhoneRef} onClick={() => setContactAction('add_phone')}>
                Lägg till mobilnummer
              </button>
            )}
            {contactChangeActions.includes('change_email') && (
              <button className="cp-btn" type="button" ref={changeEmailRef} onClick={() => setContactAction('change_email')}>
                Byt e-post
              </button>
            )}
          </div>
        </section>
      </section>
      <nav className="cp-profile-menu" aria-label="Profilmeny">
        <ul>
          <li>
            <a className="cp-menu-link" href="#uppgiftskort" onClick={focusCard}>
              <span className="cp-menu-copy"><MenuIcon kind="profile" />Mina uppgifter</span><Chevron />
            </a>
          </li>
          <li>
            <a className="cp-menu-link" href="/mina/sakerhet">
              <span className="cp-menu-copy"><MenuIcon kind="security" />Säkerhet och enheter</span><Chevron />
            </a>
          </li>
          <li>
            <a className="cp-menu-link" href="/mina/installera">
              <span className="cp-menu-copy"><MenuIcon kind="install" />Installera på hemskärmen</span><Chevron />
            </a>
          </li>
          <li>
            <PortalLogoutTrigger className="cp-menu-link cp-negative">
              <span className="cp-menu-copy"><MenuIcon kind="logout" />Logga ut</span><Chevron />
            </PortalLogoutTrigger>
          </li>
        </ul>
      </nav>
      {saved && (
        <p
          className="cp-toast"
          role="status"
          aria-live="polite"
          tabIndex={0}
          onMouseOver={pauseToast}
          onMouseOut={resumeToast}
          onFocus={pauseToast}
          onBlur={resumeToast}
        >
          Namnet är sparat.
        </p>
      )}
      {contactAction && (
        <ContactChangeFlow
          action={contactAction}
          tenantName={tenantName}
          currentContact={verifiedContact}
          support={{ href: '/hjalp', label: 'Hjälp' }}
          triggerRef={contactActionRef}
          onClose={() => setContactAction(null)}
        />
      )}
    </section>
  )
}

function ContactRow({
  contact,
}: {
  contact: PortalVerifiedContact & { verified: true } | PortalSecondaryContact
}) {
  return (
    <div className="cp-row cp-between cp-contact-row">
      <div className="cp-contact-copy">
        <ContactIcon channel={contact.channel} />
        <div>
          <strong>{contact.channel === 'sms' ? 'SMS' : 'E-post'}</strong>
          <div className="cp-mono">{contact.maskedDestination}</div>
        </div>
      </div>
      <span className={`cp-pill${contact.verified ? ' cp-positive' : ''}`}>
        {contact.verified && (
          <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m3 8 3 3 7-7" />
          </svg>
        )}
        {contact.verified ? 'Verifierad' : 'Inte verifierad'}
      </span>
    </div>
  )
}

export function CustomerProfileUnavailable({ logoutAvailable }: { logoutAvailable: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <section className="cp-screen cp-profile-screen">
      <h1>Profil</h1>
      <section className="cp-card" id="uppgiftskort" tabIndex={-1}>
        <p>Uppgifterna kunde inte hämtas</p>
        <button
          className="cp-btn"
          type="button"
          aria-disabled={pending ? 'true' : undefined}
          onClick={() => {
            if (!pending) startTransition(() => router.refresh())
          }}
        >
          {pending ? 'Hämtar…' : 'Försök igen'}
        </button>
      </section>
      <nav className="cp-profile-menu" aria-label="Profilmeny">
        <ul>
          <li>
            <a className="cp-menu-link" href="/mina/profil">
              <span className="cp-menu-copy"><MenuIcon kind="profile" />Mina uppgifter</span><Chevron />
            </a>
          </li>
          <li>
            <a className="cp-menu-link" href="/mina/sakerhet">
              <span className="cp-menu-copy"><MenuIcon kind="security" />Säkerhet och enheter</span><Chevron />
            </a>
          </li>
          <li>
            <a className="cp-menu-link" href="/mina/installera">
              <span className="cp-menu-copy"><MenuIcon kind="install" />Installera på hemskärmen</span><Chevron />
            </a>
          </li>
          {logoutAvailable && (
            <li>
              <PortalLogoutTrigger className="cp-menu-link cp-negative">
                <span className="cp-menu-copy"><MenuIcon kind="logout" />Logga ut</span><Chevron />
              </PortalLogoutTrigger>
            </li>
          )}
        </ul>
      </nav>
    </section>
  )
}
