// Teamet — DEN DELADE SEKTIONEN (goal-64).
//
// SERVER-komponent. Detta är FALLBACKEN: mallar som deklarerar `moduleViews.team` i sin
// <key>.theme.ts äger formen själva (vektor-regeln) och når aldrig hit.
//
// BOKNINGS-KOPPLINGEN (HANDOFF §4: "teamkorten och prisraderna förifyller bokningen via
// bookAs() — behåll den kopplingen"): varje teamkort länkar till /boka?personal=<staffId>.
// /boka läser query-parametern och FÖRVÄLJER medarbetaren i wizardens "Hos vem?"-steg.
// Länken är en vanlig <a> — ingen klient-JS behövs, och den funkar i mallens preview,
// i mobilmenyn och för en besökare som högerklickar och öppnar i ny flik.
//
// RENDER-ON-PRESENT: bio/specialiteter/foto renderas bara när kunden fyllt i dem. Utan
// foto → medarbetarens initialer, ALDRIG ett stock-porträtt. Tom lista → hela sektionen
// utelämnas (null): en salong utan synlig personal ska inte få en tom "Vårt team"-rubrik.

import { SectionHeader, SubpageHero } from '../sections'
import s from './team-section.module.css'
import type { TeamMember } from '@/lib/storefront/team/types'

/** Initialer ur namnet — fallback när medarbetaren saknar foto. */
function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/**
 * Bokningens djuplänk för EN medarbetare. `personal` = staff.id; `tjanst` läggs bara på
 * när tjänsten är känd (prisraden vet den, teamkortet gör det inte). Okända/ogiltiga
 * id:n ignoreras av /boka — en trasig länk kan därför aldrig låsa bokningen.
 */
export function bookingHref(staffId: string, serviceId?: string | null): string {
  const q = new URLSearchParams({ personal: staffId })
  if (serviceId) q.set('tjanst', serviceId)
  return `/boka?${q.toString()}`
}

function MemberCard({ member, ctaLabel }: { member: TeamMember; ctaLabel: string }) {
  const display = member.shortName || member.name
  return (
    <li className={s.card}>
      <div className={s.media}>
        {member.imageUrl ? (
          // Plain <img> — storefrontens remote-image-config är fryst (aldrig next/image).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.imageUrl} alt={member.name} loading="lazy" className={s.img} />
        ) : (
          <span aria-hidden="true" className={s.initials}>
            {initialsOf(member.name)}
          </span>
        )}
      </div>
      <div className={s.body}>
        <h3 className={s.name}>{member.name}</h3>
        {/* `title` bär idag SAMMA sträng som namnet (staff har en textkolumn för
            person-identiteten, se lib/storefront/team/types.ts). Skriv den bara när den
            faktiskt säger något NYTT — annars vore raden bara namnet en gång till. */}
        {member.title && member.title !== member.name ? (
          <p className={s.role}>{member.title}</p>
        ) : null}
        {member.specialties ? <p className={s.specialties}>{member.specialties}</p> : null}
        {member.bio ? <p className={s.bio}>{member.bio}</p> : null}
        {/* Djuplänken: personen är förvald när bokningen öppnas. */}
        <a href={bookingHref(member.id)} className={s.cta}>
          {ctaLabel} {display} →
        </a>
      </div>
    </li>
  )
}

/**
 * Rendera teamet. `members` laddas av anroparen (loadTeamMembers) — sektionen gör ingen
 * I/O, så den kan återanvändas av både /team och en framtida startside-teaser.
 * Tom lista → null.
 */
export function TeamSection({
  members,
  ctaLabel = 'Boka hos',
  pageHero = false,
}: {
  members: TeamMember[]
  /** BRANSCH-REGELN: verbet kommer ur bransch-lagret hos anroparen, aldrig hårdkodat här. */
  ctaLabel?: string
  pageHero?: boolean
}) {
  if (members.length === 0) return null

  return (
    <>
      {pageHero ? (
        <SubpageHero eyebrow="— Teamet" title="Vårt team" lede="Människorna du möter hos oss." />
      ) : null}
      <section className="section" data-module="team">
        <div className="section-inner">
          {!pageHero ? (
            <SectionHeader eyebrow="— Teamet" title="Vårt team" lead="Människorna du möter hos oss." />
          ) : null}
          <ul className={s.grid}>
            {members.map((m) => (
              <MemberCard key={m.id} member={m} ctaLabel={ctaLabel} />
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
