import { Card, Callout, Badge, Icon } from '@/components/portal/ui'
import styles from './installningar.module.css'

/**
 * Inställningar — plattformsövergripande reglage (goal-17 PLATFORM). EXACT-copy of
 * the design-system law source composition (components/SuperPlatform.jsx →
 * SuperSettings, with the Toggle from Shell.jsx): a max-680px column of three Cards
 * — Säkerhet · Drift · Fakturering — each a section header + stacked reglage rows.
 *
 * HONESTY over the mock's interactivity (CLAUDE.md NEVER-FAKE + the task's "NO dead
 * toggles"): the prototype's toggles are `useState`-only — nothing persists, and the
 * foundation confirms NO platform-settings store exists (a migration is out of the
 * frozen scope). So the security/drift reglage render DISABLED with a muted "Kommer
 * snart" pill, NOT the mock's live "Aktiv/Av" badge — that badge would assert an
 * introspected on/off state with no backing source, the same violation as a fake
 * health pill. One honest Callout band states the reglage aren't persisted yet.
 *
 * Two elements ARE genuine truth and bind live:
 *  • Audit-guard mot radering — the build-once-never-delete invariant is actually
 *    enforced (setTenantStatus soft-deletes, never .delete()). Shown ON + locked,
 *    framed "Skyddat i koden", not a flippable control.
 *  • Fakturering-modell — "Manuell (flöde 2)" is the platform's real billing posture
 *    (FLÖDE 2: Corevo invoices each salong manually off the Fakturering view, no
 *    Stripe subscription, no MRR-automation). This is an architectural fact, not a
 *    per-tenant enum, so it is stated directly (not derived from a per-salong model).
 *
 * Server component: every reglage is non-interactive (read-only), so there is no
 * client state to manage and no mutation to fire — hence no toast here (consequence
 * toasts belong on real mutations, which this view deliberately has none of yet).
 */

type ReglageProps = {
  title: string
  desc: string
  /** Visual on/off of the track (off for "kommer snart", on for the live invariant). */
  on: boolean
  /** 'soon' → disabled + muted "Kommer snart" pill (no store). 'enforced' → on, locked,
   *  green pill (real invariant). */
  variant: 'soon' | 'enforced'
}

/** One reglage row — EXACT copy of Shell.jsx → Toggle, minus the live click (no store). */
function Reglage({ title, desc, on, variant }: ReglageProps) {
  const enforced = variant === 'enforced'
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>
          {title}
          {enforced ? (
            <span className={`${styles.pill} ${styles.pillOn}`}>Aktiv</span>
          ) : (
            <span className={`${styles.pill} ${styles.pillSoon}`}>Kommer snart</span>
          )}
        </div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      {/* Track is rendered for design-trohet but never flippable: 'soon' is dimmed +
          disabled (no store to write); 'enforced' is on + locked (it's the live
          truth, just not a setting you can turn off). */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={
          enforced
            ? `${title}: aktiv, skyddat i koden`
            : `${title}: kommer snart, ännu ej kopplat`
        }
        className={`${styles.track} ${on ? styles.trackOn : ''} ${
          enforced ? styles.trackLocked : styles.trackDisabled
        }`}
      >
        <span className={`${styles.thumb} ${on ? styles.thumbOn : ''}`} />
      </button>
    </div>
  )
}

export function Settings() {
  return (
    <div className={styles.wrap}>
      {/* Honest band: the mock's reglage are sann-kopplade in the prototype's words,
          but no platform-wide store is wired in this build — say so plainly (§6
          callout-band + the written empty-state ethic), never a fake live toggle. */}
      <Callout tone="info" icon="info">
        Plattforms-reglagen nedan är förberedda men ännu inte kopplade till ett
        sparat läge — de visar avsedd posture, inte ett live på/av. Audit-guard och
        faktureringsmodellen är däremot sanna: de speglar hur plattformen faktiskt
        beter sig i dag.
      </Callout>

      {/* ── Säkerhet ── */}
      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHead}`}>Säkerhet</h2>
        <Reglage
          variant="soon"
          on={false}
          title="Tvåfaktor (MFA) för super-admin"
          desc="Krävs för att logga in i plattformskontrollen. Artiklarnas #1-regel. Aktiveras när MFA-flödet kopplas."
        />
        <Reglage
          variant="soon"
          on={false}
          title="IP-whitelist"
          desc="Begränsa super-admin till betrodda IP / VPN. Kräver en lagrad lista — ännu ej kopplad."
        />
        <Reglage
          variant="enforced"
          on
          title="Audit-guard mot radering"
          desc="Skyddade rader kan aldrig raderas, bara suspenderas. Skyddat i koden — build-once-never-delete."
        />
        <div className={styles.guardBand}>
          <Icon name="shield" size={15} />
          <span>
            Aktiv: skyddade rader kan aldrig raderas, bara suspenderas. Inget reglage
            kan stänga av den här regeln.
          </span>
        </div>
      </Card>

      {/* ── Drift ── */}
      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHead}`}>Drift</h2>
        <Reglage
          variant="soon"
          on={false}
          title="Auto-klar bokningar"
          desc="Markera passerade tider som klara — men aldrig falskt klar+betald vid no-show. Kräver ett sparat läge."
        />
        <Reglage
          variant="soon"
          on={false}
          title="Daglig sammanfattning"
          desc="E-post med nyckeltal + händelser varje morgon. Aktiveras när digest-jobbet kopplas."
        />
      </Card>

      {/* ── Fakturering (LIVE: the platform's real billing posture, flöde 2) ── */}
      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHeadGap}`}>Fakturering</h2>
        <div className={styles.billRow}>
          <div>
            <div className={styles.billTitle}>Modell: manuell (flöde 2)</div>
            <div className={styles.billDesc}>
              Underlag från genomförda bokningar. Ingen Stripe-prenumeration, ingen
              MRR-automation.
            </div>
          </div>
          <Badge tone="gold" dot={false}>
            Aktiv
          </Badge>
        </div>
      </Card>
    </div>
  )
}
