import { AddToCart } from '../../shop/AddToCart'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatProductPrice, shopCategoryChips } from '@/lib/storefront/shop/types'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
  ThemeTeamViewProps,
} from './types'
import styles from './siluett.module.css'

/**
 * SILUETT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   BUTIKEN (showButik) — eyebrow "Det vi själva använder vid stolen", Bodoni-h1 58px,
 *   TRE spalter med 1:1-foto, hårlinje under fotot, namn i Bodoni + pris i grotesk på
 *   samma baslinje, och "Lägg i kasse" som hårlinje-knapp. Inga rundade hörn, inga skuggor.
 *   Filens kategori-filter (Allt/Schampo/Vård/Styling) är BYGGT (goal-64, migration 0057):
 *   shop_products.category finns nu, chipsen är <Link>-taggar mot /shop?kategori=… och urvalet
 *   filtreras server-side. Kategorierna är KUNDENS egna, aldrig filens mockade ord — har kunden
 *   inga kategorier renderas ingen filterrad.
 *
 *   JOURNAL (showJournal) — 2px-linje överst, sedan rader: text till vänster (datum i
 *   elviolett mikroversal, Bodoni-rubrik 30px, ingress), 3:2-bild till höger.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═══════════════════════════════════ BUTIKEN ══════════════════════════════ */

export function SiluettShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Chipsen visas bara på butikssidan —
  // hemmets teaser har ingen filterrad i filen.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.siShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.siEyebrow}>
        {content.shopEyebrow ?? 'Det vi själva använder vid stolen'}
      </p>
      <h1 className={styles.siShopTitle}>{content.shopTitle ?? 'Butiken'}</h1>

      {/* FILTERRADEN — filens form: bara text, versal mikroskrift, 2px understrykning i
          elviolett under den valda. Ingen ram, ingen platta. */}
      {chips.length > 0 ? (
        <div className={styles.siFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.siFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {/* Pausad butik: katalogen är läsbar, köp-CTA:erna stängda. Modulens regel, inte mallens. */}
      {paused ? (
        <p role="status" className={styles.siNotice}>
          Butiken är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.siEmpty}>
          {data.activeCategory
            ? `Inga produkter i ${data.activeCategory} just nu.`
            : 'Butiken är tom just nu.'}
        </p>
      ) : (
        <ul className={styles.siShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.siShopCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.siShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.siSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.siShopBody}>
                <div className={styles.siShopHead}>
                  <h3 className={styles.siShopName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  {/* formatProductPrice → "fr. 950 kr" när produkten bär price_from. */}
                  <span className={styles.siShopPrice}>{formatProductPrice(p)}</span>
                </div>
                {p.description ? <p className={styles.siShopDesc}>{p.description}</p> : null}
                {paused ? null : (
                  <div className={styles.siShopBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.siUnderline} ${styles.siMoreLink}`}>
          {content.shopCta ?? 'Hela butiken →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════════ JOURNAL ══════════════════════════════ */

export function SiluettBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.siBlogg} data-module="blogg">
      <h1 className={styles.siPageTitle}>{content.blogTitle ?? 'Journal'}</h1>

      {posts.length === 0 ? (
        <p className={styles.siEmpty}>Inga texter är publicerade ännu.</p>
      ) : (
        <ul className={styles.siPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : undefined} className={styles.siPostRow}>
                  <div>
                    {/* Filens metarad: "{{ b.tag }} · {{ b.date }}". Taggen = blog_posts.tag (0057);
                        saknas den står bara datumet, saknas båda renderas ingen rad. */}
                    {p.tag || date ? (
                      <p className={styles.siPostMeta}>{[p.tag, date].filter(Boolean).join(' · ')}</p>
                    ) : null}
                    <h2 className={styles.siPostTitle}>{p.title}</h2>
                    {p.excerpt ? <p className={styles.siPostExcerpt}>{p.excerpt}</p> : null}
                  </div>
                  <div
                    className={styles.siPostPhoto}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                    role={p.coverImageAlt ? 'img' : undefined}
                    aria-label={p.coverImageAlt ?? undefined}
                  />
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.siUnderline} ${styles.siMoreLink}`}>
          {content.blogCta ?? 'Alla texter →'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════════ TEAMET ═══════════════════════════════ */

/**
 * Filens `showTeam`: TVÅ spalter, varje person en rad med 220px stående porträtt (3:4)
 * till vänster och texten till höger, under en 2px svart linjal. Namnet i Bodoni KURSIV,
 * rollen som spärrad violett mikroversal, och en svart "Boka <kortnamn>" som blir violett.
 *
 * OWNER-ONLY: tom lista → INGENTING. Aldrig stock-ansikten som salongens folk.
 * TEAMKORTET FÖRIFYLLER BOKNINGEN: /boka?personal=<id> (designens bookAs()).
 */
export function SiluettTeam({ members, content }: ThemeTeamViewProps) {
  if (members.length === 0) return null

  return (
    <section className={styles.siTeamPage} data-module="team">
      <p className={styles.siPageEyebrow}>{content.teamEyebrow}</p>
      <h1 className={styles.siPageTitle}>{content.teamTitle}</h1>
      <div className={styles.siTeamGrid}>
        {members.map((m) => (
          <article key={m.id} className={styles.siTeamRow}>
            {m.imageUrl ? (
              <div
                className={styles.siTeamPhoto}
                role="img"
                aria-label={m.name}
                style={{ backgroundImage: `url(${m.imageUrl})` }}
              />
            ) : (
              <div className={styles.siTeamPhoto} />
            )}
            <div>
              <h2 className={styles.siTeamName}>{m.name}</h2>
              {m.title && m.title !== m.name ? (
                <p className={styles.siTeamRoll}>{m.title}</p>
              ) : null}
              {m.bio ? <p className={styles.siTeamBio}>{m.bio}</p> : null}
              {m.specialties ? <p className={styles.siTeamSpec}>{m.specialties}</p> : null}
              <a href={`/boka?personal=${m.id}`} className={styles.siTeamBook}>
                Boka {m.shortName ?? m.name}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ══════════════════════════════════ ARKIVET ═══════════════════════════════ */

/**
 * Filens `showGalleri`: "Arkivet" — tre spalter, bildens proportion per verk (3:4 eller
 * 1:1), och under bilden en rad med verkets nummer i Bodoni-kursiv violett till vänster
 * och kategorin som spärrad versal till höger. Modemagasinets bildregister.
 */
export function SiluettGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.siGalleri} data-module="galleri">
      <p className={styles.siPageEyebrow}>{content.galleryEyebrow ?? 'Utvalda arbeten · SS26'}</p>
      <h1 className={styles.siPageTitle}>{content.galleryTitle ?? 'Arkivet'}</h1>

      {items.length === 0 ? (
        <p className={styles.siEmptyLine}>Inga arbeten är publicerade ännu.</p>
      ) : (
        <div className={styles.siGalGrid}>
          {items.map((g) => (
            <div key={g.id}>
              {g.imageUrl ? (
                <div
                  className={styles.siGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{
                    backgroundImage: `url(${g.imageUrl})`,
                    aspectRatio: g.aspectRatio ?? '3/4',
                  }}
                />
              ) : null}
              {g.caption || g.tag ? (
                <div className={styles.siGalMeta}>
                  <span className={styles.siGalNo}>{g.caption}</span>
                  <span className={styles.siGalTag}>{g.tag}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ═══════════════════════════════ FÖRSTA RADEN ═════════════════════════════ */

const SI_ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'] as const

/**
 * Filens `showKlubb`: medlemskortet i svart till vänster (1.1fr) och förmånerna som en
 * numrerad lista (i–iv, Bodoni-kursiv violett) till höger, med anmälan under.
 *
 * AVVIKELSE (medveten): designens kort trycker "Medlem N°204" och salongens adress. Vi har
 * varken medlemsnummer för en besökare som inte gått med eller rätt att trycka en påhittad
 * gata — kortet bär i stället salongens NAMN i samma Bodoni-kursiv, och understraden är
 * ägarens egen (clubNote). Formen är filens; påståendena är kundens.
 */
export function SiluettLojalitet({ config, plans, content, tenantName }: ThemeLojalitetViewProps) {
  const perks = config.perks ?? []
  const title = content.clubTitle ?? 'Första raden'

  return (
    <section className={styles.siClub} data-module="lojalitet" data-variant={config.variant}>
      <h1 className={styles.siPageTitle}>{title}</h1>
      <p className={styles.siClubLede}>
        {content.clubLede ??
          'Vår kundkrets med plats längst fram. Gratis att stå med — men kön är verklig.'}
      </p>

      <div className={styles.siClubGrid}>
        <div className={styles.siCard}>
          <div className={styles.siCardTop}>
            <p className={styles.siCardEyebrow}>{title}</p>
          </div>
          <p className={styles.siCardName}>{tenantName}</p>
          <p className={styles.siCardSub}
            data-corevo-editor-field="clubNote"
            data-corevo-editor-stable-field="clubNote"
            hidden={!content.clubNote}>{content.clubNote ?? ''}</p>
        </div>

        <div>
          {perks.map((perk, i) => (
            <div key={perk} className={styles.siPerkRow}>
              <span className={styles.siPerkNo}>{SI_ROMAN[i] ?? String(i + 1)}</span>
              <p>{perk}</p>
            </div>
          ))}

          {plans.map((p) => (
            <div key={p.id} className={styles.siPerkRow} data-featured={p.featured ? 'true' : undefined}>
              <span className={styles.siPerkNo}>{formatPlanPrice(p.priceCents)}</span>
              <p>
                <strong>{p.name}</strong> — {loyaltyIntervalLabel(p.interval)}
                {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
              </p>
            </div>
          ))}

          <div className={styles.siClubJoin}>
            <JoinClubForm cta={content.clubCta ?? 'Ställ mig på listan'} />
          </div>
        </div>
      </div>
    </section>
  )
}
