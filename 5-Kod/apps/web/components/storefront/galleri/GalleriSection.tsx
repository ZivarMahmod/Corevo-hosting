// Galleri — DEN DELADE SEKTIONEN (goal-64).
//
// SERVER-komponent (får vara async — den laddar sin egen data, precis som BloggSection).
// Detta är FALLBACKEN: mallar som deklarerar `moduleViews.galleri` i sin <key>.theme.ts
// äger formen själva (vektor-regeln) och når aldrig hit. Mallar utan egen galleri-vy får
// den här — token-driven (var(--color-*) / var(--sf-*)), så den ärver vilken mall som
// helst utan egen palett.
//
// GATINGEN ÄR ANROPARENS JOBB: /galleri 404:ar när modulen inte är live/paused. Den här
// sektionen antar att gaten redan passerats.
//
// RENDER-ON-PRESENT: en rad utan bild renderas INTE (en tom ruta är sämre än ingen ruta),
// och bildtext/tagg/år skrivs bara ut när kunden faktiskt fyllt i dem. Vi hittar aldrig på.

import { SectionHeader, SubpageHero } from '../sections'
import s from './galleri-section.module.css'
import type { GalleryItem } from '@/lib/storefront/galleri/types'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'

function GalleryCard({ item }: { item: GalleryItem }) {
  // Utan bild finns inget att visa — galleriet ÄR bilderna.
  if (!item.imageUrl) return null
  return (
    <li className={s.item}>
      <figure className={s.figure}>
        <div
          className={s.media}
          // Mallens masonry-rytm bor på raden (aspect_ratio, 0057). Osatt → sektionens
          // default-ratio i CSS:en. Ratio på YTAN (inte på <img>) → inget hoppar när
          // bilden laddar (CLS).
          style={item.aspectRatio ? { aspectRatio: item.aspectRatio } : undefined}
        >
          {/* Plain <img> — storefrontens remote-image-config är fryst (aldrig next/image). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? item.caption ?? ''}
            loading="lazy"
            className={s.img}
          />
        </div>
        {item.tag || item.caption || item.yearLabel ? (
          <figcaption className={s.caption}>
            {item.tag ? <span className={s.tag}>{item.tag}</span> : null}
            {item.caption ? <span className={s.text}>{item.caption}</span> : null}
            {item.yearLabel ? <span className={s.year}>{item.yearLabel}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    </li>
  )
}

/**
 * Rendera galleriet för en kund. Returnerar null när kunden saknar galleri-modulrad
 * (inget att komponera in) så anroparen kan rendera den villkorslöst.
 */
export async function GalleriSection({
  tenantId,
  slug,
  paused = false,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** tenant_modules.state = 'paused' → bilderna visas, men som ett arkiv. */
  paused?: boolean
  /** Modulens EGEN sida: hero-bandet i stället för SectionHeader (samma som bloggen). */
  pageHero?: boolean
}) {
  const data = await loadGalleriData(tenantId, slug)
  if (!data) return null

  const items = data.items.filter((i) => i.imageUrl)

  return (
    <>
      {pageHero ? (
        <SubpageHero eyebrow="— Galleri" title="Galleriet" lede="Ett urval av vårt arbete." />
      ) : null}
      <section className="section" data-module="galleri">
        <div className="section-inner">
          {!pageHero ? (
            <SectionHeader eyebrow="— Galleri" title="Galleriet" lead="Ett urval av vårt arbete." />
          ) : null}

          {paused ? (
            <p role="status" className={s.notice}>
              Galleriet är pausat just nu — äldre bilder visas, men inga nya läggs till för
              tillfället.
            </p>
          ) : null}

          {items.length === 0 ? (
            <p className={s.empty}>Bilder visas snart.</p>
          ) : (
            <ul className={s.grid}>
              {items.map((i) => (
                <GalleryCard key={i.id} item={i} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
