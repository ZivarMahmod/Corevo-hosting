'use client'

import {
  type FormEvent,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  finalizePortalContactChangeAction,
  resendPortalContactChangeAction,
  startPortalContactChangeAction,
  submitPortalContactChangeDestinationAction,
  verifyPortalContactChangeCurrentAction,
} from '@/app/(customer-portal)/mina/actions'
import {
  maskBookingContact,
  normalizeBookingContact,
} from '@/lib/booking/contact-normalization'
import type {
  PortalContactChangeAction,
  PortalVerifiedContact,
} from '@/lib/customer-portal/types'
import { usePortalSessionExpiry } from './PortalSessionBoundary'

type Step = 1 | 2 | 3 | 4 | 5 | 'help' | 'expired'
type MaskedContact = { channel: 'sms' | 'email'; maskedDestination: string }
type Support = { href: '/hjalp'; label: 'Hjälp' }
type DeliveryState = 'sent' | 'resend_sent' | 'failed'

const GENERIC_ERROR = 'Något gick fel. Försök igen.'
const CONSEQUENCE = 'Dina andra inloggade enheter loggas ut och dina PIN-fria bokningsenheter återkallas.'

function pinError(outcome: string, attemptsRemaining?: number): string | null {
  if (outcome === 'invalid') return `Fel kod. Du har ${attemptsRemaining ?? 0} försök kvar.`
  if (outcome === 'expired') return 'Koden har gått ut. Begär en ny kod.'
  if (outcome === 'max_attempts') return 'För många försök. Begär en ny kod om 10 min.'
  if (outcome === 'delivery_failed') return 'Koden kunde inte skickas. Försök igen.'
  return null
}

function deliveryFailure(channel: MaskedContact['channel']): string {
  return channel === 'sms'
    ? 'SMS:et med koden kunde inte skickas. Försök igen eller ändra mobilnummer.'
    : 'Mejlet med koden kunde inte skickas. Försök igen eller ändra e-post.'
}

function stepTitle(step: Step): string {
  if (step === 1) return 'Bekräfta att det är du'
  if (step === 'help') return 'Kan du inte använda din nuvarande kontakt?'
  if (step === 'expired') return 'Sessionen för bytet har gått ut. Börja om.'
  if (step === 2 || step === 4) return 'Ange koden'
  if (step === 3) return 'Ny kontaktuppgift'
  return 'Klart'
}

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getAttribute('aria-disabled') !== 'true')
}

export function ContactChangeFlow({
  action,
  tenantName,
  currentContact,
  support,
  triggerRef,
  onClose,
  initialStep = 1,
  initialNewContact = null,
}: {
  action: PortalContactChangeAction
  tenantName: string
  currentContact: PortalVerifiedContact
  support: Support
  triggerRef: MutableRefObject<HTMLButtonElement | null>
  onClose: () => void
  initialStep?: 1 | 3 | 4
  initialNewContact?: MaskedContact | null
}) {
  const router = useRouter()
  const expireSession = usePortalSessionExpiry()
  const [step, setStep] = useState<Step>(initialStep)
  const [currentSent, setCurrentSent] = useState<MaskedContact>(currentContact)
  const [newContact, setNewContact] = useState<MaskedContact | null>(initialNewContact)
  const [destination, setDestination] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [deliveryState, setDeliveryState] = useState<DeliveryState>('sent')
  const [pinLocked, setPinLocked] = useState(false)
  const [resendBlocked, setResendBlocked] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setStep(initialStep)
    setCurrentSent(currentContact)
    setNewContact(initialNewContact)
    setDestination('')
    setCode('')
    setDeliveryState('sent')
    setError(null)
    setPinLocked(false)
    setResendBlocked(false)
    setCooldown(0)
  }, [action, currentContact, initialNewContact, initialStep])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1_000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 2 || step === 3 || step === 4) inputRef.current?.focus()
    else titleRef.current?.focus()
  }, [step])

  function close() {
    if (pendingRef.current) return
    onClose()
    queueMicrotask(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (pendingRef.current) return
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const candidates = focusables(dialogRef.current)
      if (candidates.length === 0) return
      const first = candidates[0]!
      const last = candidates.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  async function run<T>(work: () => Promise<T>): Promise<T | null> {
    if (pendingRef.current) return null
    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      return await work()
    } catch {
      setError(GENERIC_ERROR)
      return null
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  async function start() {
    const result = await run(() => startPortalContactChangeAction(action))
    if (!result) return
    if (result.outcome === 'expired') { expireSession(); return }
    if (result.outcome === 'sent') {
      setDeliveryState('sent')
      setCurrentSent({ channel: result.channel, maskedDestination: result.maskedDestination })
      setCode('')
      setPinLocked(false)
      setResendBlocked(false)
      setCooldown(30)
      setStep(2)
      return
    }
    if (result.outcome === 'cooldown') {
      setCooldown(result.retryAfterSeconds)
      setError(null)
      return
    }
    if (result.outcome === 'max_attempts') {
      setPinLocked(true)
      setResendBlocked(true)
      setError(`För många försök. Begär en ny kod om ${Math.ceil(result.retryAfterSeconds / 60)} min.`)
      return
    }
    if (result.outcome === 'delivery_failed') {
      setDeliveryState('failed')
      setCurrentSent(currentContact)
      setCode('')
      setPinLocked(true)
      setResendBlocked(false)
      setCooldown(30)
      setStep(2)
      setError(deliveryFailure(currentContact.channel))
      return
    }
    setError(GENERIC_ERROR)
  }

  async function verifyCurrent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError('Fel kod. Du har 5 försök kvar.'); return }
    const result = await run(() => verifyPortalContactChangeCurrentAction(code))
    if (!result) return
    if (result.outcome === 'verified') {
      setCode(''); setStep(3); return
    }
    if (result.outcome === 'step_up_expired') { setStep('expired'); return }
    if (result.outcome === 'expired') {
      setPinLocked(true)
      setError('Koden har gått ut. Begär en ny kod.'); return
    }
    if (result.outcome === 'max_attempts') { setPinLocked(true); setResendBlocked(true) }
    const message = pinError(result.outcome, 'attemptsRemaining' in result ? result.attemptsRemaining : undefined)
    setError(message ?? GENERIC_ERROR)
    queueMicrotask(() => inputRef.current?.focus())
  }

  async function sendNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const channel = action === 'change_email' ? 'email' : 'sms'
    const normalized = normalizeBookingContact(channel, destination)
    if (!normalized) {
      setError(channel === 'sms' ? 'Ange ett giltigt mobilnummer.' : 'Ange en giltig e-postadress.')
      inputRef.current?.focus()
      return
    }
    const result = await run(() => submitPortalContactChangeDestinationAction(destination))
    if (!result) return
    if (result.outcome === 'expired') { expireSession(); return }
    if (result.outcome === 'step_up_expired') { setStep('expired'); return }
    if (result.outcome === 'sent') {
      setDeliveryState('sent')
      setNewContact({ channel: result.channel, maskedDestination: result.maskedDestination })
      setDestination('')
      setCode('')
      setPinLocked(false)
      setResendBlocked(false)
      setCooldown(30)
      setStep(4)
      return
    }
    if (result.outcome === 'same' || result.outcome === 'conflict') {
      setError(action === 'change_email'
        ? `Uppgiften kan inte användas. Kontakta ${tenantName}.`
        : `Numret används redan. Kontakta ${tenantName} så hjälper de dig.`)
      return
    }
    if (result.outcome === 'delivery_failed') {
      setDeliveryState('failed')
      setNewContact({ channel, maskedDestination: maskBookingContact(channel, normalized) })
      setDestination('')
      setCode('')
      setPinLocked(true)
      setResendBlocked(false)
      setCooldown(30)
      setStep(4)
      setError(deliveryFailure(channel))
      return
    }
    setError(result.outcome === 'invalid'
      ? (action === 'change_email' ? 'Ange en giltig e-postadress.' : 'Ange ett giltigt mobilnummer.')
      : GENERIC_ERROR)
  }

  async function finalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError('Fel kod. Du har 5 försök kvar.'); return }
    const result = await run(() => finalizePortalContactChangeAction(code))
    if (!result) return
    if (result.outcome === 'success') { setCode(''); setStep(5); return }
    if (result.outcome === 'step_up_expired') { setStep('expired'); return }
    if (result.outcome === 'expired') {
      setPinLocked(true)
      setError('Koden har gått ut. Begär en ny kod.'); return
    }
    if (result.outcome === 'conflict') {
      setError(action === 'change_email'
        ? `Uppgiften kan inte användas. Kontakta ${tenantName}.`
        : `Numret används redan. Kontakta ${tenantName} så hjälper de dig.`)
      return
    }
    if (result.outcome === 'max_attempts') { setPinLocked(true); setResendBlocked(true) }
    setError(pinError(result.outcome, 'attemptsRemaining' in result ? result.attemptsRemaining : undefined) ?? GENERIC_ERROR)
    queueMicrotask(() => inputRef.current?.focus())
  }

  async function resend(stage: 'current' | 'new') {
    const result = await run(() => resendPortalContactChangeAction(stage))
    if (!result) return
    if (result.outcome === 'expired') { expireSession(); return }
    if (result.outcome === 'step_up_expired') { setStep('expired'); return }
    if (result.outcome === 'sent') {
      setDeliveryState('resend_sent')
      const contact = { channel: result.channel, maskedDestination: result.maskedDestination }
      if (stage === 'current') setCurrentSent(contact)
      else setNewContact(contact)
      setCode('')
      setPinLocked(false)
      setResendBlocked(false)
      setCooldown(30)
      queueMicrotask(() => inputRef.current?.focus())
      return
    }
    if (result.outcome === 'cooldown') {
      setCooldown(result.retryAfterSeconds)
      setError(null)
      return
    }
    if (result.outcome === 'max_attempts') {
      setPinLocked(true)
      setResendBlocked(true)
      setError(`För många försök. Begär en ny kod om ${Math.ceil(result.retryAfterSeconds / 60)} min.`)
      return
    }
    if (result.outcome === 'delivery_failed') {
      const failedContact = stage === 'current' ? currentSent : newContact
      setDeliveryState('failed')
      setPinLocked(true)
      setResendBlocked(false)
      setCooldown(30)
      setError(deliveryFailure(failedContact?.channel ?? 'sms'))
      return
    }
    setError(GENERIC_ERROR)
  }

  function restart() {
    if (pendingRef.current) return
    setStep(1); setCode(''); setDestination(''); setNewContact(null); setDeliveryState('sent'); setError(null); setPinLocked(false); setResendBlocked(false); setCooldown(0)
  }

  function closeReceipt() {
    onClose()
    router.refresh()
    queueMicrotask(() => triggerRef.current?.focus())
  }

  const describedBy = step === 1 ? 'contact-change-description contact-change-why' : undefined
  return (
    <div className="cp-contact-change-layer">
      <div className="cp-contact-change-scrim" aria-hidden="true" />
      <div
        className="cp-contact-change-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-change-title"
        aria-describedby={describedBy}
        ref={dialogRef}
      >
        <div className="cp-contact-change-handle" aria-hidden="true" />
        {typeof step === 'number' && step <= 4 && <p className="cp-meta">Steg {step} av 4</p>}
        <h2 id="contact-change-title" tabIndex={-1} ref={titleRef}>{stepTitle(step)}</h2>

        {step === 1 && <>
          <p id="contact-change-description">Vi skickar en kod till din nuvarande kontakt {currentContact.maskedDestination}.</p>
          <p id="contact-change-why">Av säkerhetsskäl bekräftar du först din nuvarande kontaktuppgift och sedan den nya.</p>
          {error && <p className="cp-contact-change-error" role="alert">{error}</p>}
          <div className="cp-contact-change-actions">
            <button className="cp-btn cp-btn-primary" type="button" disabled={pinLocked} aria-disabled={pending || pinLocked || undefined} onClick={start}>
              {pending ? 'Skickar kod…' : 'Skicka kod'}
            </button>
            <button className="cp-btn cp-btn-ghost" type="button" aria-disabled={pending || undefined} onClick={() => !pendingRef.current && setStep('help')}>
              Jag kommer inte åt den här kontaktuppgiften
            </button>
          </div>
        </>}

        {step === 'help' && <>
          <p>Av säkerhetsskäl kan du inte byta kontaktuppgift själv utan kod till din nuvarande kontakt. Kontakta {tenantName} för manuell kontroll.</p>
          <div className="cp-contact-change-actions">
            <a className="cp-btn cp-btn-primary" href={support.href}>{support.label}</a>
            <button className="cp-btn" type="button" onClick={() => setStep(1)}>Tillbaka</button>
          </div>
        </>}

        {step === 2 && <form className="cp-stack" noValidate onSubmit={verifyCurrent}>
          {deliveryState !== 'failed' && <p className="cp-contact-change-channel" aria-live="polite">
            {deliveryState === 'resend_sent'
              ? 'En ny kod har skickats.'
              : <>Vi har skickat en kod via {currentSent.channel === 'sms' ? 'SMS' : 'e-post'} till {currentSent.maskedDestination}</>}
          </p>}
          <label className="cp-field" htmlFor="contact-current-pin"><span>Engångskod</span>
            <input id="contact-current-pin" className="cp-mono cp-code-input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code} disabled={pending || pinLocked} ref={inputRef} onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          {error && <p className="cp-contact-change-error" role="alert">{error}</p>}
          <button className="cp-btn cp-btn-primary" type="submit" disabled={pinLocked} aria-disabled={pending || pinLocked || undefined}>{pending ? 'Verifierar…' : 'Verifiera'}</button>
          {!resendBlocked && <button className="cp-btn" type="button" disabled={pending || cooldown > 0} aria-disabled={pending || cooldown > 0 || undefined} aria-live="polite" onClick={() => resend('current')}>
            {cooldown > 0 ? `Skicka ny kod om [00:${String(cooldown).padStart(2, '0')}]` : 'Skicka ny kod'}
          </button>}
        </form>}

        {step === 3 && <form className="cp-stack" noValidate onSubmit={sendNew}>
          {action !== 'change_email' && <label className="cp-field" htmlFor="contact-country"><span>Landskod</span><select id="contact-country" value="+46" disabled><option>+46</option></select></label>}
          <label className="cp-field" htmlFor="contact-destination">
            <span>{action === 'change_email' ? 'Ny e-postadress' : 'Nytt mobilnummer'}</span>
            <input id="contact-destination" name="destination" type={action === 'change_email' ? 'email' : 'tel'} inputMode={action === 'change_email' ? 'email' : 'tel'} autoComplete={action === 'change_email' ? 'email' : 'tel'} value={destination} disabled={pending} ref={inputRef} onInput={(e) => setDestination(e.currentTarget.value)} />
          </label>
          <p className="cp-contact-change-consequence">{CONSEQUENCE}</p>
          {error && <p className="cp-contact-change-error" role="alert">{error}</p>}
          <button className="cp-btn cp-btn-primary" type="submit" aria-disabled={pending || undefined}>{pending ? 'Skickar kod…' : 'Skicka kod'}</button>
        </form>}

        {step === 4 && newContact && <form className="cp-stack" noValidate onSubmit={finalize}>
          {deliveryState !== 'failed' && <p className="cp-contact-change-channel" aria-live="polite">
            {deliveryState === 'resend_sent'
              ? 'En ny kod har skickats.'
              : <>Vi har skickat en kod via {newContact.channel === 'sms' ? 'SMS' : 'e-post'} till {newContact.maskedDestination}</>}
          </p>}
          <label className="cp-field" htmlFor="contact-new-pin"><span>Engångskod</span>
            <input id="contact-new-pin" className="cp-mono cp-code-input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code} disabled={pending || pinLocked} ref={inputRef} onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          {error && <p className="cp-contact-change-error" role="alert">{error}</p>}
          <button className="cp-btn cp-btn-primary" type="submit" disabled={pinLocked} aria-disabled={pending || pinLocked || undefined}>{pending ? 'Verifierar…' : 'Verifiera'}</button>
          {!resendBlocked && <button className="cp-btn" type="button" disabled={pending || cooldown > 0} aria-disabled={pending || cooldown > 0 || undefined} aria-live="polite" onClick={() => resend('new')}>
            {cooldown > 0 ? `Skicka ny kod om [00:${String(cooldown).padStart(2, '0')}]` : 'Skicka ny kod'}
          </button>}
        </form>}

        {step === 'expired' && <button className="cp-btn cp-btn-primary" type="button" onClick={restart}>Börja om</button>}

        {step === 5 && <>
          <p className="cp-contact-change-success" role="status">
            <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
            {action === 'change_phone' ? 'Telefonnumret är ändrat.' : action === 'add_phone' ? 'Mobilnumret är tillagt.' : 'Kontaktuppgiften är bytt.'}
          </p>
          <p className="cp-contact-change-consequence">{CONSEQUENCE}</p>
          <button className="cp-btn cp-btn-primary" type="button" onClick={closeReceipt}>Stäng</button>
        </>}

        {typeof step === 'number' && step <= 4 && (
          <button className="cp-btn cp-contact-change-cancel" type="button" aria-disabled={pending || undefined} onClick={close}>Avbryt</button>
        )}
      </div>
    </div>
  )
}
