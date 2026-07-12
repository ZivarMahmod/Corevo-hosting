import Link from 'next/link'
import { Reveal } from '../../Reveal'
import { AddToCart } from '../../shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
  type ShopProduct,
} from '@/lib/storefront/shop/types'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ThemeShopViewProps, ThemeBloggViewProps } from './types'
import styles from './calytrix-modules.module.css'

/**
 * CALYTRIX — MODUL-VYER, ombyggda från grunden (Zivars order: "mallen äger ALLT som
 * syns; modulen äger bara funktionen").
 *
 * BUTIKEN = SKYLTBORDET — packbordets syskon (calytrix-cart.tsx är facit): varorna
 * ligger numrerade på ett mörkt plommonbord, lutade på vinröda plattor, och LYFTER
 * när man rör dem. BLOGGEN = BREV FRÅN FLORISTEN: ljusa pappersark med kronbladsrader
 * bakom texten (uiverse-biljettens ♪♪♪-anatomi, rad 14590, med kronblad i stället).
 *
 * Zivars element (uiverse-komponentbiblioteket) — ANATOMIN porterad, aldrig koden:
 *   rad 8375       → produktkortet (bild lyfter+zoomar, svep underifrån, pris+köp-rad)
 *   rad 7807/8483  → badge-språket (Populär/Slutsåld) + spökordet i heron
 *   rad 2720 .Btn  → snabb-köpet: kompakt knapp som växer vid hover/fokus
 *   rad 9884/9896  → skelett-shimmer under produktfoton medan de laddar
 *   rad 14590      → brevkortet (kronbladsrader, symbol i hörnet, stämpel-datum)
 *   rad 11077      → HOPPAD ÖVER: ingen betygsdata finns — inga påhittade stjärnor.
 *
 * FUNKTIONEN ägs av modulen och tappas ALDRIG:
 *   · <AddToCart compact> per produkt — utom vid `paused`, då köp-CTA:erna INTE
 *     renderas. `compact` är modulens egen grid-form (goal-62 E3: ett klick = 1 st;
 *     flera varianter → knappen leder till produktsidan där valet hör hemma).
 *   · `paused` → tydlig stängt-notis (role="status").
 *   · Priser via formatShopPrice, leveranslöfte via fulfilmentPromise + labeln.
 *   · Produktlänk /shop/{id} · blogglänk /blogg/{slug} (utan slug → olänkad).
 *   · limit → teaser-läge (rad + "Visa hela butiken"), tom + limit → null.
 *   · content.*-fallbackar är VERBATIM oförändrade (goal-61: editorns extraHome-fält
 *     måste matcha layoutens inbyggda strängar).
 *
 * SYNKRONA server-komponenter: all I/O är redan gjord (ingen async, ingen 'use client').
 */

/** Svenskt datum ("3 juni 2026"). Pure; null när datum saknas → raden utelämnas. */
function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Media-läget (goal-60, oförändrad funktion): bara en frilagd bild (png/webp/avif)
 * får sväva på plattan med silhuett-skugga — ett JPG-foto fyller plattan, annars blir
 * skuggan en fyrkant och illusionen dör. Filändelsen är den enda ärliga signalen vi
 * har vid render (ingen I/O i en synkron komponent).
 */
function mediaClass(imageUrl: string): string {
  const cutout = /\.(png|webp|avif)(\?|$)/i.test(imageUrl)
  const base = styles.img ?? ''
  return cutout ? `${base} ${styles.imgFloat ?? ''}`.trim() : base
}

/**
 * Slutsåld = ALLA varianter har available === 0. Samma sanning som AddToCart:s egen
 * allSoldOut-gren (den ritar sin disabled-knapp) — etiketten här är bara skyltningen
 * av samma data, aldrig en egen lagerlogik. null = ospårat lager = köpbart.
 */
function isSoldOut(p: ShopProduct): boolean {
  return p.variants.length > 0 && p.variants.every((v) => v.available === 0)
}

/**
 * Kronbladet — ETT ritat inline-SVG-blad (vesica-form) som återanvänds av brevets
 * rader, hörnsymbolen och det tomma produktmonogrammet. currentColor → färgen sätts
 * av CSS-tokens, aldrig av SVG:n själv.
 */
const PETAL_D = 'M10 0 C3.5 8.5 3.5 19 10 28 C16.5 19 16.5 8.5 10 0 Z'

/**
 * Kronbladsraderna — biljettens ♪♪♪-lager (uiverse rad 14590) som blomsterspråk.
 * Tre staplade rader, varannan förskjuten; ETT <path> per rad (subpaths) så DOM:en
 * inte sväller med 15 noder per brev. Ren dekor: aria-hidden.
 */
function LetterPetals() {
  const rows = [30, 110, 190]
  const d = rows
    .map((y, r) =>
      Array.from({ length: 6 }, (_, i) => {
        const x = 12 + i * 62 + (r % 2) * 31
        // Translatera vesica-formen till (x, y) — samma blad, ny plats.
        return `M${x + 10} ${y} C${x + 3.5} ${y + 8.5} ${x + 3.5} ${y + 19} ${x + 10} ${y + 28} C${x + 16.5} ${y + 19} ${x + 16.5} ${y + 8.5} ${x + 10} ${y} Z`
      }).join(' '),
    )
    .join(' ')
  return (
    <svg
      className={styles.petals}
      viewBox="0 0 380 240"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="currentColor" />
    </svg>
  )
}

/** Ett ensamt kronblad (hörnsymbol + tomt produktmonogram). Dekor: aria-hidden. */
function Petal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 28" aria-hidden="true" focusable="false">
      <path d={PETAL_D} fill="currentColor" />
    </svg>
  )
}

/** Inlägg utan slug renderas OLÄNKADE (legacy-rader) — annars länk till /blogg/{slug}. */
function PostShell({ post, children }: { post: BloggPost; children: React.ReactNode }) {
  if (!post.slug) return <div className={styles.letter}>{children}</div>
  return (
    <Link href={`/blogg/${post.slug}`} className={styles.letter}>
      {children}
    </Link>
  )
}

/* ═══════════════════════════ SKYLTBORDET (butiken) ═══════════════════════════ */

export function CalytrixShop({ data, paused, limit, moreHref, content, tenantName }: ThemeShopViewProps) {
  const { config, products: all } = data
  const products = typeof limit === 'number' ? all.slice(0, limit) : all
  const teaser = typeof limit === 'number'

  // Startsidans teaser för en tom (men live) butik → rendera ingenting alls.
  // Inga "visas snart"-löften till besökare (S12).
  if (teaser && all.length === 0 && !paused) return null

  const promise = fulfilmentPromise(config)
  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]

  const cards = products.map((p, i) => {
    const soldOut = isSoldOut(p)
    return (
      <div key={p.id} className={teaser ? styles.slot : undefined}>
        <article className={styles.plate}>
          {/* Radnumret — packbordets ordersblock-siffra. Dekor: aria-hidden. */}
          <span className={styles.plateNo} aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>

          {/* Bild + namn länkar till produktsidan — INTE hela kortet, så köpknappen
              nedanför förblir klickbar. */}
          <Link href={`/shop/${p.id}`} className={styles.mediaLink} aria-label={`${p.name} — visa produkt`}>
            <span className={styles.tilt}>
              <span className={styles.well}>
                {/* Badge-språket (rad 7807/8483): Slutsåld vinner över Populär —
                    skyltningen ljuger aldrig om lagret. */}
                {soldOut ? (
                  <span className={`${styles.tag} ${styles.tagSoldOut}`}>Slutsåld</span>
                ) : i < 3 ? (
                  <span className={styles.tag}>Populär</span>
                ) : null}
                {p.imageUrl ? (
                  // Shimret (rad 9884/9896) ligger i brunnen UNDER bilden: syns medan
                  // fotot laddar, täcks när det landat.
                  <span
                    className={mediaClass(p.imageUrl)}
                    style={{ backgroundImage: `url(${p.imageUrl})` }}
                    role="img"
                    aria-label={p.imageAlt ?? p.name}
                  />
                ) : (
                  // Utan bild bär vinplattan kortet själv (täcker shimret — ingen
                  // evig puls för något som aldrig kommer).
                  <span className={styles.bare} role="img" aria-label={p.imageAlt ?? p.name}>
                    <Petal />
                  </span>
                )}
              </span>
            </span>
          </Link>

          <div className={styles.body}>
            <h3 className={styles.name}>
              <Link href={`/shop/${p.id}`} className={styles.nameLink}>
                {p.name}
              </Link>
            </h3>
            {p.description ? <p className={styles.meta}>{p.description}</p> : null}

            {/* Foten (rad 8375: ordernow-raden): pris vänster, snabb-köp höger.
                Köp-rälsen: pausad butik renderar INGEN CTA (stängt är stängt). */}
            <div className={styles.foot}>
              <p className={styles.price}>{formatShopPrice(p.priceCents, p.currency)}</p>
              {paused ? null : (
                <div className={styles.buyDock}>
                  <AddToCart product={p} fulfilment={config.fulfilment} compact />
                </div>
              )}
            </div>
          </div>
        </article>
      </div>
    )
  })

  return (
    <section
      className={styles.root}
      data-module="shop"
      data-fulfilment={config.fulfilment}
      data-scene="skyltbordet"
    >
      {teaser ? (
        /* Teaser = samma plommonbord som ett BAND över hemmet. */
        <div className={`${styles.band} ${styles.section}`}>
          <Reveal className={styles.head} as="div">
            <div>
              <p className={styles.eyebrowDark}>{content.shopEyebrow ?? `— Webshop · ${label}`}</p>
              <h2 className={styles.titleDark}>{content.shopTitle ?? 'Beställ det alla vill ha'}</h2>
              {/* Leveranslöftet står direkt under rubriken, även i teaser-läget. */}
              <p className={styles.promiseDark}>{promise}</p>
            </div>
            {moreHref ? (
              <Link href={moreHref} className={styles.ctaDark}>
                {content.shopCta ?? 'Visa hela butiken'}
              </Link>
            ) : null}
          </Reveal>

          {paused ? (
            <div className={styles.noticeWrap}>
              <p role="status" className={styles.closed}>
                Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
              </p>
            </div>
          ) : null}

          {products.length > 0 ? <div className={styles.row}>{cards}</div> : null}
        </div>
      ) : (
        <>
          {/* Modulens EGEN sida: plommonplattan med SPÖKORDET bakom rubriken
              (rad 7807/8483 — den dubblerade texten, uppskalad till sidhuvud). */}
          <header className={styles.hero} data-ghost={content.shopTitle ?? `Handla hos ${tenantName}`}>
            <p className={styles.heroEyebrow}>— Webshop · {label}</p>
            <h1 className={styles.heroTitle}>{content.shopTitle ?? `Handla hos ${tenantName}`}</h1>
            {/* Leveranslöftet: sidhuvudets lede — det första besökaren läser. */}
            <p className={styles.heroLede}>{promise}</p>
          </header>

          {/* Bordet i full skala — heron och bordet är EN sammanhängande mörk yta. */}
          <div className={styles.board}>
            {paused ? (
              <div className={styles.noticeWrap}>
                <p role="status" className={styles.closed}>
                  Webshoppen är tillfälligt stängd för nya beställningar. Du kan se hela
                  sortimentet, men det går inte att beställa just nu. Vi öppnar igen snart.
                </p>
              </div>
            ) : null}

            {products.length === 0 ? (
              <div className={styles.noticeWrap}>
                <p className={styles.emptyDark}>
                  Sortimentet är tomt just nu. Hör gärna av dig — vi binder gärna något på
                  beställning.
                </p>
              </div>
            ) : (
              <div className={styles.grid}>{cards}</div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/* ═══════════════════════════ BREVEN (bloggen) ═══════════════════════════ */

export function CalytrixBlogg({ posts: all, limit, moreHref, content, tenantName }: ThemeBloggViewProps) {
  const posts = typeof limit === 'number' ? all.slice(0, limit) : all
  const teaser = typeof limit === 'number'

  if (teaser && all.length === 0) return null

  const cards = posts.map((p) => {
    const date = formatPostDate(p.publishedAt)
    return (
      <div key={p.id} className={teaser ? styles.slot : undefined}>
        <PostShell post={p}>
          <LetterPetals />
          <div className={styles.letterHead}>
            <span className={styles.letterKicker}>Brev från floristen</span>
            {/* Pressat kronblad i hörnet — biljettens ✁-symbol, i blomsterspråk. */}
            <Petal className={styles.letterSymbol} />
          </div>
          {p.coverImageUrl ? (
            <span className={styles.photoPlate}>
              <span
                className={styles.photo}
                style={{ backgroundImage: `url(${p.coverImageUrl})` }}
                role="img"
                aria-label={p.coverImageAlt ?? p.title}
              />
            </span>
          ) : null}
          {date ? <p className={styles.letterDate}>{date}</p> : null}
          <h3 className={styles.letterTitle}>{p.title}</h3>
          {p.excerpt ? <p className={styles.letterExcerpt}>{p.excerpt}</p> : null}
          {/* Riktningen i brevets fot — bara när kortet faktiskt är en länk. */}
          {p.slug ? <span className={styles.letterFoot}>Läs brevet</span> : null}
        </PostShell>
      </div>
    )
  })

  return (
    <section className={styles.root} data-module="blogg" data-scene="breven">
      {teaser ? (
        <div className={`${styles.paper} ${styles.section}`}>
          <Reveal className={styles.head} as="div">
            <div>
              <p className={styles.eyebrowLight}>{content.blogEyebrow ?? '— Från bloggen'}</p>
              <h2 className={styles.titleLight}>{content.blogTitle ?? 'Nytt från floristen'}</h2>
            </div>
            {moreHref ? (
              <Link href={moreHref} className={styles.ctaLight}>
                {content.blogCta ?? 'Läs hela bloggen'}
              </Link>
            ) : null}
          </Reveal>
          {posts.length > 0 ? <div className={styles.row}>{cards}</div> : null}
        </div>
      ) : (
        <>
          {/* Samma hero-anatomi som butiken (spökord + plommonplatta) — en butik,
              två rum. */}
          <header className={styles.hero} data-ghost={content.blogTitle ?? `Nytt från ${tenantName}`}>
            <p className={styles.heroEyebrow}>— Blogg</p>
            <h1 className={styles.heroTitle}>{content.blogTitle ?? `Nytt från ${tenantName}`}</h1>
            <p className={styles.heroLede}>Nyheter, tips och inspiration från butiken.</p>
          </header>

          <div className={`${styles.paper} ${styles.paperBody}`}>
            {posts.length === 0 ? (
              <div className={styles.noticeWrap}>
                <p className={styles.emptyLight}>Inga inlägg är publicerade ännu.</p>
              </div>
            ) : (
              <div className={styles.letters}>{cards}</div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
