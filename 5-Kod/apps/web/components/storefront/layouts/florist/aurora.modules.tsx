import { AddToCart } from '../../shop/AddToCart'
import { JoinClubForm } from '../../lojalitet/JoinClubForm'
import { formatProductPrice } from '@/lib/storefront/shop/types'
import { formatPlanPrice, loyaltyIntervalLabel } from '@/lib/storefront/lojalitet/types'
import type { GalleryItem } from '@/lib/storefront/galleri/types'
import type {
  ThemeShopViewProps,
  ThemeBloggViewProps,
  ThemeGalleriViewProps,
  ThemeLojalitetViewProps,
} from './types'
import styles from './aurora.module.css'

/**
 * AURORA — MODUL-VYER (goal-64, vektor-regeln).
 *
 * Modulen äger FUNKTIONEN: datan är laddad, livscykeln gatad, köp-rälsen är fortfarande
 * <AddToCart> och priset formateras alltid av formatProductPrice. Formen är mallens, exakt som
 * .dc.html ritar den:
 *
 * PRISET: filens `p6` ("Floristens val") skrivs "fr. 349 kr" — ett GOLVPRIS, inte ett fast.
 * Det är nu shop_products.price_from (migration 0057) och prefixet sätts av formatProductPrice,
 * inte av mallen: bär produkten flaggan skriver ALLA mallar "fr.", aldrig bara den här.
 *
 *   BUTIKEN (showButik) — centrerat huvud ("Handbundet, varje morgon"), tre kolumner,
 *   4:5-bilder utan radie, namn + pris på samma baslinje, och en INRAMAD "Lägg i korgen"
 *   som fylls terracotta vid hover. Inga kort, inga skuggor.
 *
 *   BLOGGEN (showBlogg) — vita rader i en smal spalt (1000px): 260px-bild till vänster,
 *   datum i spärrad terracotta, rubrik i Lora, och "läs mer →" i kursiv. Raden lyfter med
 *   en varm skugga vid hover.
 *
 * PAUSAD BUTIK: katalogen förblir läsbar, köpknapparna försvinner. En kund ska aldrig kunna
 * handla i en stängd butik.
 *
 * SYNKRONA server-komponenter. Ingen async, ingen 'use client'.
 */

function formatPostDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ═════════════════════════════════ BUTIKEN ════════════════════════════════ */

export function AuroraShop({ data, paused, limit, moreHref, content }: ThemeShopViewProps) {
  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  const teaser = typeof limit === 'number'

  // Teaser + tom (och inte pausad) butik → rendera ingenting. Inga "visas snart"-löften.
  if (teaser && allProducts.length === 0 && !paused) return null

  return (
    <section className={styles.auShop} data-module="shop" data-fulfilment={config.fulfilment}>
      <div className={styles.auPageHead}>
        <p className={styles.auEyebrow}>{content.shopEyebrow ?? 'Butiken'}</p>
        <h1 className={styles.auPageTitle}>{content.shopTitle ?? 'Handbundet, varje morgon'}</h1>
        <p className={styles.auPageLede}>
          Lägg det du vill ha i korgen — vi binder allt samma dag som det levereras.
        </p>
      </div>

      {paused ? (
        <p role="status" className={styles.auNotice}>
          Butiken är tillfälligt stängd för nya beställningar. Vi öppnar snart igen.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className={styles.auEmpty}>Butiken är tom just nu.</p>
      ) : (
        <ul className={styles.auShopGrid}>
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={`/shop/${p.id}`}
                className={styles.auProdImg}
                aria-label={`${p.name} — visa buketten`}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                <span className={styles.auSrOnly}>{p.imageAlt ?? p.name}</span>
              </a>
              <div className={styles.auProdRow}>
                <p className={styles.auProdName}>
                  <a href={`/shop/${p.id}`}>{p.name}</a>
                </p>
                <p className={styles.auProdPrice}>{formatProductPrice(p)}</p>
              </div>
              {p.description ? <p className={styles.auProdDesc}>{p.description}</p> : null}
              {paused ? null : (
                <div className={styles.auBuyFramed}>
                  <AddToCart product={p} fulfilment={config.fulfilment} compact />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {moreHref && (clipped || teaser) && allProducts.length > 0 ? (
        <p className={styles.auSecFoot}>
          <a href={moreHref} className={styles.auBtnOutline}>
            {content.shopCta ?? 'Hela sortimentet'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ═════════════════════════════════ BLOGGEN ════════════════════════════════ */

export function AuroraBlogg({ posts: allPosts, limit, moreHref, content }: ThemeBloggViewProps) {
  const teaser = typeof limit === 'number'
  const posts = teaser ? allPosts.slice(0, limit) : allPosts

  if (teaser && allPosts.length === 0) return null

  return (
    <section className={styles.auBlogg} data-module="blogg">
      <div className={styles.auPageHead}>
        <p className={styles.auEyebrow}>{content.blogEyebrow ?? 'Bloggen'}</p>
        <h1 className={styles.auPageTitle}>{content.blogTitle ?? 'Från studion'}</h1>
      </div>

      {posts.length === 0 ? (
        <p className={styles.auEmpty}>Inga inlägg är publicerade ännu.</p>
      ) : (
        <ul className={styles.auPostList}>
          {posts.map((p) => {
            const date = formatPostDate(p.publishedAt)
            return (
              <li key={p.id}>
                <a
                  href={p.slug ? `/blogg/${p.slug}` : '/blogg'}
                  className={styles.auPostCardWide}
                >
                  <span
                    className={styles.auPostImg}
                    style={
                      p.coverImageUrl ? { backgroundImage: `url(${p.coverImageUrl})` } : undefined
                    }
                  />
                  <span>
                    {date ? (
                      <span className={styles.auPostDate} style={{ display: 'block' }}>
                        {date}
                      </span>
                    ) : null}
                    <span className={styles.auPostTitleWide} style={{ display: 'block' }}>
                      {p.title}
                    </span>
                    {p.excerpt ? (
                      <span className={styles.auPostExcerptWide} style={{ display: 'block' }}>
                        {p.excerpt}
                      </span>
                    ) : null}
                    <span className={styles.auPostMore}>läs mer →</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {moreHref && teaser && allPosts.length > 0 ? (
        <p className={styles.auSecFoot}>
          <a href={moreHref} className={styles.auBtnOutline}>
            {content.blogCta ?? 'Läs fler inlägg'}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/* ══════════════════════════════════ GALLERI ═══════════════════════════════ */

/**
 * Filens `showGalleri`: TRE spalter i murverk, mittenspalten nedskjuten 56px, och
 * bågarna — 210px-radie upptill eller nedtill på var tredje bild — som är hela Auroras
 * signatur. Rubriken är centrerad, Lora 48px.
 *
 * AVVIKELSE (medveten): designens nio brickor har HÅRDKODADE höjder och bågar, en per
 * bild. Kundens galleri har N bilder, inte nio. Rytmen är därför lyft som en CYKEL
 * (höjd + båge var tredje bricka, exakt filens värden i exakt filens ordning) — de nio
 * första brickorna blir byte-identiska med paketet, och en tionde bild fortsätter i takt
 * i stället för att spränga rutnätet.
 */
export function AuroraGalleri({ items, content }: ThemeGalleriViewProps) {
  // Tre spalter, bilderna fördelade i tur och ordning (kolumn 0, 1, 2, 0 …) så murverket
  // fylls uppifrån och ner precis som i filen.
  const columns: GalleryItem[][] = [[], [], []]
  items.forEach((it, i) => columns[i % 3]!.push(it))

  return (
    <section className={styles.auGalleri} data-module="galleri">
      <div className={styles.auGalHead}>
        <p className={styles.auGalEyebrow}>{content.galleryEyebrow ?? 'Galleri'}</p>
        <h1 className={styles.auGalTitle}>{content.galleryTitle ?? 'Ur studions dagbok'}</h1>
      </div>

      {items.length === 0 ? (
        <p className={styles.auGalEmpty}>Inga bilder är publicerade ännu.</p>
      ) : (
        <div className={styles.auGalGrid}>
          {columns.map((col, ci) => (
            <div key={ci} className={styles.auGalCol}>
              {col.map((g) =>
                g.imageUrl ? (
                  <div
                    key={g.id}
                    className={styles.auGalTile}
                    role="img"
                    aria-label={g.imageAlt ?? g.caption ?? ''}
                    style={{ backgroundImage: `url(${g.imageUrl})` }}
                  />
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}

      <p className={styles.auGalFoot}
        data-corevo-editor-field="galleryLede"
        data-corevo-editor-stable-field="galleryLede"
        hidden={!content.galleryLede}>{content.galleryLede ?? ''}</p>
    </section>
  )
}

/* ═════════════════════════════════ KLUBBEN ════════════════════════════════ */

/**
 * Filens `showKlubben`: stämpelkortet på vit yta, förmånerna i tre spalter med hårlinje
 * ovanför, och anmälan i det rosa fältet (#F3DED4 = accent-soft).
 *
 * ÄRLIGHET FÖRE MOCK: designens kort visar "3 av 9" ifyllda stämplar. Vi vet inte vem som
 * tittar — det finns ingen inloggad medlem i den publika vyn — så vi ritar kortets TOMMA
 * rutor (config.stampGoal stycken) och påstår ingen progress. Förmånerna kommer ur
 * klubbens config (`perks`); har ägaren inga → ingen förmånsrad, aldrig tre påhittade.
 */
export function AuroraLojalitet({ config, plans, content }: ThemeLojalitetViewProps) {
  const stamps = config.variant === 'stamp_card' ? Array.from({ length: config.stampGoal }) : []

  return (
    <section className={styles.auClub} data-module="lojalitet" data-variant={config.variant}>
      <div className={styles.auGalHead}>
        <p className={styles.auGalEyebrow}>{content.clubEyebrow ?? 'Blomsterklubben'}</p>
        <h1 className={styles.auClubTitle}>
          {content.clubTitle ?? 'Var nionde bukett bjuder vi på'}
        </h1>
        <p className={styles.auClubLede}>{content.clubLede ?? config.perkText}</p>
      </div>

      {stamps.length > 0 ? (
        <div className={styles.auStampCard}>
          <p className={styles.auStampLabel}>Ditt stämpelkort</p>
          <div className={styles.auStampRow}>
            {stamps.map((_, i) => (
              <span key={i} className={styles.auStamp}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {config.perks && config.perks.length > 0 ? (
        <div className={styles.auClubPerks}>
          {config.perks.map((perk) => (
            <div key={perk} className={styles.auClubPerk}>
              <p>{perk}</p>
            </div>
          ))}
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div className={styles.auClubPerks}>
          {plans.map((p) => (
            <div
              key={p.id}
              className={styles.auClubPerk}
              data-featured={p.featured ? 'true' : undefined}
            >
              <p className={styles.auPlanName}>{p.name}</p>
              <p className={styles.auPlanPrice}>
                {formatPlanPrice(p.priceCents)} {loyaltyIntervalLabel(p.interval)}
              </p>
              {p.perks.length > 0 ? <p>{p.perks.join(' · ')}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.auClubJoin}>
        <JoinClubForm cta={content.clubCta ?? 'Gå med gratis'} />
      </div>
    </section>
  )
}
