import { SectionHeader } from '../sections'
import { JoinClubForm } from './JoinClubForm'
import {
  formatPlanPrice,
  loyaltyIntervalLabel,
  lojalitetVariantLabel,
  type LojalitetConfig,
  type LoyaltyPlan,
} from '@/lib/storefront/lojalitet/types'
import s from './klubb.module.css'

/**
 * KLUBBEN — lojalitet-modulens DELADE sida (/klubb, goal-64).
 *
 * Alla 12 Claude Design-mallar har klubben (under olika namn: Kretsen, Söndagsklubben,
 * Första raden, Stamkund …) men plattformen hade ingen route — så Onyx tvingades rendera
 * "Kretsen" som olänkad text och Auroras klubbband pekade ingenstans. Nu finns sidan.
 *
 * VEKTOR-REGELN (goal-59): en mall med en EGEN lojalitet-vy (ThemeModuleViews.lojalitet)
 * renderar den; den här sektionen är fallbacken för alla andra — samma kontrakt som
 * BloggSection/ShopSection. Den ritar sig enbart i storefrontens tokens och ärver därför
 * mallens uttryck utan att kopiera dess form.
 *
 * SYNKRON komponent (ingen async, ingen I/O): sidan har redan laddat allt. RENDER-ON-
 * PRESENT: inga påhittade nivåer, förmåner, priser eller medlemsantal — saknas datat
 * ritas ingenting. En tom klubb är en klubb utan innehåll, inte en klubb med lögner.
 */
export function LojalitetPage({
  config,
  plans,
  paused = false,
}: {
  config: LojalitetConfig
  plans: LoyaltyPlan[]
  /** tenant_modules.state = 'paused' → sidan läsbar, men klubben tar inte emot medlemmar. */
  paused?: boolean
}) {
  return (
    <section className="section" data-module="lojalitet" data-variant={config.variant}>
      <div className="section-inner">
        <SectionHeader
          eyebrow={`— Klubben · ${lojalitetVariantLabel(config.variant)}`}
          title={config.headline}
          lead={config.perkText}
        />

        {paused ? (
          <p role="status" className={s.notice}>
            Lojalitetsprogrammet är pausat just nu — du kan inte gå med för tillfället.
          </p>
        ) : null}

        {/* Klubbens förmåner (mallarnas clubPerks). Ingen lista i kundens config →
            ingen lista här. */}
        {config.perks && config.perks.length > 0 ? (
          <ul className={`${s.perks} ${s.perksTop}`}>
            {config.perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        ) : null}

        {/* Variantens egen form: stämpelkortet ritar sina tomma stämplar (Aurora/Sol &
            Salt), poäng-varianten sin intjäning. Oförändrat från LojalitetSection. */}
        {config.variant === 'stamp_card' ? (
          <ul aria-label={`Stämpelkort — samla ${config.stampGoal} stämplar`} className={s.stamps}>
            {Array.from({ length: config.stampGoal }).map((_, i) => (
              <li key={i} aria-hidden="true" className={s.stamp} />
            ))}
          </ul>
        ) : (
          <p className={s.points}>
            Tjäna <strong className={s.pointsFigure}>{config.pointsPerVisit} poäng</strong> per
            besök.
          </p>
        )}

        {/* NIVÅERNA (loyalty_plans) — Källas Droppe/Källa/Flod. Priset VISAS; det dras
            inte (betal-rälsen för abonnemang byggs separat). Har kunden inga nivåer ritas
            ingen pristavla, och "gå med"-rutan nedan står ensam. */}
        {plans.length > 0 ? (
          <ul className={s.plans}>
            {plans.map((plan) => (
              <li
                key={plan.id}
                className={plan.featured ? `${s.plan} ${s.planFeatured}` : s.plan}
              >
                {plan.featured ? <span className={s.planTag}>Populärast</span> : null}
                <h3 className={s.planName}>{plan.name}</h3>
                <p className={s.planPrice}>
                  {formatPlanPrice(plan.priceCents)}{' '}
                  <span className={s.planInterval}>{loyaltyIntervalLabel(plan.interval)}</span>
                </p>
                {plan.perks.length > 0 ? (
                  <ul className={s.perks}>
                    {plan.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}
                {!paused ? <JoinClubForm planId={plan.id} cta="Starta" /> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Klubb utan nivåer (stämpelkort/poäng) → ETT intag. Med nivåer bär varje nivå
            sin egen CTA ovan, och en till här hade bara varit en dublett. */}
        {!paused && plans.length === 0 ? <JoinClubForm compact /> : null}
      </div>
    </section>
  )
}
