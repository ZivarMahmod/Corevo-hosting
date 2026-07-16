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
import styles from './snitt.module.css'

/**
 * SNITT — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   HYLLAN (butik) — filens `showButik`: tre spalter, 1:1-bilder, namn till vänster och
 *   pris i Anton-lime till höger, beskrivning under, "Lägg i korg" som inramad knapp i
 *   full bredd. Butiken är PAUSAD → katalogen läses, köpknapparna ritas inte alls.
 *
 *   JOURNAL (blogg) — filens `showJournal`: inläggen under varandra som 220px foto | text,
 *   taggen och datumet i lime mikroversal, rubriken i Anton-versaler.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ══════════════════════════════════ HYLLAN ════════════════════════════════════ */

export function SnittShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Filterraden hör till butikssidan, inte teasern.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.snShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={styles.snEyebrow}>
        <span className={styles.snDash}>—</span> {content.shopEyebrow ?? 'Butik'}
      </p>
      <h1 className={styles.snPageTitle}>
        {content.shopTitle ?? 'Hyllan'}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>
      <p className={styles.snPageLede}>
        Det vi jobbar med vid stolarna. Inget vi inte själva har hemma.
      </p>

      {/* KATEGORI-FILTER (goal-64, migration 0057) — filens rad 278-281: fyrkantiga chips,
          12px versal med 0.12em spärr, 1px kant. Vald = limegrön platta med svart text.
          Kunden har inga kategorier → ingen rad (aldrig ett påhittat "Styling"). */}
      {chips.length > 0 ? (
        <div className={styles.snFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.snFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.snNotice}>
          Hyllan är tillfälligt stängd för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.snEmpty}>
          {data.activeCategory
            ? `Inget i ${data.activeCategory} just nu.`
            : 'Hyllan är tom just nu.'}
        </p>
      ) : (
        <ul className={styles.snShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.snCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.snShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.snSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.snCardBody}>
                <div className={styles.snShopHead}>
                  <h3 className={styles.snShopName}>
                    <a href={`/shop/${p.id}`}>{p.name}</a>
                  </h3>
                  {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                  <span className={styles.snShopPrice}>{formatProductPrice(p)}</span>
                </div>
                {p.description ? <p className={styles.snShopDesc}>{p.description}</p> : null}
                {/* Pausad butik → NOLL köpknappar. Katalogen är läsbar, kassan är stängd. */}
                {paused ? null : <AddToCart product={p} fulfilment={config.fulfilment} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.snShopMore}>
          <a href={moreHref} className={styles.snLink}>
            {content.shopCta ?? 'Hela hyllan →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ JOURNAL ════════════════════════════════════ */

export function SnittBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.snBlogg} data-module="blogg">
      <p className={styles.snEyebrow}>
        <span className={styles.snDash}>—</span> {content.blogEyebrow ?? 'Ur stolen'}
      </p>
      <h1 className={styles.snPageTitleAlone}>
        {content.blogTitle ?? 'Journal'}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>

      {posts.length === 0 ? (
        <p className={styles.snEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.snPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.snPost}>
                  <span
                    className={styles.snPostPhoto}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <span className={styles.snPostBody}>
                    {/* Filen: "{{ b.tag }} · {{ b.date }}" i lime mikroversal. Taggen = blog_posts.tag. */}
                    {p.tag || date ? (
                      <span className={styles.snPostMeta}>
                        {[p.tag, date].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    <span className={styles.snPostTitle}>{p.title}</span>
                    {p.excerpt ? <span className={styles.snPostExcerpt}>{p.excerpt}</span> : null}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.snBloggMore}>
          <a href={moreHref} className={styles.snLink}>
            {content.blogCta ?? 'Hela journalen →'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ STOLARNA ══════════════════════════════ */

/**
 * Filens `showTeam`: tre mörka kort (#1D1D1A) med 4:5-porträtt i topp, namnet i Anton
 * VERSAL, rollen i lime, och en lime "Boka <namn>"-platta. Rubriken är Anton 64px med
 * limepunkt — punkten ÄR Snitts signatur, den sitter på varje sidrubrik.
 *
 * OWNER-ONLY: tom lista → INGENTING. Aldrig stock-ansikten som salongens folk.
 * TEAMKORTET FÖRIFYLLER BOKNINGEN: /boka?personal=<id> (designens bookAs()).
 */
export function SnittTeam({ members, content }: ThemeTeamViewProps) {
  if (members.length === 0) return null

  return (
    <section className={styles.snTeamPage} data-module="team">
      <p className={styles.snPageEyebrow}>
        <span className={styles.snDash}>—</span> <span>{content.teamEyebrow}</span>
      </p>
      <h1 className={styles.snPageTitle}>
        {content.teamTitle}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>
      <div className={styles.snTeamGrid}>
        {members.map((m) => (
          <article key={m.id} className={styles.snTeamCard}>
            {m.imageUrl ? (
              <div
                className={styles.snTeamPhoto}
                role="img"
                aria-label={m.name}
                style={{ backgroundImage: `url(${m.imageUrl})` }}
              />
            ) : (
              <div className={styles.snTeamPhoto} />
            )}
            <div className={styles.snTeamBody}>
              <h2 className={styles.snTeamName}>{m.name}</h2>
              {m.title && m.title !== m.name ? (
                <p className={styles.snTeamRoll}>{m.title}</p>
              ) : null}
              {m.bio ? <p className={styles.snTeamBio}>{m.bio}</p> : null}
              {m.specialties ? <p className={styles.snTeamSpec}>{m.specialties}</p> : null}
              <a href={`/boka?personal=${m.id}`} className={styles.snTeamBook}>
                Boka {m.shortName ?? m.name}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ══════════════════════════════════ GALLERI ═══════════════════════════════ */

/**
 * Filens `showGalleri`: tre spalter, 4:5, 14px springa — och under varje bild en
 * lime-slash + kategorin i spärrad versal. Inga bildtexter, bara arbeten.
 */
export function SnittGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.snGalleri} data-module="galleri">
      <p className={styles.snPageEyebrow}>
        <span className={styles.snDash}>—</span>{' '}
        <span>{content.galleryEyebrow ?? 'Arbeten ur stolen'}</span>
      </p>
      <h1 className={styles.snPageTitle}>
        {content.galleryTitle ?? 'Galleri'}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>

      {items.length === 0 ? (
        <p className={styles.snEmptyLine}>Inga arbeten är publicerade ännu.</p>
      ) : (
        <div className={styles.snGalGrid}>
          {items.map((g) => (
            <div key={g.id}>
              {g.imageUrl ? (
                <div
                  className={styles.snGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{ backgroundImage: `url(${g.imageUrl})` }}
                />
              ) : null}
              {g.tag ? (
                <p className={styles.snGalTag}>
                  <span className={styles.snSlash}>/</span> {g.tag}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ══════════════════════════════════ INSIDAN ═══════════════════════════════ */

/**
 * Filens `showKlubb`: stamkortet som en LIME platta till vänster (1.1fr) och förmånerna
 * numrerade 01–04 till höger, med anmälan under. Svart text på lime — Snitts enda ljusa yta.
 *
 * AVVIKELSE (medveten): designens kort trycker "N° 0417" och salongens adress. Vi har
 * varken medlemsnummer för en besökare som inte gått med eller rätt att trycka en påhittad
 * gata — kortet bär i stället salongens NAMN, och understraden är ägarens egen (clubNote).
 */
export function SnittLojalitet({ config, plans, content, tenantName }: ThemeLojalitetViewProps) {
  const perks = config.perks ?? []
  const title = content.clubTitle ?? 'Insidan'

  return (
    <section className={styles.snClub} data-module="lojalitet" data-variant={config.variant}>
      <p className={styles.snPageEyebrow}>
        <span className={styles.snDash}>—</span> <span>{content.clubEyebrow ?? 'Stamkund'}</span>
      </p>
      <h1 className={styles.snPageTitle}>
        {title}
        <span className={styles.snDot} data-corevo-editor-decoration>.</span>
      </h1>
      <p className={styles.snClubLede}>
        {content.clubLede ??
          'Gratis att gå med. Byggd för dig som kommer tillbaka var sjätte vecka ändå.'}
      </p>

      <div className={styles.snClubGrid}>
        <div className={styles.snCard}>
          <div className={styles.snCardTop}>
            <p className={styles.snCardWordmark}>
              {tenantName} · {title}
            </p>
          </div>
          <p className={styles.snCardBig}>Stamkort</p>
          <p className={styles.snCardSub}
            data-corevo-editor-field="clubNote"
            data-corevo-editor-stable-field="clubNote"
            hidden={!content.clubNote}>{content.clubNote ?? ''}</p>
        </div>

        <div>
          {perks.map((perk, i) => (
            <div key={perk} className={styles.snPerkRow}>
              <span className={styles.snPerkNo}>{String(i + 1).padStart(2, '0')}</span>
              <p>{perk}</p>
            </div>
          ))}

          {plans.map((p) => (
            <div key={p.id} className={styles.snPerkRow} data-featured={p.featured ? 'true' : undefined}>
              <span className={styles.snPerkNo}>{formatPlanPrice(p.priceCents)}</span>
              <p>
                <strong>{p.name}</strong> — {loyaltyIntervalLabel(p.interval)}
                {p.perks.length > 0 ? ` · ${p.perks.join(' · ')}` : ''}
              </p>
            </div>
          ))}

          <div className={styles.snClubJoin}>
            <JoinClubForm cta={content.clubCta ?? 'Gå med gratis'} />
          </div>
        </div>
      </div>
    </section>
  )
}
