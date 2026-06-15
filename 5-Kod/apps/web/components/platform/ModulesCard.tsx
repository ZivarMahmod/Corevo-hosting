'use client'

import { useActionState } from 'react'
import { setModuleState, type ActionState, type TenantModuleRow } from '@/lib/platform/tenant-modules-admin'
import { MODULE_STATES, type ModuleState } from '@/lib/tenant-modules'
import { Badge, type BadgeTone } from '@/components/portal/ui'
import styles from './platform.module.css'

// Moduler-kort (multi-bransch spår 5) — super-admins per-modul livscykel-kontroll för
// EN vald salong. Listar varje katalog-modul med state-badge + activated_at; en
// state-väljare (off/draft/live/paused) per modul. Moduler salongen SAKNAR (ingen rad)
// visar "Aktivera" (off→draft) i stället för väljaren. Skriver via setModuleState
// (platform-kontext → DB:ns state-vakt släpper igenom off→draft).
//
// Samma form-mönster som BillingForm/StatusControl: useActionState + styles.field/
// actions, btn-primary, feedback-spans. Varje rad är sin egen <form> (oberoende byten)
// i den befintliga .domainRow-flexen (vänster info + höger åtgärd), som DomänPanel.

const STATE_LABEL: Record<ModuleState, string> = {
  off: 'Av',
  draft: 'Utkast',
  live: 'Live',
  paused: 'Pausad',
}

const STATE_TONE: Record<ModuleState, BadgeTone> = {
  off: 'neutral',
  draft: 'warning',
  live: 'success',
  paused: 'info',
}

function formatActivated(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso))
}

function ModuleRow({ tenantId, module }: { tenantId: string; module: TenantModuleRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setModuleState, {})

  return (
    <form action={formAction} className={styles.domainRow}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="moduleKey" value={module.moduleKey} />

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          {module.name}
          <Badge tone={STATE_TONE[module.state]}>{STATE_LABEL[module.state]}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <code className={styles.code}>{module.moduleKey}</code>
          <span>{module.hasRow ? `· aktiverad ${formatActivated(module.activatedAt)}` : '· inte aktiverad'}</span>
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
        {module.hasRow ? (
          <>
            <label className={styles.field} style={{ minWidth: 130 }}>
              <select name="state" defaultValue={module.state} aria-label={`Läge för ${module.name}`}>
                {MODULE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {STATE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Sparar…' : 'Spara'}
            </button>
          </>
        ) : (
          <>
            {/* Aktivering = off→draft (super-admin only, hård i DB). Knappen skickar
                state='draft' så raden skapas; därefter visas väljaren. */}
            <input type="hidden" name="state" value="draft" />
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Aktiverar…' : 'Aktivera'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}

export function ModulesCard({ tenantId, modules }: { tenantId: string; modules: TenantModuleRow[] }) {
  if (modules.length === 0) {
    return (
      <p className={styles.empty}>
        Inga moduler i katalogen ännu — seedas via migration (booking, media_library).
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
