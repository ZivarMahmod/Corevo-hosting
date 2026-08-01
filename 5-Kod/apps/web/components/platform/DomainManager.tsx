'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addCustomDomain, verifyCustomDomain, removeCustomDomain } from '@/lib/platform/actions'
import type { TenantDomainRow } from '@/lib/platform/domains'
import type { DcvRecord } from '@/lib/cloudflare/custom-hostnames'
import { useToast } from '@/components/portal/ui'
import styles from './platform.module.css'
import { tenantStorefrontHost } from '@/lib/storefront-url'

const ARM_TIMEOUT_MS = 10_000

// goal-23 live DomänPanel (behind DOMAIN_PROVISIONING_ENABLED). Add a custom domain →
// Cloudflare for SaaS custom hostname → tenant_domains row → show DCV records the
// customer adds at their DNS provider → verify (poll CF) → status badge. Remove
// un-provisions both CF + the row. List state is managed locally (optimistic) and the
// server cache is refreshed after each mutation.

export function DomainManager({
  slug,
  tenantId,
  initialDomains,
}: {
  slug: string
  tenantId: string
  initialDomains: TenantDomainRow[]
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [domains, setDomains] = useState<TenantDomainRow[]>(initialDomains)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  // DCV records to show after an add (or a still-pending verify), keyed by domain.
  const [dcv, setDcv] = useState<{ domain: string; records: DcvRecord[] } | null>(null)
  // Tvåstegsbekräftelse (samma mönster som ServicesManager/StaffRoster): "Ta bort"
  // raderade tidigare på ETT klick — och att ta bort en domän tar ner kundens LIVE-sajt
  // (DNS/cert går inte att ångra i appen). Klick 1 armerar RADEN (knappen blir "Säker?
  // Ta bort permanent" + en Ångra), klick 2 kör removeCustomDomain. Armeringen är keyad
  // på domänen så den aldrig kan läcka till en annan rad.
  const [armed, setArmed] = useState<string | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const triggerButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const restoreTriggerFocusRef = useRef<string | null>(null)

  useEffect(() => {
    if (armed) {
      confirmButtonRef.current?.focus()
    } else if (restoreTriggerFocusRef.current) {
      const domain = restoreTriggerFocusRef.current
      restoreTriggerFocusRef.current = null
      triggerButtonRefs.current.get(domain)?.focus()
    }
  }, [armed])

  useEffect(() => {
    restoreTriggerFocusRef.current = null
    setArmed(null)
  }, [tenantId])

  useEffect(() => {
    if (!armed || pending) return
    const armedDomain = armed
    const timeoutId = setTimeout(() => {
      restoreTriggerFocusRef.current = armedDomain
      setArmed(null)
    }, ARM_TIMEOUT_MS)
    return () => clearTimeout(timeoutId)
  }, [armed, pending])

  function disarmAndRestoreFocus() {
    restoreTriggerFocusRef.current = armed
    setArmed(null)
  }

  function fd(domain: string): FormData {
    const f = new FormData()
    f.set('tenantId', tenantId)
    f.set('domain', domain)
    return f
  }

  function add() {
    if (pending) return
    restoreTriggerFocusRef.current = null
    setArmed(null)
    const domain = input.trim()
    if (!domain) {
      setError('Ange en domän.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await addCustomDomain({}, fd(domain))
      if (res.error) {
        setError(res.error)
        notify(res.error, 'warning')
        return
      }
      if (res.hostname) {
        setDomains((d) => [
          { id: `tmp-${res.hostname!.domain}`, domain: res.hostname!.domain, verified: false, isPrimary: false, createdAt: new Date().toISOString() },
          ...d.filter((x) => x.domain !== res.hostname!.domain),
        ])
        setDcv({ domain: res.hostname.domain, records: res.hostname.dcv })
      }
      setInput('')
      notify(res.success ?? 'Domän tillagd.', 'success')
      router.refresh()
    })
  }

  function verify(domain: string) {
    if (pending) return
    restoreTriggerFocusRef.current = null
    setArmed(null)
    startTransition(async () => {
      const res = await verifyCustomDomain({}, fd(domain))
      if (res.error) {
        notify(res.error, 'warning')
        return
      }
      // Key the badge on the SERVER's verified flag (the DB flip), not raw CF status —
      // CF status='active' with SSL still pending does NOT verify, and the server says so.
      const verified = res.verified === true
      if (verified) {
        setDomains((d) => d.map((x) => (x.domain === domain ? { ...x, verified: true } : x)))
        setDcv((cur) => (cur?.domain === domain ? null : cur))
      } else if (res.hostname) {
        setDcv({ domain, records: res.hostname.dcv })
      }
      notify(res.success ?? 'Status uppdaterad.', verified ? 'success' : 'info')
      router.refresh()
    })
  }

  function remove(domain: string) {
    if (pending) return
    startTransition(async () => {
      const res = await removeCustomDomain({}, fd(domain))
      if (res.error) {
        // Raden lever kvar → avväpna den, annars står en skarp knapp kvar och väntar.
        restoreTriggerFocusRef.current = null
        setArmed(null)
        notify(res.error, 'warning')
        return
      }
      restoreTriggerFocusRef.current = null
      setArmed(null)
      setDomains((d) => d.filter((x) => x.domain !== domain))
      setDcv((cur) => (cur?.domain === domain ? null : cur))
      notify(res.success ?? 'Domän borttagen.', 'success')
      router.refresh()
    })
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed && !pending) {
          event.preventDefault()
          disarmAndRestoreFocus()
        }
      }}
    >
      <p className={styles.muted} style={{ marginTop: 0 }}>
        Standardadressen är <code className={styles.code}>{tenantStorefrontHost(slug)}</code>. Lägg till kundens egna
        domän — den provisioneras som custom hostname och blir live när DNS-posterna är på plats.
      </p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className={styles.field}>
          <span>Kundens domän</span>
          <input
            name="domain"
            placeholder="boka.exempel.se"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            autoCapitalize="none"
          />
        </label>
        {error && (
          <p className={styles.muted} role="alert" style={{ color: 'var(--c-danger, #b42318)', margin: 0 }}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={pending || !input.trim()}>
            {pending ? 'Arbetar…' : 'Lägg till domän'}
          </button>
        </div>
      </form>

      {dcv && dcv.records.length > 0 && (
        <div className={styles.dcvBox}>
          <p className={styles.dcvTitle}>DNS-poster för {dcv.domain} (sätts hos kundens DNS-leverantör)</p>
          <ul className={styles.dcvList}>
            {dcv.records.map((r, i) => (
              <li key={i} className={styles.dcvRow}>
                <span className={styles.dcvType}>{r.type}</span>
                <span className={styles.dcvPurpose}>{r.purpose}</span>
                <code className={styles.code}>{r.name}</code>
                <span className={styles.muted}>→</span>
                <code className={styles.code}>{r.value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {domains.length > 0 && (
        <ul className={styles.domainList}>
          {domains.map((d) => (
            <li key={d.id} className={styles.domainRow}>
              <code className={styles.code}>{d.domain}</code>
              <span className={d.verified ? styles.pillOk : styles.pillPending}>
                {d.verified ? 'Verifierad' : 'Väntar'}
              </span>
              <span style={{ flex: 1 }} />
              {!d.verified && armed !== d.domain && (
                <button type="button" className={styles.btnSubtle} disabled={pending} onClick={() => verify(d.domain)}>
                  Verifiera
                </button>
              )}
              {armed === d.domain ? (
                <>
                  <span
                    id={`remove-domain-warning-${d.id}`}
                    className={styles.armWarning}
                    role="status"
                    aria-live="polite"
                  >
                    Den egna domänen slutar fungera direkt och måste läggas till igen för att återställas.
                  </span>
                  <button
                    ref={confirmButtonRef}
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    disabled={pending}
                    aria-describedby={`remove-domain-warning-${d.id}`}
                    onClick={() => remove(d.domain)}
                  >
                    {pending ? '…' : 'Säker? Ta bort permanent'}
                  </button>
                  <button type="button" className={styles.btn} disabled={pending} onClick={disarmAndRestoreFocus}>
                    Ångra
                  </button>
                </>
              ) : (
                <button
                  ref={(node) => {
                    if (node) triggerButtonRefs.current.set(d.domain, node)
                    else triggerButtonRefs.current.delete(d.domain)
                  }}
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={pending}
                  onClick={() => {
                    restoreTriggerFocusRef.current = null
                    setArmed(d.domain)
                  }}
                >
                  Ta bort
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
