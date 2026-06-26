'use client'

// Onboarding-studio (goal-48) — "Kunder" stage. Ported VERBATIM from the design
// (super-admin/stages.jsx:17–66) per the W1 build-contract §8, with the design's
// DEMO_TENANTS swapped for the REAL cross-tenant feed (TenantCardItem from
// listTenantsWithStats). HONESTY (§9): the design's hardcoded stat numbers
// (24/21/6 240/24 960) are mockup — only Kunder + Aktiva have a real loader source;
// Bokningar·mån + Underlag·mån have NO monthly aggregate here → rendered as a visible
// "—" stub, NEVER the demo numbers. Inline-styled against the [data-world="backoffice"]
// --c-* tokens (project convention; no *.module.css).
import type { CSSProperties, ReactNode } from 'react'
import { Card } from '@/components/portal/ui/Card'
import { Badge, type BadgeTone } from '@/components/portal/ui/Badge'
import { Button } from '@/components/portal/ui/Button'
import { Icon, type IconName } from '@/components/portal/ui/Icon'
import type { TenantCardItem, TenantDisplayStatus } from '@/lib/platform/tenants'

/** Gold uppercase eyebrow — ported from the design primitive SEyebrow
 *  (primitives.jsx:73). Presentational span; not load-bearing enough for the shared
 *  controls file. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--c-gold-600)',
      }}
    >
      {children}
    </span>
  )
}

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

/** displayStatus → badge tone + Swedish label (§8 field map: active→success "Aktiv",
 *  onboarding→info "Onboarding", suspended→"Pausad"). */
const STATUS_BADGE: Record<TenantDisplayStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: 'success', label: 'Aktiv' },
  onboarding: { tone: 'info', label: 'Onboarding' },
  suspended: { tone: 'warning', label: 'Pausad' },
}

export function SuperEntry({
  tenants,
  onStart,
}: {
  tenants: TenantCardItem[]
  onStart: () => void
}) {
  // §8/§9 — only these two are real; the other two have no loader source → honest stub.
  const kunder = tenants.length
  const aktiva = tenants.filter((t) => t.displayStatus === 'active').length
  const stats: Array<[label: string, value: string, icon: IconName]> = [
    ['Kunder', String(kunder), 'building'],
    ['Aktiva', String(aktiva), 'checkCircle'],
    ['Bokningar · mån', '—', 'trendUp'],
    ['Underlag · mån', '—', 'dollar'],
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--c-cream)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 40px 60px' }}>
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div>
            <Eyebrow>Plattform · superbooking@corevo.se</Eyebrow>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 34,
                color: 'var(--c-forest)',
                margin: '8px 0 0',
              }}
            >
              Kunder
            </h1>
            <p style={{ fontSize: 14, color: 'var(--c-ink-2)', margin: '6px 0 0', maxWidth: 520 }}>
              Dina kunder. Onboarda en ny — vilken bransch som helst — och följ hela bygget i en
              live preview tills sidan är deployad.
            </p>
          </div>
          <Button variant="primary" size="lg" icon="plus" onClick={onStart}>
            Onboarda ny kund
          </Button>
        </div>

        {/* ── Stat cards (Kunder/Aktiva real; Bokningar·mån/Underlag·mån = honest "—") ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 14,
            marginBottom: 24,
          }}
        >
          {stats.map(([label, value, icon]) => (
            <Card key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Eyebrow>{label}</Eyebrow>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: 'var(--c-paper-2)',
                    color: 'var(--c-forest)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name={icon} size={16} />
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 30,
                  color: 'var(--c-forest)',
                  marginTop: 8,
                  ...TABULAR,
                }}
              >
                {value}
              </div>
            </Card>
          ))}
        </div>

        {/* ── Customer list ── */}
        <Card pad={0}>
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--c-line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: 17,
                color: 'var(--c-ink)',
                margin: 0,
              }}
            >
              Alla kunder
            </h2>
            <Badge tone="info" dot={false}>
              multi-tenant · RLS per tenant_id
            </Badge>
          </div>

          {tenants.length === 0 ? (
            // §8 — design has no empty state; W1 adds a minimal honest one (footer CTA stays).
            <div style={{ padding: '40px 22px', textAlign: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--c-paper-2)',
                  color: 'var(--c-ink-3)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Icon name="building" size={20} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--c-ink)' }}>
                Inga kunder ännu
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 4 }}>
                Onboarda din första kund för att komma igång.
              </div>
            </div>
          ) : (
            tenants.map((t, i) => {
              const status = STATUS_BADGE[t.displayStatus]
              const subline = t.themeLabel
                ? `${t.slug}.corevo.se · ${t.themeLabel}`
                : `${t.slug}.corevo.se`
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 22px',
                    borderTop: i ? '1px solid var(--c-line)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      flex: 'none',
                      borderRadius: 10,
                      background: t.markColor,
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    {(t.name[0] ?? '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--c-ink)' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', ...TABULAR }}>
                      {subline}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--c-ink-2)', ...TABULAR }}>
                    {t.bookings} bokn.
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              )
            })
          )}

          {/* ── Gold footer CTA (always visible — also the empty-state primary path) ── */}
          <div
            style={{
              padding: '16px 22px',
              borderTop: '1px solid var(--c-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'color-mix(in srgb, var(--c-gold) 6%, var(--c-paper))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--c-gold-100)',
                  color: 'var(--c-gold-600)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="plus" size={19} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
                  Onboarda en ny kund
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
                  Bransch → moduler → branding → live. Live preview hela vägen.
                </div>
              </div>
            </div>
            <Button variant="gold" icon="arrowRight" onClick={onStart}>
              Starta
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
