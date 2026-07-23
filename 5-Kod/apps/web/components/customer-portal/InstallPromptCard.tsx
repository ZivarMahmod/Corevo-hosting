'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

type InstallEnvironment =
  | 'checking'
  | 'standalone'
  | 'in_app'
  | 'ios_safari'
  | 'chromium'
  | 'unsupported'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type OfferNumber = 'first' | 'second'

const OFFER_KEY = 'corevo.portal.installOffer.v1'
const VISIT_KEY = 'corevo.portal.installOffer.visit.v1'

function isStandalone(): boolean {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true
}

function detectEnvironment(): InstallEnvironment {
  if (isStandalone()) return 'standalone'

  const ua = navigator.userAgent
  if (/(FBAN|FBAV|Instagram|Messenger|Line\/|LinkedInApp)/i.test(ua)) return 'in_app'

  const iosNavigator = navigator as Navigator & { maxTouchPoints?: number }
  const ios = /iPad|iPhone|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && (iosNavigator.maxTouchPoints ?? 0) > 1)
  if (ios && /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua)) {
    return 'ios_safari'
  }

  return /(Chrome|CriOS|Chromium|EdgA|SamsungBrowser)/i.test(ua)
    ? 'chromium'
    : 'unsupported'
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Ingen kund-, boknings- eller sessionsdata lagras i PWA-maskinen. Om
    // webbläsaren blockerar lagring fortsätter den manuella sidan att fungera.
  }
}

export function InstallPromptCard({ placement }: { placement: 'auto' | 'page' }) {
  const [environment, setEnvironment] = useState<InstallEnvironment>('checking')
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showAuto, setShowAuto] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [online, setOnline] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const offerNumber = useRef<OfferNumber | null>(null)
  const iosButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setEnvironment('chromium')
    }
    const onInstalled = () => {
      writeStorage(window.localStorage, OFFER_KEY, 'accepted')
      writeStorage(window.sessionStorage, VISIT_KEY, 'hidden')
      setShowAuto(false)
      setEnvironment('standalone')
    }

    updateOnline()
    setEnvironment(detectEnvironment())
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (placement !== 'auto' || environment === 'checking' ||
      environment === 'standalone' || environment === 'unsupported') return

    const visit = readStorage(window.sessionStorage, VISIT_KEY)
    if (visit === 'hidden') return
    if (visit === 'first' || visit === 'second') {
      offerNumber.current = visit
      setShowAuto(true)
      return
    }

    const stored = readStorage(window.localStorage, OFFER_KEY)
    if (stored === 'accepted' || stored === 'dismissed_twice' || stored === 'prompted_twice') {
      return
    }

    const next: OfferNumber =
      stored === 'prompted_once' || stored === 'dismissed_once' ? 'second' : 'first'
    offerNumber.current = next
    writeStorage(window.localStorage, OFFER_KEY, next === 'first' ? 'prompted_once' : 'prompted_twice')
    writeStorage(window.sessionStorage, VISIT_KEY, next)
    setShowAuto(true)
  }, [environment, placement])

  function dismissAuto() {
    writeStorage(
      window.localStorage,
      OFFER_KEY,
      offerNumber.current === 'second' ? 'dismissed_twice' : 'dismissed_once',
    )
    writeStorage(window.sessionStorage, VISIT_KEY, 'hidden')
    setShowAuto(false)
  }

  async function requestInstall() {
    if (!installEvent || !online) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === 'accepted') {
      writeStorage(window.localStorage, OFFER_KEY, 'accepted')
      writeStorage(window.sessionStorage, VISIT_KEY, 'hidden')
      if (placement === 'auto') setShowAuto(false)
      else setEnvironment('standalone')
      return
    }
    if (placement === 'auto') dismissAuto()
  }

  async function copyPortalLink() {
    const portalUrl = `${window.location.origin}/mina`
    try {
      await navigator.clipboard.writeText(portalUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function closeIosGuide() {
    setShowIosGuide(false)
    window.requestAnimationFrame(() => iosButton.current?.focus())
  }

  if (environment === 'checking') return null
  if (placement === 'auto' && (!showAuto || environment === 'standalone' ||
    environment === 'unsupported')) return null

  if (placement === 'page' && !online) {
    return (
      <section className="cp-card cp-error cp-install-offline">
        <p>Du är offline. Anslut till internet för att se aktuella bokningar.</p>
        <button className="cp-btn" type="button" onClick={() => window.location.reload()}>
          Försök igen
        </button>
      </section>
    )
  }

  if (placement === 'page' && environment === 'standalone') {
    return (
      <section className="cp-card cp-install-state" role="status">
        <span aria-hidden="true">✓</span>
        <p>Appen är installerad.</p>
      </section>
    )
  }

  if (placement === 'page' && environment === 'unsupported') {
    return (
      <section className="cp-card cp-install-state">
        <p>Din webbläsare stöder inte installation.</p>
      </section>
    )
  }

  const headingId = placement === 'auto' ? 'installera' : 'installera-kort'
  const inApp = environment === 'in_app'
  const ios = environment === 'ios_safari'

  return (
    <>
      <section className="cp-card cp-install-card" aria-labelledby={headingId}>
        <div className="cp-install-heading">
          <Image
            className="cp-install-icon"
            src="/pwa/customer-portal-icon-192.png"
            width={192}
            height={192}
            alt=""
            aria-hidden="true"
          />
          <div>
            <p className="cp-eyebrow">COREVO</p>
            <h2 id={headingId}>Ha dina bokningar nära till hands</h2>
          </div>
        </div>

        <p>
          {inApp
            ? 'Öppna sidan i Safari för att lägga till den på hemskärmen'
            : 'Snabb åtkomst till dina bokningar, direkt från hemskärmen.'}
        </p>

        {inApp && (
          <>
            <button className="cp-btn cp-btn-primary" type="button" onClick={copyPortalLink}>
              Kopiera länken
            </button>
            {copyState === 'copied' && (
              <p className="cp-install-success" role="status">Länken är kopierad</p>
            )}
            {copyState === 'failed' && (
              <div className="cp-install-copy-error" role="alert">
                <p>Länken kunde inte kopieras. Markera och kopiera adressen manuellt.</p>
                <code>{`${window.location.origin}/mina`}</code>
              </div>
            )}
            <ol className="cp-install-steps">
              <li>Kopiera länken.</li>
              <li>Öppna Safari.</li>
              <li>Klistra in länken i adressfältet.</li>
            </ol>
          </>
        )}

        {ios && placement === 'auto' && (
          <button
            className="cp-btn cp-btn-primary"
            type="button"
            ref={iosButton}
            onClick={() => setShowIosGuide(true)}
          >
            Visa hur
          </button>
        )}

        {ios && placement === 'page' && <IosInstallGuide inline />}

        {environment === 'chromium' && installEvent && (
          <>
            <button
              className="cp-btn cp-btn-primary"
              type="button"
              aria-disabled={!online ? 'true' : undefined}
              onClick={requestInstall}
            >
              Lägg på hemskärmen
            </button>
            {!online && <p className="cp-install-meta">Kräver internetanslutning.</p>}
          </>
        )}

        {environment === 'chromium' && !installEvent && (
          <a
            className="cp-btn"
            href={placement === 'auto'
              ? '/mina/installera'
              : 'https://support.google.com/chrome/answer/9658361?hl=sv'}
            {...(placement === 'page' ? { target: '_blank', rel: 'noopener' } : {})}
          >
            Så installerar du
          </a>
        )}

        {placement === 'auto' && (
          <button className="cp-btn cp-btn-ghost" type="button" onClick={dismissAuto}>
            Inte nu
          </button>
        )}
      </section>

      {showIosGuide && <IosInstallGuide inline={false} onClose={closeIosGuide} />}
    </>
  )
}

function IosInstallGuide({
  inline,
  onClose,
}: {
  inline: boolean
  onClose?: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (inline) return
    heading.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [inline, onClose])

  const guide = (
    <div className={`cp-install-guide${inline ? ' cp-install-guide-inline' : ''}`}>
      <h2 id={inline ? undefined : 'ios-install-title'} ref={heading} tabIndex={inline ? undefined : -1}>
        Så lägger du till på hemskärmen
      </h2>
      <ol className="cp-install-steps">
        <li>Tryck på Dela</li>
        <li>Välj Lägg till på hemskärmen</li>
        <li>Tryck på Lägg till</li>
      </ol>
      <p>Klart — Mina bokningar finns på hemskärmen.</p>
      {!inline && <button className="cp-btn" type="button" onClick={onClose}>Stäng</button>}
    </div>
  )

  if (inline) return guide
  return (
    <div className="cp-cancel-layer" role="presentation">
      <button className="cp-cancel-scrim" type="button" aria-label="Stäng" onClick={onClose} />
      <div className="cp-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
        <div className="cp-cancel-handle" aria-hidden="true" />
        {guide}
      </div>
    </div>
  )
}
