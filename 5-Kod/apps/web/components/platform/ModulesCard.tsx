'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { setModuleState, type ActionState, type TenantModuleRow } from '@/lib/platform/tenant-modules-admin'
import styles from './platform.module.css'

function ModuleRow({ tenantId, module }: { tenantId: string; module: TenantModuleRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setModuleState, {})
  const formRef = useRef<HTMLFormElement>(null)
  const visible = module.state === 'live'
  const [enabled, setEnabled] = useState(visible)

  useEffect(() => {
    setEnabled(visible)
  }, [visible, state.error])

  return (
    <form action={formAction} ref={formRef} className={styles.domainRow}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="moduleKey" value={module.moduleKey} />
      <input type="hidden" name="binary" value="true" />

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          {module.name}
          <span className={`ppill ${enabled ? 'ppill--on' : 'ppill--off'}`}>
            {enabled ? 'På' : 'Av'}
          </span>
        </div>
        {state.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {state.success}
          </span>
        ) : null}
      </div>

      <div className={styles.actions}>
        <input
          className="pswitch"
          type="checkbox"
          name="enabled"
          value="true"
          checked={enabled}
          disabled={pending}
          onChange={(event) => {
            setEnabled(event.target.checked)
            formRef.current?.requestSubmit()
          }}
          aria-label={`${module.name}: ${enabled ? 'på' : 'av'}`}
        />
      </div>
    </form>
  )
}

export function ModulesCard({ tenantId, modules }: { tenantId: string; modules: TenantModuleRow[] }) {
  if (modules.length === 0) {
    return (
      <p className={styles.empty}>
        Modulkatalogen är tom. Kontrollera plattformsinställningarna.
      </p>
    )
  }
  return (
    <div className={styles.domainList}>
      {modules.map((m) => (
        <ModuleRow key={m.moduleKey} tenantId={tenantId} module={m} />
      ))}
    </div>
  )
}
