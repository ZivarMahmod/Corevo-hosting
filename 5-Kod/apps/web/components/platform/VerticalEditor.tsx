'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveVerticalTerminology, saveVerticalDefaults, saveVerticalCopy } from '@/lib/platform/actions/verticals'
import type { ActionState } from '@/lib/platform/actions/shared'
import { MODULE_STATES } from '@/lib/tenant-modules'
import { SELECTABLE_THEMES } from '@/lib/platform/theme-palettes'
import { Button, Card, useToast } from '@/components/portal/ui'

export type VerticalModuleRow = { key: string; name: string; state: string }

// Branschens standardmall väljs bland ALLA byggda mallar (aldrig freshcut — kundens
// eget tema). Härleds ur THEME_PALETTES så florist-sviten (goal-58) dyker upp här
// automatiskt; en literal-lista här hade tyst gömt 13 mallar för branscherna.
const THEMES = SELECTABLE_THEMES.map((p) => p.key)

const TERM_FIELDS: { key: string; label: string; ph: string }[] = [
  { key: 'staff', label: 'Personal (singular)', ph: 'Personal' },
  { key: 'staff_plural', label: 'Personal (plural)', ph: 'Personal' },
  { key: 'service', label: 'Tjänst (singular)', ph: 'Tjänst' },
  { key: 'service_plural', label: 'Tjänst (plural)', ph: 'Tjänster' },
  { key: 'unit', label: 'Resurs (t.ex. stol/bord)', ph: 'Resurs' },
  { key: 'unit_plural', label: 'Resurs (plural)', ph: 'Resurser' },
  { key: 'business', label: 'Verksamhetsord (t.ex. Salong/Restaurang)', ph: 'Salong' },
  // goal-55 8A: navens huvud-CTA per bransch (båda krävs; tomt = 'Boka tid').
  { key: 'primary_cta_label', label: 'Huvud-CTA i naven (etikett)', ph: 'Boka tid' },
  { key: 'primary_cta_href', label: 'Huvud-CTA länk (börjar med /)', ph: '/boka' },
]

/**
 * Kundbildens skriv-UI (FAS 2 steg 3): terminologi (LIVE-ARV — slår direkt på
 * alla kunder i branschen) + modul-förval/default-mall (KOPIA vid onboarding —
 * gäller bara nya kunder). Detta är ytan där modul-mot-bransch-genomgången bor:
 * "hur ska bokningen/webshoppen/bloggen bete sig för DENNA bransch".
 */
// goal-57 körning 12: bransch-mall-textens redigerbara fält (subset av
// COPY_OVERRIDE_KEYS — mall-egna FreshCut-fält hör inte hemma på bransch-nivå).
const COPY_FIELDS: { key: string; label: string; rows?: number }[] = [
  { key: 'heroEyebrow', label: 'Hero: liten rubrik (eyebrow)' },
  { key: 'heroTitle', label: 'Hero: rubrik', rows: 2 },
  { key: 'heroLede', label: 'Hero: ingress', rows: 2 },
  { key: 'tagline', label: 'Sidfotens tagline' },
  { key: 'aboutTitle', label: 'Om: rubrik' },
  { key: 'aboutCopy', label: 'Om: brödtext', rows: 4 },
  { key: 'italic', label: 'Kursiv accentrad' },
  { key: 'servicesEyebrow', label: 'Tjänster: eyebrow' },
  { key: 'servicesTitle', label: 'Tjänster: rubrik' },
  { key: 'servicesIntro', label: 'Tjänster: intro-rad', rows: 2 },
  { key: 'teamEyebrow', label: 'Team: eyebrow' },
  { key: 'teamTitle', label: 'Team: rubrik' },
  { key: 'teamLead', label: 'Team: lead-rad', rows: 2 },
  { key: 'closingEyebrow', label: 'Avslutning: eyebrow' },
  { key: 'closingTitle', label: 'Avslutning: rubrik' },
  { key: 'closingLede', label: 'Avslutning: ingress', rows: 2 },
  { key: 'contactEyebrow', label: 'Kontakt: eyebrow' },
  { key: 'contactTitle', label: 'Kontakt: rubrik' },
]

export function VerticalEditor({
  verticalKey,
  kundAntal,
  terminology,
  modules,
  defaultTemplate,
  defaultCopy = {},
}: {
  verticalKey: string
  kundAntal: number
  terminology: Record<string, string>
  modules: VerticalModuleRow[]
  defaultTemplate: string | null
  /** verticals.default_copy — branschens editorial mall-text (goal-57 körning 12). */
  defaultCopy?: Record<string, string>
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
  const [copyState, copyAction, copyPending] = useActionState<ActionState, FormData>(
    saveVerticalCopy,
    {},
  )
  useEffect(() => {
    if (copyState.success) {
      notify(copyState.success, 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyState.success])

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

      {/* Bransch-mall-text — live-arv, fallback under kundens egna texter */}
      <div style={{ marginTop: '1.75rem' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 700 }}>Sidtext-mall</h2>
        <Card>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--c-ink-3)' }}>
            Branschens grundtexter — kunder som inte skrivit egen text ärver dessa (live, inom
            ~5 min). En kund som skrivit eget behåller alltid sitt. Tomt fält = mallens
            inbyggda standardtext.
          </p>
          <form action={copyAction}>
            <input type="hidden" name="vertical" value={verticalKey} />
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {COPY_FIELDS.map((f) => (
                <label key={f.key} style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--c-ink-2)', fontWeight: 600 }}>
                  {f.label}
                  {f.rows ? (
                    <textarea
                      name={`copy_${f.key}`}
                      defaultValue={defaultCopy[f.key] ?? ''}
                      rows={f.rows}
                      style={{ ...fieldStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input name={`copy_${f.key}`} defaultValue={defaultCopy[f.key] ?? ''} style={fieldStyle} />
                  )}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Button variant="primary" type="submit" icon="check" size="sm" disabled={copyPending}>
                {copyPending ? 'Sparar…' : 'Spara sidtext-mall'}
              </Button>
            </div>
            {copyState.error ? (
              <p className="auth-error" role="alert" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
                {copyState.error}
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
