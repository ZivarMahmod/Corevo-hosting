import { Gallery } from './Gallery'
import { GALLERY_PHOTOS } from './images'
import { SectionHeader } from './sections'
import { Reveal } from './Reveal'
import styles from './storefront.module.css'

/**
 * Galleri / portfolio — masonry-ish 3-col image grid with a lightbox.
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Galleri-jobbet
 * görs av layoutens inbyggda band (t.ex. SalviaLayout sfGalleryBand → <Gallery>),
 * backat av branding.gallery_images. Denna är en föräldralös alt-wrapper kring
 * samma Gallery-primitiv. Behålls (build-once-never-delete), ej raderad.
 */
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
