import { Icon } from './Icon'

export type LoyaltyWorld = 'backoffice' | 'storefront'

/**
 * Token set per world. The ONLY cross-world primitive — so it must switch the
 * FULL palette, never just the accent: putting Corevo `--c-*` tokens (or the
 * `.eyebrow`/`.num` classes) into /konto is the "Corevo tokens in /konto = bug"
 * rule. Storefront reads the tenant theme's `--color-*` (resolved from
 * injectTenantTokens on the portal root, so it works on /konto even before that
 * page is fully worlded). `--font-display` resolves in both worlds. Tabular
 * numerals come from an inline `fontVariantNumeric` (not the back-office-only
 * `.num` class), so the numeral stays world-safe.
 */
const WORLDS: Record<
  LoyaltyWorld,
  {
    accent: string // numeral + label + rail fill + gift
    track: string // progress rail track
    fg: string // primary text (within-card)
    fg2: string // muted text
    body: string // body font family
  }
> = {
  backoffice: {
    accent: 'var(--c-gold-600)',
    track: 'var(--c-paper-2)',
    fg: 'var(--c-ink)',
    fg2: 'var(--c-ink-3)',
    body: 'var(--font-ui)',
  },
  storefront: {
    accent: 'var(--color-primary)',
    track: 'var(--color-accent-soft)',
    fg: 'var(--color-fg)',
    fg2: 'var(--color-fg-2)',
    body: 'var(--font-body)',
  },
}

/**
 * Loyalty block (playbook §4.6 back-office Kunder detail + §4.8 /konto account
 * card). The shared anatomy: an eyebrow (tier label), a big Playfair points
 * numeral, a thin progress rail toward the next tier, an optional "X p kvar"
 * caption, and a gift glyph. ACCENT is world-aware: gold in back-office, the
 * salon's `--color-primary` in storefront/konto.
 *
 * Renders INNER CONTENT ONLY (transparent background) — the consuming page owns
 * the container (a paper card in back-office §4.6; a primary-filled hero in
 * /konto §4.8). Dumb + presentational: the parent passes the derived points /
 * tier / nextTier; this never reads the loyalty ledger itself.
 */
export function LoyaltyBlock({
  world = 'backoffice',
  tier,
  points,
  nextTierAt,
  rewardHint,
  showGift = true,
  onAccent = false,
}: {
  world?: LoyaltyWorld
  /** Tier label shown in the eyebrow (e.g. "Guld"). Omit to show just "Lojalitet". */
  tier?: string | null
  /** Current points balance (derived from the ledger by the caller). */
  points: number
  /** Points threshold for the next tier — omit when already at the top tier
   *  (then the rail + "kvar" caption are hidden). */
  nextTierAt?: number | null
  /** Optional reward copy appended to the "X p kvar" line (e.g. "då bjuder vi på en inpackning"). */
  rewardHint?: string
  showGift?: boolean
  /** STOREFRONT only: render for a --color-primary-FILLED container (the §4.8
   *  /konto loyalty card — Customer.jsx: white numeral, white fill, white text,
   *  translucent-white track). Without it the storefront variant assumes a LIGHT
   *  surface (primary numeral on accent-soft track) and would render
   *  primary-on-primary (invisible) inside the filled card. The kund page wraps
   *  this in the primary card and passes onAccent. No-op in back-office (§4.6 is
   *  always a paper surface with gold numerals). */
  onAccent?: boolean
}) {
  const base = WORLDS[world] ?? WORLDS.backoffice
  // On a --color-primary-filled storefront card, flip the full set to white so
  // the numeral/rail don't vanish into the fill.
  const t =
    world === 'storefront' && onAccent
      ? {
          accent: '#fff',
          track: 'rgba(255,255,255,.25)',
          fg: '#fff',
          fg2: 'rgba(255,255,255,.85)',
          body: base.body,
        }
      : base
  const hasNext = nextTierAt != null && nextTierAt > 0 && points < nextTierAt
  const pct = hasNext ? Math.min(100, Math.round((points / (nextTierAt as number)) * 100)) : 100
  const remaining = hasNext ? (nextTierAt as number) - points : 0
  const fmt = (n: number) => n.toLocaleString('sv-SE')
  const giftBg =
    world === 'backoffice'
      ? 'var(--c-gold-100)'
      : world === 'storefront' && onAccent
        ? 'rgba(255,255,255,.15)'
        : 'var(--color-accent-soft)'

  const eyebrowStyle =
    world === 'backoffice'
      ? {
          // back-office canon eyebrow (gold-600, .18em, 11, uppercase)
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          color: t.accent,
        }
      : {
          // storefront eyebrow grammar (.sf-eyebrow): body 600 / 12 / .18em / primary
          fontFamily: t.body,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          color: t.accent,
        }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={eyebrowStyle}>{tier ? `Lojalitet · ${tier}` : 'Lojalitet'}</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: world === 'backoffice' ? 28 : 36,
            fontWeight: 700,
            color: t.accent,
            lineHeight: 1.1,
            marginTop: 4,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmt(points)}{' '}
          <span style={{ fontSize: world === 'backoffice' ? 15 : 18, fontWeight: 600 }}>poäng</span>
        </div>
        {hasNext && (
          <div style={{ marginTop: 14, maxWidth: 320 }}>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: t.track,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: t.accent,
                  borderRadius: 999,
                }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: t.fg2, marginTop: 7, fontFamily: t.body }}>
              {fmt(remaining)} p kvar till nästa nivå{rewardHint ? ` — ${rewardHint}` : '.'}
            </div>
          </div>
        )}
        {!hasNext && (
          <div style={{ fontSize: 12.5, color: t.fg2, marginTop: 8, fontFamily: t.body }}>
            Högsta nivån uppnådd.
          </div>
        )}
      </div>
      {showGift && (
        <span
          aria-hidden="true"
          style={{
            width: world === 'backoffice' ? 48 : 64,
            height: world === 'backoffice' ? 48 : 64,
            flex: 'none',
            borderRadius: 999,
            background: giftBg,
            color: t.accent,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="gift" size={world === 'backoffice' ? 24 : 30} />
        </span>
      )}
    </div>
  )
}
