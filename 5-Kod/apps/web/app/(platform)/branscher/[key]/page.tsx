import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { PageHead, Card, Badge, Icon } from '@/components/portal/ui'
import { VerticalEditor } from '@/components/platform/VerticalEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bransch · Plattform' }

/**
 * BRANSCH-KUNDBILDEN (FAS 2, read-only v1 — rapport 02 §3): allt bransch-nivån
 * äger på en yta: terminologi (LIVE-ARV — ändringar slår direkt på alla kunder
 * i branschen), modul-presets (KOPIA vid onboarding), default-mall, mallar
 * taggade för branschen, och kunderna som bär branschen. Skriv-UI = nästa steg.
 */
export default async function BranschPage({ params }: { params: Promise<{ key: string }> }) {
  await requirePlatformAdmin()
  const { key: rawKey } = await params
  const key = decodeURIComponent(rawKey)
  const supabase = await createClient()

  const [{ data: vertical }, { data: tenants }, { data: modules }, { data: templates }] =
    await Promise.all([
      supabase
        .from('verticals')
        .select('key, name, default_modules, default_template, terminology, rules')
        .eq('key', key)
        .maybeSingle(),
      supabase.from('tenants').select('id, name, slug, status, vertical_id'),
      supabase.from('modules').select('key, name'),
      supabase.from('templates').select('key, name, tags, status'),
    ])
  if (!vertical) notFound()

  // Soft-deletade kunder hör inte hemma i kundbilden (Zivar: "skräp ska inte
  // synas") — de finns kvar i DB för historik men listas aldrig här.
  const inBransch = (tenants ?? []).filter(
    (t) => (t as { vertical_id?: string | null }).vertical_id === key && t.status !== 'deleted',
  )
  const mods = (vertical.default_modules ?? {}) as Record<string, string>
  const term = (vertical.terminology ?? {}) as Record<string, string>
  const branschTemplates = (templates ?? []).filter(
    (t) => ((t.tags ?? {}) as { bransch?: string }).bransch === key && t.status === 'active',
  )

  const sec = { marginTop: '1.75rem' } as const
  const h = { margin: '0 0 10px', fontSize: 15.5, fontWeight: 700 } as const

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Branscher"
        title={vertical.name}
        lede="Bransch-nivåns kundbild — etiketter och parametrar ärvs live av kunderna; moduler och tjänster kopieras vid onboarding och ägs sedan av kunden."
      >
        <Badge tone={inBransch.length > 0 ? 'success' : 'neutral'} dot={false}>
          {inBransch.length} {inBransch.length === 1 ? 'kund' : 'kunder'}
        </Badge>
      </PageHead>

      <Link href="/branscher" style={{ color: 'var(--c-forest)', fontWeight: 600, fontSize: 13 }}>
        ← Alla branscher
      </Link>

      {/* Terminologi (live-arv) + modul-förval/mall (kopia) — REDIGERBARA (FAS 2 steg 3) */}
      <VerticalEditor
        verticalKey={vertical.key}
        kundAntal={inBransch.length}
        terminology={term}
        modules={(modules ?? []).map((m) => ({
          key: m.key,
          name: m.name,
          state: mods[m.key] ?? 'off',
        }))}
        defaultTemplate={vertical.default_template ?? null}
      />

      {/* Mallar taggade för branschen */}
      <div style={sec}>
        <h2 style={h}>Mallar taggade för branschen</h2>
        <Card>
          {branschTemplates.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--c-ink-3)' }}>Inga mallar taggade.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {branschTemplates.map((t) => (
                  <span key={t.key} style={{ fontSize: 12.5, padding: '6px 12px', borderRadius: 999, background: 'var(--c-paper-2)', fontWeight: 600 }}>
                    {t.name}
                  </span>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--c-ink-3)' }}>
                OBS: taggade mallar är underlag för mall-galleriet — bara byggda teman är
                renderbara idag (tema-steget listar dem). Fler byggda teman = FAS 4.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Kunder i branschen */}
      <div style={sec}>
        <h2 style={h}>Kunder i branschen</h2>
        {inBransch.length === 0 ? (
          <Card>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--c-ink-3)' }}>
              Inga kunder ännu — onboarda en med branschen vald i första steget.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {inBransch.map((t) => (
              <Link key={t.id} href={`/salonger/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{t.name}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>{t.slug}</span>
                    <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge>
                    <span style={{ marginLeft: 'auto', color: 'var(--c-ink-3)' }}>
                      <Icon name="arrowRight" size={14} />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
