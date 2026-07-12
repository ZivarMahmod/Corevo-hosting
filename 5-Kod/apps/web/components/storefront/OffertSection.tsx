// Offert storefront SECTION (multi-bransch spår 5, §15 skelett vs skin).
//
// SERVER component. The SECTION reads the module's resolved config (via
// loadOffertData); the TEMPLATE/skin gives the look. Per §15: "funktioner bor i
// MODULEN, inte i mallen" — this section IS the offert module's storefront surface,
// injected at the module's default_section_position ('main', per 0033). It styles
// itself with the storefront design tokens (var(--color-*) / var(--font-*)), the
// SAME token-driven approach as ShopSection / ModulePausedBanner — no new palette,
// so it blends into whichever skin the tenant runs.
//
// GATING (caller contract): render this ONLY when the tenant's offert module is
// LIVE. The call site (storefront page) resolves tenant_modules.state via
// getTenantModuleStates() + isModuleLive(states,'offert') and renders <OffertSection>
// only then — EXACTLY the booking + shop gate shape. draft/off never reach here; a
// PAUSED offert renders the section read-only (form becomes a "stängt"-state) —
// same contract as the booking paused banner / paused shop.
//
// INTAKE VARIANTS (config-first, beslut 14.5): the section behaves per the resolved
// variant via the pure helpers in lib/storefront/offert/types.ts:
//   request_quote → fritext-behov; submit "Skicka förfrågan".
//   estimate_form → strukturerat formulär; submit "Få prisuppskattning".
//   callback      → kontakt + kort behov; submit "Be oss ringa upp".
// No `if (bransch)` anywhere — only the variant drives the difference.
//
// BETAL-RAILS PAUSADE (beslut 14.2): an offert is an UNDERLAG — it never takes
// payment. The form (now the OffertForm 'use client' island) inserts an
// offert_requests row via the submitOffertRequest action; no money flow, no pay step.

// goal-60: teaser-länken och pausad-lappen bar 3 inline style={{}} — de kunde inte ha
// :hover/:focus-visible och ingen mall kunde nå in i dem. De ÅTERANVÄNDER nu
// shop-section.module.css: "Begär offert →" har exakt samma anatomi som "Visa hela
// butiken →" (.moreWrap/.more, 44px klickyta), och pausad-lappen samma som butikens
// (.notice, --sf-notice-*). Samma sorts yta ska aldrig ha två uppsättningar regler.

import { SectionHeader, SubpageHero } from './sections'
import shop from './shop-section.module.css'
import {
  offertPromise,
  OFFERT_MODE_LABELS,
  type OffertData,
} from '@/lib/storefront/offert/types'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { OffertForm } from './OffertForm'

/** Resolve + render the offert section for one tenant. Returns null when there is
 *  nothing to show (no offert module row) so the caller can compose unconditionally.
 *  `paused` renders the form read-only with a closed-notice instead of submit. */
export async function OffertSection({
  tenantId,
  slug,
  paused = false,
  teaser = false,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='offert' is 'paused' → form visible, closed. */
  paused?: boolean
  /** Startsidans kompakta läge: rubrik + länk till /offert istället för hela formuläret. */
  teaser?: boolean
  /** Modulens EGEN sida: hero-bandet i stället för SectionHeader (goal-57). */
  pageHero?: boolean
}) {
  const data: OffertData | null = await loadOffertData(tenantId, slug)
  if (!data) return null

  const { config } = data

  if (teaser) {
    return (
      <section className="section" data-module="offert" data-mode={config.mode}>
        <div className="section-inner">
          <SectionHeader
            eyebrow="— Offert"
            title="Större jobb? Få en offert"
            lead={offertPromise(config)}
          />
          <p className={shop.moreWrap}>
            <a href="/offert" className={shop.more}>
              Begär offert <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      {pageHero ? (
        <SubpageHero
          eyebrow={`— Offert · ${OFFERT_MODE_LABELS[config.mode]}`}
          title="Få en offert"
          lede={offertPromise(config)}
        />
      ) : null}
    <section className="section" data-module="offert" data-mode={config.mode}>
      <div className="section-inner">
        {!pageHero ? (
          <SectionHeader
            eyebrow={`— Offert · ${OFFERT_MODE_LABELS[config.mode]}`}
            title="Få en offert"
            lead={offertPromise(config)}
          />
        ) : null}

        {paused ? (
          <p role="status" className={shop.notice}>
            Vi tar tillfälligt inte emot nya offertförfrågningar. Hör av dig igen snart.
          </p>
        ) : null}

        {/* INTAKE LIVE: the interactive form is a 'use client' island that posts an
            anonymous offert_requests row via the submitOffertRequest action (tenant +
            variant resolved server-side). When PAUSED we render only the closed-notice
            above and DO NOT mount the form — no submission path while intake is shut. */}
        {paused ? null : (
          <OffertForm mode={config.mode} responseDays={config.responseDays} subjects={config.subjects} />
        )}
      </div>
    </section>
    </>
  )
}
