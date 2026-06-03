'use client'

import { useTransition } from 'react'
import { sendPasswordReset } from '@/lib/platform/actions'
import { Button, Icon, useToast } from '@/components/portal/ui'
import styles from './tenant-detail.module.css'

/**
 * Header action buttons for the salong-detalj (law: SuperTenant.jsx head) — the
 * three top-right controls. Client because each fires a consequence-toast (§6) and
 * the reset wires the REAL sendPasswordReset server action.
 *
 * HONEST DATA: "Lösenordsreset" runs only when a salonsadmin e-post exists AND the
 * service role is configured — otherwise it toasts an honest reason instead of a
 * dead control / fake success. "Kopiera e-post" copies the real address.
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
  storefrontUrl: string
  salonAdminEmail: string | null
  serviceRoleAvailable: boolean
}) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  function resetPassword() {
    if (!salonAdminEmail) {
      notify('Ingen salongsadmin inbjuden ännu — bjud in en ägare först.', 'warning')
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
      <Button href={storefrontUrl} variant="ghost" icon="external">
        Öppna storefront
      </Button>
      <Button
        variant="ghost"
        icon="mail"
        disabled={pending}
        onClick={resetPassword}
      >
        Lösenordsreset
      </Button>
      <Button
        variant="primary"
        icon="shield"
        onClick={() => notify(`Hjälpläge för ${tenantName} — du agerar åt salongen. Allt loggas.`, 'info')}
      >
        Hjälp salongen
      </Button>
    </div>
  )
}

/**
 * Riskzon-kort (law: SuperTenant.jsx Drift danger card). Build-once-never-delete:
 * the "Försök radera tenant" button is DELIBERATELY a blocked consequence-toast,
 * NOT a real delete. It never wires setTenantStatus('deleted') — the mock semantics
 * + the project rule both say a protected row is never removed; suspend (in the
 * StatusControl above) is the real lever.
 */
export function TenantDangerCard() {
  const { notify } = useToast()
  return (
    <button
      type="button"
      className="pbtn pbtn--md"
      style={{
        background: 'var(--c-danger)',
        color: '#fff',
      }}
      onClick={() =>
        notify('Blockerad av audit-guard — skyddad rad raderas aldrig (build-once-never-delete).', 'warning')
      }
    >
      <Icon name="trash" size={17} />
      Försök radera tenant
    </button>
  )
}
