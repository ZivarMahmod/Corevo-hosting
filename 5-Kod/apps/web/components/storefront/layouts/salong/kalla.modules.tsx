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
import styles from './kalla.module.css'

/**
 * KÄLLA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart>. Formen är mallens, exakt som .dc.html ritar den:
 *
 *   APOTEKET (butik) — filens `showButik`: eyebrow "Det vi använder i behandlingarna",
 *   rubrik "Apoteket", tre kolumner med 1:1-bilder i kort på sandvit yta, kategori i spärrad
 *   mikroversal, namn i Marcellus, pris i teal, och "Lägg i varukorg" som konturknapp.
 *   KATEGORIFILTRET ÄR BYGGT (goal-64, migration 0057): shop_products.category finns nu, så
 *   både chip-raden och kategorimikroversalen över produktnamnet bär KUNDENS egna kategorier.
 *   Chipsen är <Link>-taggar (/shop?kategori=…) och filtreringen sker server-side — de fungerar
 *   utan JS. Har kunden inga kategorier renderas varken raden eller etiketten.
 *
 *   ANTECKNINGAR (blogg) — filens `showJournal`: liggande kort, 220px bild till vänster,
 *   datum i teal-mikroversal, rubrik i Marcellus, ingress i Karla.
 *
 * PAUSAD BUTIK: katalogen är läsbar, NOLL köpknappar (annars kunde en kund handla i en
 * stängd butik). SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

/* ═════════════════════════════════ APOTEKET ═══════════════════════════════ */

export function KallaShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  // Filens ord för det ofiltrerade urvalet är "Allt". Teasern har ingen filterrad i filen.
  const chips = teaser ? [] : shopCategoryChips(data, 'Allt')

  return (
    <section className={styles.kaPageShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.kaPageHead}>
        <p className={styles.kaEyebrow}>
          {content.shopEyebrow ?? 'Det vi använder i behandlingarna'}
        </p>
        <h1 className={styles.kaPageTitle}>{content.shopTitle ?? 'Apoteket'}</h1>
      </div>

      {/* KATEGORI-CHIPS — filens rad 247-250: centrerad rad, mjukt rundade (6px) chips i
          12.5px versal. Vald chip = teal platta. */}
      {chips.length > 0 ? (
        <div className={styles.kaFilters}>
          {chips.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={styles.kaFilter}
              data-active={c.active ? 'true' : undefined}
              aria-current={c.active ? 'page' : undefined}
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}

      {paused ? (
        <p role="status" className={styles.kaNotice}>
          Apoteket är tillfälligt stängt för beställningar. Vi öppnar igen snart.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.kaEmpty}>
          {data.activeCategory
            ? `Inget i ${data.activeCategory} just nu.`
            : 'Apoteket är litet men noga utvalt — hyllan fylls snart.'}
        </p>
      ) : (
        <ul className={styles.kaShopGrid}>
          {products.map((p) => (
            <li key={p.id} className={styles.kaShopCard}>
              <a
                href={`/shop/${p.id}`}
                className={styles.kaShopImg}
                aria-label={`${p.name} — visa produkten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.kaSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.kaShopBody}>
                {/* Filens `{{ p.cat }}` — kategorin i spärrad mikroversal över namnet.
                    Produkten saknar kategori → raden renderas inte (render-on-present). */}
                {p.category ? <p className={styles.kaShopCat}>{p.category}</p> : null}
                <h3 className={styles.kaShopName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </h3>
                {p.description ? <p className={styles.kaShopDesc}>{p.description}</p> : null}
                {/* formatProductPrice → "fr. X kr" när produkten bär price_from. */}
                <p className={styles.kaShopPrice}>{formatProductPrice(p)}</p>
                {paused ? null : (
                  <div className={styles.kaShopBuy}>
                    <AddToCart product={p} fulfilment={config.fulfilment} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <a href={moreHref} className={`${styles.kaGhost} ${styles.kaShopMore}`}>
          {content.shopCta ?? 'Till apoteket'}
        </a>
      ) : null}
    </section>
  )
}

/* ═══════════════════════════════ ANTECKNINGAR ═════════════════════════════ */

export function KallaBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.kaPage} data-module="blogg">
      <div className={styles.kaPageHead}>
        <h1 className={styles.kaPageTitle}>{content.blogTitle ?? 'Anteckningar'}</h1>
      </div>

      {posts.length === 0 ? (
        <p className={styles.kaEmpty}>Inga anteckningar är publicerade ännu.</p>
      ) : (
        <ul className={styles.kaBloggList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a href={p.slug ? `/blogg/${p.slug}` : '/blogg'} className={styles.kaBloggCard}>
                  <div
                    className={styles.kaBloggImg}
                    role={p.coverImageAlt ? 'img' : undefined}
                    aria-label={p.coverImageAlt ?? undefined}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <div className={styles.kaBloggBody}>
                    {/* Filen: "{{ b.tag }} · {{ b.date }}" i teal mikroversal. Taggen = blog_posts.tag. */}
                    {p.tag || date ? (
                      <p className={styles.kaBloggDate}>{[p.tag, date].filter(Boolean).join(' · ')}</p>
                    ) : null}
                    <h2 className={styles.kaBloggTitle}>{p.title}</h2>
                    {p.excerpt ? <p className={styles.kaBloggExcerpt}>{p.excerpt}</p> : null}
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <a href={moreHref} className={`${styles.kaTextLink} ${styles.kaShopMore}`}>
          {content.blogCta ?? 'Alla →'}
        </a>
      ) : null}
    </section>
  )
}

/* ════════════════════════════════ TERAPEUTER ══════════════════════════════ */

/**
 * Filens `showTeam`: tre runda porträtt (150px) på ljusa kort med 8px radie, namn i
 * Marcellus 26px, rollen som spärrad grön mikroversal, bio, specialiteter — och en
 * INRAMAD "Boka <namn>" som fylls grön vid hover.
 *
 * OWNER-ONLY: `members` är kundens EGEN personal (staff.show_on_site). Tom lista →
 * INGENTING renderas. Mallen visar aldrig stock-ansikten som om de vore salongens folk.
 *
 * TEAMKORTET FÖRIFYLLER BOKNINGEN: länken bär personens id (/boka?personal=<id>), precis
 * som designens bookAs() — kortet är en genväg in i bokningen, inte en affisch.
 */
export function KallaTeam({ members, content }: ThemeTeamViewProps) {
  if (members.length === 0) return null

  return (
    <section className={styles.kaTeamPage} data-module="team">
      <div className={styles.kaPageHead}>
        <p className={styles.kaPageEyebrow}>{content.teamEyebrow}</p>
        <h1 className={styles.kaPageTitle}>{content.teamTitle}</h1>
      </div>
      <div className={styles.kaTeamGrid}>
        {members.map((m) => (
          <article key={m.id} className={styles.kaTeamCard}>
            {m.imageUrl ? (
              <div
                className={styles.kaTeamPhoto}
                role="img"
                aria-label={m.name}
                style={{ backgroundImage: `url(${m.imageUrl})` }}
              />
            ) : null}
            <h2 className={styles.kaTeamName}>{m.name}</h2>
            {m.title && m.title !== m.name ? (
              <p className={styles.kaTeamRoll}>{m.title}</p>
            ) : null}
            {m.bio ? <p className={styles.kaTeamBio}>{m.bio}</p> : null}
            {m.specialties ? <p className={styles.kaTeamSpec}>{m.specialties}</p> : null}
            <a href={`/boka?personal=${m.id}`} className={styles.kaTeamBook}>
              Boka {m.shortName ?? m.name}
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ══════════════════════════════════ RUMMET ════════════════════════════════ */

/**
 * Filens `showGalleri`: "Rummet" — tre spalter, 4:5-bilder med 8px radie, och bildtexten
 * under som spärrad grå mikroversal. Salongen visar sitt rum, inte sina kunder.
 *
 * Eyebrown i filen är salongens ADRESS ("Bondegatan 11"). Den är kundens, inte mallens —
 * vi trycker aldrig en påhittad gata. Raden visas därför bara när ägaren skrivit sin.
 */
export function KallaGalleri({ items, content }: ThemeGalleriViewProps) {
  return (
    <section className={styles.kaGalleri} data-module="galleri">
      <div className={styles.kaPageHead}>
        {content.galleryEyebrow ? (
          <p className={styles.kaPageEyebrow}>{content.galleryEyebrow}</p>
        ) : null}
        <h1 className={styles.kaPageTitle}>{content.galleryTitle ?? 'Rummet'}</h1>
      </div>

      {items.length === 0 ? (
        <p className={styles.kaEmptyLine}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.kaGalGrid}>
          {items.map((g) => (
            <div key={g.id}>
              {g.imageUrl ? (
                <div
                  className={styles.kaGalImg}
                  role="img"
                  aria-label={g.imageAlt ?? g.caption ?? ''}
                  style={{ backgroundImage: `url(${g.imageUrl})` }}
                />
              ) : null}
              {g.caption ? <p className={styles.kaGalCap}>{g.caption}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ═══════════════════════════════ RITUALKLUBBEN ════════════════════════════ */

/**
 * Filens `showKlubb`: tre nivåkort (Droppe · Källa · Flod) där den vanligaste ligger på
 * den mörkgröna ytan och bär etiketten "Vanligast". Priset i Marcellus, förmånerna som
 * rader, och en knapp per nivå.
 *
 * Nivåerna är DATA (loyalty_plans, 0057) — inte mallens. Inga nivåer → inga kort: ett
 * påhittat pris är ett löfte kunden aldrig gett. Priset visas, det dras inte; knappen
 * skickar en medlemsanmälan för nivån (joinLoyaltyClub), och betal-rälsen byggs separat.
 */
export function KallaLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  return (
    <section className={styles.kaClub} data-module="lojalitet" data-variant={config.variant}>
      <div className={styles.kaPageHead}>
        <p className={styles.kaPageEyebrow}>
          {content.clubEyebrow ?? 'Månadsvis · Ingen bindningstid'}
        </p>
        <h1 className={styles.kaPageTitle}>{content.clubTitle ?? 'Ritualklubben'}</h1>
        <p className={styles.kaClubLede}>
          {content.clubLede ??
            'Håret mår bäst av regelbundenhet. Välj en rytm — pausa när livet vill annat.'}
        </p>
      </div>

      {plans.length === 0 ? (
        <p className={styles.kaEmptyLine}>Klubbens nivåer öppnar snart.</p>
      ) : (
        <div className={styles.kaPlans}>
          {plans.map((p) => (
            <div
              key={p.id}
              className={styles.kaPlan}
              data-featured={p.featured ? 'true' : undefined}
            >
              <p className={styles.kaPlanTag}>{p.featured ? 'Vanligast' : ' '}</p>
              <h3 className={styles.kaPlanName}>{p.name}</h3>
              <p className={styles.kaPlanPrice}>
                {formatPlanPrice(p.priceCents)} / {loyaltyIntervalLabel(p.interval).replace('per ', '')}
              </p>
              <div className={styles.kaPlanPerks}>
                {p.perks.map((perk) => (
                  <p key={perk}>{perk}</p>
                ))}
              </div>
              <div className={styles.kaPlanJoin}>
                <JoinClubForm planId={p.id} cta={`Välj ${p.name}`} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
