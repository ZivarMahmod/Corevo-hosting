'use client'

// CALYTRIX ÄGER SINA UNDERSIDOR (goal-62, Zivars lag: mallen äger ALLT som syns).
//
// Detta är INTE de delade sektionerna i plommonfärg — det är samma butik som
// PACKBORDET (calytrix.cart.tsx): mörkt plommonbord, numrerade plocklistor,
// lutade vinröda plattor och marginalanteckningar.
//
//   /tjanster → DISKEN: sortimentet som numrerad plocklista på plommonbordet,
//               med kategoriflikar (uiverse rad 11868: glidande platta + notis-
//               bricka) när tjänsterna har kategorier.
//   /om       → BAKOM DISKEN: butikens hantverk som kort vars plommonband sveper
//               ner över kortet (uiverse rad 8445). Riktig team-data om ägaren
//               laddat upp den (content.team är OWNER-ONLY, se theme-content.ts)
//               — annars hantverks-korten Binderi/Rådgivning/Leverans. ALDRIG
//               påhittade personer.
//   /kontakt  → ORDERSEDELN: kontaktkortet byggt med formulär-anatomins fältrader
//               (uiverse rad 16668). Ingen mejl-räls för kontakt finns i motorn →
//               INGEN död submit: uppgifterna bor i fältraderna och "submit-
//               platsen" är en ärlig mailto-/tel-CTA.
//
// FUNKTIONEN är orörd (vektor-regeln): Bookable öppnar samma bokningsdrawer,
// BookCta är samma modul-gatade CTA, all data kommer ur samma ThemePageProps.
// Filen är 'use client' för flikarnas tillstånd — Reveal/Bookable/BookCta är
// redan klientkomponenter och all props-data är serialiserbar, så gränsen
// flyttas bara ett steg ut.
//
// Anatomier lånas ur Zivars uiverse-bibliotek — aldrig koden: inga lånade hexar,
// ingen transition:all, ingen hover-only-affordans. Uttrycket är calytrix tokens.
import { useMemo, useState, type CSSProperties } from 'react'
import { Reveal } from '../../Reveal'
import { Bookable } from '../../Bookable'
import { BookCta } from '@/components/brand/BookCta'
import { formatPrice, formatDuration, serviceDesc } from '../../service-format'
import type { ThemePageProps } from './types'
import st from './calytrix-pages.module.css'

/* ════════ /TJANSTER — DISKEN ════════ */

type Flik = { key: string; label: string; count: number }

export function CalytrixTjanster({ tenant, content, services }: ThemePageProps) {
  // Kategoriflikar BARA när datan bär kategorier (uppdragets regel: annars hoppa).
  // En ensam kategori utan rest är ingen navigation — då ritas ingen flikrad alls.
  const flikar = useMemo<Flik[]>(() => {
    const antal = new Map<string, number>()
    let ovriga = 0
    for (const tj of services) {
      const k = tj.category?.trim()
      if (k) antal.set(k, (antal.get(k) ?? 0) + 1)
      else ovriga += 1
    }
    if (antal.size === 0 || (antal.size === 1 && ovriga === 0)) return []
    const f: Flik[] = [{ key: '__alla', label: 'Allt', count: services.length }]
    for (const [k, n] of antal) f.push({ key: k, label: k, count: n })
    if (ovriga > 0) f.push({ key: '__ovrigt', label: 'Övrigt', count: ovriga })
    return f
  }, [services])

  const [aktiv, setAktiv] = useState(0)
  const vald = flikar[aktiv]
  const visade =
    !vald || vald.key === '__alla'
      ? services
      : vald.key === '__ovrigt'
        ? services.filter((tj) => !tj.category?.trim())
        : services.filter((tj) => tj.category?.trim() === vald.key)

  return (
    <div className={st.page}>
      <header className={st.head}>
        <p className="sf-eyebrow">{content.servicesEyebrow}</p>
        <h1 className={st.title}>{content.servicesTitle}</h1>
        <p className={st.lede}>
          {content.servicesIntro ??
            `Priset står på raden. Välj det du vill ha hos ${tenant.name}, så öppnas bokningen direkt.`}
        </p>
      </header>

      {flikar.length > 0 ? (
        <div className={st.flikSvep}>
          {/* Flikarna är FILTER (aria-pressed), inte dokument-tabs: de smalnar av
              plocklistan under. Glidern (plommonplattan) åker till vald flik —
              likbreda kolumner gör translateX(i·100%) exakt. */}
          <div
            className={st.flikRad}
            role="group"
            aria-label="Filtrera sortimentet"
            style={{ '--n': flikar.length, '--i': aktiv } as CSSProperties}
          >
            {flikar.map((f, i) => (
              <button
                key={f.key}
                type="button"
                className={st.flik}
                aria-pressed={i === aktiv}
                aria-label={`${f.label} — ${f.count} ${f.count === 1 ? 'tjänst' : 'tjänster'}`}
                onClick={() => setAktiv(i)}
              >
                {f.label}
                <span className={st.flikAntal} aria-hidden="true">
                  {f.count}
                </span>
              </button>
            ))}
            <span className={st.flikGlider} aria-hidden="true" />
          </div>
        </div>
      ) : null}

      {visade.length > 0 ? (
        <ol className={st.disk}>
          {visade.map((tj, i) => (
            <Reveal key={tj.id} as="li" delay={i * 50} className={st.rad}>
              {/* Hela raden är klickbar — samma Bookable som förut, bara scenen ny. */}
              <Bookable className={st.radYta} label={`Boka — ${tj.name}`}>
                <span className={st.radNr} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={st.radPlatta}>
                  <span
                    className={st.radFoto}
                    style={{ backgroundImage: `url(${content.galleryImages[i % content.galleryImages.length]})` }}
                    aria-hidden="true"
                  />
                </span>
                <span className={st.radText}>
                  <span className={st.radNamn}>{tj.name}</span>
                  <span className={st.radDesc}>{serviceDesc(tj)}</span>
                </span>
                <span className={st.radMeta}>
                  <span className={st.radPris}>{formatPrice(tj)}</span>
                  <span className={st.radTid}>{formatDuration(tj)}</span>
                  <span className={st.radValj}>Välj →</span>
                </span>
              </Bookable>
            </Reveal>
          ))}
        </ol>
      ) : (
        <p className={st.tom}>Sortimentet läggs upp inom kort. Hör av dig så hjälper vi dig direkt.</p>
      )}
    </div>
  )
}

/* ════════ /OM — BAKOM DISKEN ════════ */

// Hantverks-korten: butikens tre löften när ägaren inte laddat upp ett riktigt
// team. Evergreen (mallen används av många kunder): inga tider, inga namn, inga
// betyg. Ikonerna ritas inline (CSP: inga fjärr-assets) i calytrix streck.
const HANTVERK = [
  {
    key: 'binderi',
    titel: 'Binderi',
    text: 'Varje beställning binds för hand i butiken — av dagens färska blommor.',
    ikon: (
      // Bukett: tre stjälkar som möts i ett omslag.
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="14" cy="12" r="4.5" />
        <circle cx="30" cy="9" r="4.5" />
        <circle cx="36" cy="19" r="4" />
        <path d="M15 16.5 22 32M30 13.5 24 32m11-9-9 9" />
        <path d="M17 32h14l-3 10h-8l-3-10Z" />
      </svg>
    ),
  },
  {
    key: 'radgivning',
    titel: 'Rådgivning',
    text: 'Säg tillfälle och budget, så föreslår vi blommorna som passar.',
    ikon: (
      // Pratbubbla med en blomma i — samtalet först, buketten sedan.
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10h32v22H22l-8 8v-8H8V10Z" />
        <circle cx="24" cy="21" r="3" />
        <path d="M24 12.5v3m0 11v3m8.5-8.5h-3m-11 0h-3" />
      </svg>
    ),
  },
  {
    key: 'leverans',
    titel: 'Leverans',
    text: 'Hämta i butiken när det passar dig, eller låt budet ta buketten hela vägen fram.',
    ikon: (
      // Paket på väg: låda + pil.
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 16 24 8l16 8v16l-16 8-16-8V16Z" />
        <path d="M8 16l16 8 16-8M24 24v16" />
      </svg>
    ),
  },
] as const

export function CalytrixOm({ tenant, content }: ThemePageProps) {
  // content.team är OWNER-ONLY (resolveThemeContent filtrerar bort temats stock-
  // ansikten): finns rader här är det butikens RIKTIGA människor. Tomt → hantverks-
  // korten. Aldrig påhittade personer på en riktig kunds sajt.
  const team = content.team

  return (
    <div className={st.page}>
      <header className={st.head}>
        <p className="sf-eyebrow">— Om {tenant.name}</p>
        <h1 className={st.title}>{content.aboutTitle}</h1>
        <p className={st.lede}>{content.aboutCopy}</p>
      </header>

      {/* Korten med svepande plommonband (uiverse rad 8445): bandet ligger nedklippt
          i toppen och sveper vid hover ner över kortet; medaljongen lyfter. Ingen
          fejk-CTA — kortet är information, svepet är dekor. */}
      <div className={st.hantverk}>
        {team.length > 0
          ? team.map((m, i) => (
              <Reveal key={m.name} as="div" delay={i * 90}>
                <article className={st.kort}>
                  <span className={st.medaljong} aria-hidden="true">
                    {m.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.img} alt="" className={st.medaljongFoto} />
                    ) : (
                      <span className={st.medaljongInitial}>{m.name.trim().charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <h2 className={st.kortNamn}>{m.name}</h2>
                  <p className={st.kortText}>{m.role}</p>
                </article>
              </Reveal>
            ))
          : HANTVERK.map((h, i) => (
              <Reveal key={h.key} as="div" delay={i * 90}>
                <article className={st.kort}>
                  <span className={st.medaljong} aria-hidden="true">
                    {h.ikon}
                  </span>
                  <h2 className={st.kortNamn}>{h.titel}</h2>
                  <p className={st.kortText}>{h.text}</p>
                </article>
              </Reveal>
            ))}
      </div>

      {/* Marginalanteckningarna: temats stats i plocklistans sifferspråk. */}
      {content.stats.length > 0 ? (
        <div className={st.noteringar}>
          {content.stats.map(([varde, etikett], i) => (
            <Reveal key={etikett} as="div" delay={i * 90} className={st.notering}>
              <span className={st.noteringNr} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className={st.noteringVarde}>{varde}</p>
                <p className={st.noteringText}>{etikett}</p>
              </div>
            </Reveal>
          ))}
        </div>
      ) : null}

      {/* Butiken som hjälte: fotot på lutad vinröd platta + citatet som
          marginalanteckning med penndrags-regel. */}
      <div className={st.omScen}>
        <Reveal as="div" className={st.omPlatta}>
          <span className={st.omFoto} style={{ backgroundImage: `url(${content.aboutImage})` }} aria-hidden="true" />
        </Reveal>
        <blockquote className={st.omCitat}>{content.italic}</blockquote>
      </div>
    </div>
  )
}

/* ════════ /KONTAKT — ORDERSEDELN ════════ */

export function CalytrixKontakt({ tenant, content, location, contact }: ThemePageProps) {
  const address = location?.address ?? null
  const hours = location?.hours ?? null
  const mapHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null
  // Submit-platsens ärliga CTA: mejl först, telefon som reserv. Saknas båda finns
  // ingen CTA att ljuga fram — då bär BookCta (bokningsmotorn, riktig räls) ytan.
  const cta = contact.email
    ? { href: `mailto:${contact.email}`, text: 'Skriv till oss' }
    : contact.phone
      ? { href: `tel:${contact.phone.replace(/\s+/g, '')}`, text: 'Ring oss' }
      : null

  return (
    <div className={st.page}>
      <header className={st.head}>
        <p className="sf-eyebrow">{content.contactEyebrow ?? '— Kontakt'}</p>
        <h1 className={st.title}>{content.contactTitle ?? 'Hör av dig'}</h1>
      </header>

      <div className={st.kontaktScen}>
        {/* Butiken som hjälte: fotot på den lutade plattan. */}
        <Reveal as="div" className={st.kontaktPlatta}>
          <span
            className={st.kontaktFoto}
            style={{ backgroundImage: `url(${content.closingImage})` }}
            aria-hidden="true"
          />
        </Reveal>

        {/* Ordersedeln: formulär-anatomins fältrader bär uppgifterna. Klickbara
            rader (tel/mailto) har fokus-liv och alltid synlig pil. */}
        <aside className={st.sedel} aria-label={`Kontaktuppgifter — ${tenant.name}`}>
          <h2 className={st.sedelNamn}>{tenant.name}</h2>

          <p className={st.faltEtikett}>Adress</p>
          {address ? <p className={st.falt}>{address}</p> : <p className={st.falt}>Adress visas snart.</p>}

          {contact.phone ? (
            <>
              <p className={st.faltEtikett}>Telefon</p>
              <a className={st.faltLank} href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
                {contact.phone}
                <span className={st.faltPil} aria-hidden="true">
                  →
                </span>
              </a>
            </>
          ) : null}

          {contact.email ? (
            <>
              <p className={st.faltEtikett}>E-post</p>
              <a className={st.faltLank} href={`mailto:${contact.email}`}>
                {contact.email}
                <span className={st.faltPil} aria-hidden="true">
                  →
                </span>
              </a>
            </>
          ) : null}

          {hours ? (
            <>
              <p className={st.faltEtikett}>Öppettider</p>
              <div className={st.tider}>
                {hours.map((h) => (
                  <div key={h.day} className={st.tidRad}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {cta ? (
            <a className={st.sedelCta} href={cta.href}>
              {cta.text}
            </a>
          ) : null}

          <div className={st.sedelHandlingar}>
            <BookCta />
            {mapHref ? (
              <a className={st.kartLank} href={mapHref} target="_blank" rel="noreferrer noopener">
                Visa på karta <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
