'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordReset, setTenantStatus } from '@/lib/platform/actions'
import { Button, Icon, useToast } from '@/components/portal/ui'
import styles from './tenant-detail.module.css'

/**
 * Header action buttons for the salong-detalj (law: SuperTenant.jsx head) — the
 * three top-right controls. Client because each fires a consequence-toast (§6) and
 * the reset wires the REAL sendPasswordReset server action.
 *
 * HONEST DATA: "Lösenordsreset" runs only when a salonsadmin e-post exists AND the
 * service role is configured — otherwise it toasts an honest reason instead of a
 * dead control / fake success. The old "Hjälp salongen"-stub (enterHelpMode — an
 * audit row and nothing else) is RETIRED (goal-54 §1): helping the customer now
 * happens for real in the module tabs (Webshop/Blogg/Offerter/Bildbibliotek) on
 * this very page, so a pretend "help mode" button would only mislead.
 */
export function TenantHeaderActions({
  tenantId,
  tenantName,
  storefrontUrl,
  salonAdminEmail,
  serviceRoleAvailable,
}: {
  tenantId: string
  tenantName: string
  storefrontUrl: string | null
  salonAdminEmail: string | null
  serviceRoleAvailable: boolean
}) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function resetPassword() {
    if (!salonAdminEmail) {
      notify('Ingen administratör inbjuden ännu — bjud in en ägare först.', 'warning')
      return
    }
    if (!serviceRoleAvailable) {
      notify('Lösenordsreset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).', 'warning')
      return
    }
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('email', salonAdminEmail)
    startTransition(async () => {
      const res = await sendPasswordReset({}, fd)
      if (res.error) notify(res.error, 'warning')
      else notify(`Återställningslänk skapad för ${salonAdminEmail}.`, 'success')
    })
  }

  return (
    <div className={styles.actions}>
      {storefrontUrl ? (
        <Button href={storefrontUrl} variant="ghost" icon="external">
          Öppna storefront
        </Button>
      ) : null}
      <Button
        variant="ghost"
        icon="mail"
        disabled={pending}
        onClick={resetPassword}
      >
        Lösenordsreset
      </Button>
    </div>
  )
}

/**
 * Riskzon-kort (law: SuperTenant.jsx Drift danger card) — Zivar-requested REAL
 * delete. "Ta bort salong" is a two-step soft-delete: setTenantStatus('deleted')
 * flips tenants.status only — the public storefront + admin are blocked while ALL
 * rows + history are kept (build-once-never-delete). A HARD row-deletion is still
 * permanently blocked by the audit-guard; this never issues a `.delete()`. On
 * success we leave the (now-deleted) detail page back to the list.
 */
export function TenantDangerCard({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const { notify } = useToast()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove() {
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('status', 'deleted')
    startTransition(async () => {
      const res = await setTenantStatus({}, fd)
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Kunden är borttagen.', 'success')
        router.push('/kunder')
      }
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="pbtn pbtn--md"
        style={{ background: 'var(--c-danger)', color: '#fff' }}
        onClick={() => setConfirming(true)}
      >
        <Icon name="trash" size={17} />
        Ta bort kund
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--c-ink)', flex: 1, minWidth: 200 }}>
        Ta bort <b>{tenantName}</b>? Mjuk borttagning — publik sajt + admin blockeras, data &amp; historik
        sparas.
      </span>
      <button type="button" className="pbtn pbtn--ghost pbtn--md" disabled={pending} onClick={() => setConfirming(false)}>
        Avbryt
      </button>
      <button
        type="button"
        className="pbtn pbtn--md"
        disabled={pending}
        style={{ background: 'var(--c-danger)', color: '#fff' }}
        onClick={remove}
      >
        <Icon name="trash" size={16} />
        {pending ? 'Tar bort…' : 'Bekräfta borttagning'}
      </button>
    </div>
  )
}
