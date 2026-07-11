'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveVerticalTerminology, saveVerticalDefaults } from '@/lib/platform/actions/verticals'
import type { ActionState } from '@/lib/platform/actions/shared'
import { MODULE_STATES } from '@/lib/tenant-modules'
import { Button, Card, useToast } from '@/components/portal/ui'

export type VerticalModuleRow = { key: string; name: string; state: string }

const THEMES = ['salvia', 'leander', 'zigge', 'linnea', 'edit'] // aldrig freshcut

const TERM_FIELDS: { key: string; label: string; ph: string }[] = [
  { key: 'staff', label: 'Personal (singular)', ph: 'Personal' },
  { key: 'staff_plural', label: 'Personal (plural)', ph: 'Personal' },
  { key: 'service', label: 'Tjänst (singular)', ph: 'Tjänst' },
  { key: 'service_plural', label: 'Tjänst (plural)', ph: 'Tjänster' },
  { key: 'unit', label: 'Resurs (t.ex. stol/bord)', ph: 'Resurs' },
  { key: 'unit_plural', label: 'Resurs (plural)', ph: 'Resurser' },
  { key: 'business', label: 'Verksamhetsord (t.ex. Salong/Restaurang)', ph: 'Salong' },
]

/**
 * Kundbildens skriv-UI (FAS 2 steg 3): terminologi (LIVE-ARV — slår direkt på
 * alla kunder i branschen) + modul-förval/default-mall (KOPIA vid onboarding —
 * gäller bara nya kunder). Detta är ytan där modul-mot-bransch-genomgången bor:
 * "hur ska bokningen/webshoppen/bloggen bete sig för DENNA bransch".
 */
export function VerticalEditor({
  verticalKey,
  kundAntal,
  terminology,
  modules,
  defaultTemplate,
}: {
  verticalKey: string
  kundAntal: number
  terminology: Record<string, string>
  modules: VerticalModuleRow[]
  defaultTemplate: string | null
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [termState, termAction, termPending] = useActionState<ActionState, FormData>(
    saveVerticalTerminology,
    {},
  )
  const [defState, defAction, defPending] = useActionState<ActionState, FormData>(
    saveVerticalDefaults,
    {},
  )

  useEffect(() => {
    if (termState.success) {
      notify(termState.success, 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termState.success])
  useEffect(() => {
    if (defState.success) {
      notify(defState.success, 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defState.success])

  return (
    <>
      {/* Terminologi — live-arv */}
      <div style={{ marginTop: '1.75rem' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 700 }}>Terminologi</h2>
        <Card>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--c-warning)', fontWeight: 600 }}>
            ⚡ Live-arv: ändringar här slår DIREKT på {kundAntal}{' '}
            {kundAntal === 1 ? 'kund' : 'kunder'} i branschen. Tomt fält = standardordet.
          </p>
          <form action={termAction}>
            <input type="hidden" name="vertical" value={verticalKey} />
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {TERM_FIELDS.map((f) => (
                <label key={f.key} style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--c-ink-2)', fontWeight: 600 }}>
                  {f.label}
                  <input
                    name={`term_${f.key}`}
                    defaultValue={terminology[f.key] ?? ''}
                    placeholder={f.ph}
                    style={fieldStyle}
                  />
                </label>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Button variant="primary" type="submit" icon="check" size="sm" disabled={termPending}>
                {termPending ? 'Sparar…' : 'Spara terminologi'}
              </Button>
            </div>
            {termState.error ? (
              <p className="auth-error" role="alert" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
                {termState.error}
              </p>
            ) : null}
          </form>
        </Card>
      </div>

      {/* Modul-förval + default-mall — kopia vid onboarding */}
      <div style={{ marginTop: '1.75rem' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 700 }}>Modul-förval &amp; mall</h2>
        <Card>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--c-ink-3)' }}>
            Förvalen NYA kunder i branschen startar med — befintliga kunder behåller sina
            modulval. Bokningen är alltid minst live.
          </p>
          <form action={defAction}>
            <input type="hidden" name="vertical" value={verticalKey} />
            <div style={{ display: 'grid', gap: 10 }}>
              {modules.map((m) => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ width: 150, fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                  <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label={m.name}>
                    {MODULE_STATES.filter((s) => (m.key === 'booking' ? s === 'live' || s === 'paused' : true)).map(
                      (s) => (
                        <label
                          key={s}
                          style={{
                            fontSize: 12,
                            padding: '5px 11px',
                            borderRadius: 999,
                            border: '1px solid var(--c-line)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            gap: 5,
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="radio"
                            name={`mod_${m.key}`}
                            value={s}
                            defaultChecked={m.state === s}
                            style={{ accentColor: 'var(--c-forest)' }}
                          />
                          {s}
                        </label>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
            <label style={{ display: 'grid', gap: 5, marginTop: 16, fontSize: 12.5, color: 'var(--c-ink-2)', fontWeight: 600, maxWidth: 280 }}>
              Default-mall vid onboarding
              <select name="default_template" defaultValue={defaultTemplate ?? ''} style={fieldStyle}>
                <option value="">Ingen (väljs i wizarden)</option>
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ marginTop: 14 }}>
              <Button variant="primary" type="submit" icon="check" size="sm" disabled={defPending}>
                {defPending ? 'Sparar…' : 'Spara förval'}
              </Button>
            </div>
            {defState.error ? (
              <p className="auth-error" role="alert" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
                {defState.error}
              </p>
            ) : null}
          </form>
        </Card>
      </div>
    </>
  )
}

const fieldStyle = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13.5,
} as const
