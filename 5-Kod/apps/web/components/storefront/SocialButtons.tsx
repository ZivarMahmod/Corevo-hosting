// goal-62 F1 — SOCIALA KNAPPAR.
//
// Zivar: uiverse-komponenterna han skickat kom aldrig in i mallarna. De sociala länkarna
// mätte som REN TEXT ("Instagram", 79×44, radie 0, ingen ram) i varje mall som visade dem
// — och saknades helt i flera. En textlänk bland andra textlänkar säger inte "här är vi på
// Instagram", den säger ingenting.
//
// ANATOMIN lånas ur uiverse-mönstret (ikon-knapp, kvadratisk träffyta, hover som LYFTER
// och fyller): en riktig ikon, aldrig ett ord. Men aldrig deras KOD — inga hexar, ingen
// `transition: all`, ingen hover-only affordance. Uttrycket kommer ur mallens tokens
// (VEKTOR-REGELN: modulen äger funktionen, mallen äger formen):
//
//   --sf-social-radius   faller tillbaka på mallens ikon-radie (--sf-navicon-radius) →
//                        en rak mall får raka sociala knappar, en pill-mall runda.
//   --sf-social-ink      ikonens färg (default: sidans fg)
//   --sf-social-bg-hover fyllningen vid hover (default: mallens primary)
//
// TILLGÄNGLIGHET: ikonen är dekor (aria-hidden); betydelsen bär `aria-label` på länken.
// Träffytan är 44×44 (touch-golvet) och fokusringen syns vid tangentbordsnavigering.
import s from './social-buttons.module.css'

export type SocialKey = 'instagram' | 'facebook' | 'tiktok'

/** Ikonerna ritas som paths — inget externt bibliotek, inga fjärr-assets (CSP). */
const ICONS: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3h2v9h3v-9h2.4l.6-3H12V6.8c0-.5.4-.8.9-.8H15V3Z" />,
  tiktok: (
    <path d="M15 3c.4 2.1 1.8 3.6 4 3.9v3c-1.5.1-2.9-.3-4.2-1.1v5.9c0 3.4-2.6 5.8-5.8 5.3-2.6-.4-4.4-2.7-4.3-5.3.1-2.6 2.3-4.8 5-4.7v3c-1 .1-1.9.8-2 1.8-.1 1.2.8 2.2 2 2.2 1.1 0 2-.9 2-2V3h3.3Z" />
  ),
}

/** Mallarnas egna listor ser LITE olika ut (vissa kallar nyckeln `key`, andra `icon`, och
 *  href kan vara null innan filtreringen). Typen tar emot alla varianterna; komponenten
 *  normaliserar. Ett gemensamt kontrakt hade krävt att tio mallar skrivs om — och mallens
 *  fil är inte platsen att slåss om en fältnyckel. */
export type SocialLink = {
  key?: SocialKey
  icon?: SocialKey
  href: string | null | undefined
  label: string
}

/** Bygger listan ur tenantens ifyllda social-fält (tomma fält renderas aldrig). */
export function socialLinks(
  social: Partial<Record<SocialKey, string | null>>,
  includeEmpty = false,
): SocialLink[] {
  const links = [
    { key: 'instagram' as const, href: social.instagram, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, label: 'Facebook' },
    { key: 'tiktok' as const, href: social.tiktok, label: 'TikTok' },
  ]
  return includeEmpty ? links : links.filter((x) => typeof x.href === 'string' && x.href.length > 0)
}

/** Nyckeln kan heta `key` eller `icon`; sista utvägen är etiketten. Okänd → instagram-ram. */
function keyOf(l: SocialLink): SocialKey {
  const k = l.key ?? l.icon ?? (l.label.toLowerCase() as SocialKey)
  return k in ICONS ? k : 'instagram'
}

/** Mallarna bygger redan sin egen socials-lista (och använder dess .length för att avgöra
 *  om raden ska finnas alls) — därför tar komponenten LISTAN, inte tenant-objektet. */
export function SocialButtons({
  links,
  className,
  editorStable = false,
}: {
  links: SocialLink[]
  className?: string
  editorStable?: boolean
}) {
  const visibleLinks = links.filter((l): l is SocialLink & { href: string } =>
    typeof l.href === 'string' && l.href.length > 0)
  if (!editorStable && visibleLinks.length === 0) return null

  return (
    <ul className={className ? `${s.row} ${className}` : s.row}
      data-corevo-social-group={editorStable || undefined} hidden={editorStable && visibleLinks.length === 0}>
      {(editorStable ? links : visibleLinks).map((l) => {
        const key = keyOf(l)
        const href = typeof l.href === 'string' && l.href.length > 0 ? l.href : null
        return <li key={key}>
          <a
            href={href ?? '#'}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${l.label} — öppnas i ny flik`}
            className={s.btn}
            hidden={!href}
            data-corevo-editor-field={editorStable ? `social.${key}` : undefined}
            data-corevo-editor-stable-field={editorStable ? `social.${key}` : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[key]}
            </svg>
          </a>
        </li>
      })}
    </ul>
  )
}
