import { Gallery } from './Gallery'
import { GALLERY_PHOTOS } from './images'
import { SectionHeader } from './sections'
import { Reveal } from './Reveal'
import styles from './storefront.module.css'

/** Galleri / portfolio — masonry-ish 3-col image grid with a lightbox. The
 *  second big photo moment of the page. */
export function GallerySection() {
  return (
    <section className={`section ${styles.gallerySection}`}>
      <div className="section-inner">
        <SectionHeader
          eyebrow="— Galleri"
          title="Vårt arbete"
          lead="Ett urval av klippningar, färgningar och stunder i salongen."
        />
        <Reveal>
          <Gallery photos={GALLERY_PHOTOS} />
        </Reveal>
      </div>
    </section>
  )
}
