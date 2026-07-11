import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { PageHead, Card, Badge } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Branscher · Plattform' }

/**
 * BRANSCHER (FAS 2, bransch-optimering 2026-07-11) — katalog-nivåns kundbild:
 * en rad per vertical med kund-antal, modul-preset och default-mall. Read-only
 * v1 (rapport 02 §5 steg 2); skriv-UI för terminologi/moduler/parametrar byggs
 * i nästa steg. Branschen styr hur delade moduler BETER sig — detta är ytan
 * där det kommer bo.
 */
export default async function BranscherPage() {
  await requirePlatformAdmin()
  const supabase = await createClient()

  const [{ data: verticals }, { data: tenants }] = await Promise.all([
    supabase.from('verticals').select('key, name, default_modules, default_template, terminology').order('name'),
    supabase.from('tenants').select('id, vertical_id'),
  ])

  const countByVertical = new Map<string, number>()
  for (const t of tenants ?? []) {
    const k = (t as { vertical_id?: string | null }).vertical_id
    if (k) countByVertical.set(k, (countByVertical.get(k) ?? 0) + 1)
  }

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Branscher"
        lede="Bransch-nivåns inställningar — det som gäller ALLA kunder i branschen: moduler, terminologi och mallar. Kundens egna val bor i kundkortet."
      />
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {(verticals ?? []).map((v) => {
          const mods = (v.default_modules ?? {}) as Record<string, string>
          const activeMods = Object.entries(mods).filter(([, s]) => s !== 'off')
          const term = (v.terminology ?? {}) as Record<string, string>
          const count = countByVertical.get(v.key) ?? 0
          return (
            <Link key={v.key} href={`/branscher/${encodeURIComponent(v.key)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{v.name}</span>
                  <Badge tone={count > 0 ? 'success' : 'neutral'} dot={false}>
                    {count} {count === 1 ? 'kund' : 'kunder'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {activeMods.length > 0 ? (
                    activeMods.map(([k, s]) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 11.5,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: s === 'live' ? 'var(--c-success-bg)' : 'var(--c-paper-2)',
                          color: s === 'live' ? 'var(--c-forest)' : 'var(--c-ink-2)',
                          fontWeight: 600,
                        }}
                      >
                        {k} · {s}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--c-ink-3)' }}>Inga förvalda moduler</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 12 }}>
                  Default-mall: <b style={{ color: 'var(--c-ink-2)' }}>{v.default_template ?? '—'}</b>
                  {term.staff ? <> · Personal kallas &quot;{term.staff}&quot;</> : null}
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
