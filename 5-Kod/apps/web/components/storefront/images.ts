// High-quality placeholder photography (validated 200 image/jpeg) used until a
// tenant uploads its own. Plain <img> srcs only — remote-image config is frozen,
// so we never use next/image. Swap for tenant media when the data layer exposes
// it (see crossModuleGaps note).
//
// These are real salon / hair / interior shots from Unsplash, chosen to lead
// every section with a photo (the single biggest gap vs the old flat hero).

export type StorePhoto = { src: string; alt: string }

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

/** Hero carousel — 3 images, salon-in-action / interior / detail. */
export const HERO_PHOTOS: StorePhoto[] = [
  { src: u('1600948836101-f9ffda59d250'), alt: 'Frisör som stylar håret på en kund i salongen' },
  { src: u('1560066984-138dadb4c035'), alt: 'Närbild på klippning hos frisören' },
  { src: u('1521590832167-7bcbfaa6381f'), alt: 'Ljus och inbjudande salongsmiljö' },
]

/** Gallery / portfolio grid — work + interior moments. */
export const GALLERY_PHOTOS: StorePhoto[] = [
  { src: u('1503951914875-452162b0f3f1', 900), alt: 'Resultat efter klippning och styling' },
  { src: u('1599351431202-1e0f0137899a', 900), alt: 'Färgning och behandling i salongen' },
  { src: u('1522337660859-02fbefca4702', 900), alt: 'Detaljer från en behandling' },
  { src: u('1521590832167-7bcbfaa6381f', 900), alt: 'Salongens interiör' },
  { src: u('1560066984-138dadb4c035', 900), alt: 'Frisör i arbete' },
  { src: u('1600948836101-f9ffda59d250', 900), alt: 'Stylist med kund vid stolen' },
]

/** Interior shot for the "Om salongen" split section. */
export const ABOUT_PHOTO: StorePhoto = {
  src: u('1521590832167-7bcbfaa6381f', 1200),
  alt: 'Salongens lugna och omsorgsfulla miljö',
}

/** Stylist portraits for "Våra frisörer" spotlights. */
export const STYLIST_PHOTOS: StorePhoto[] = [
  { src: u('1580618672591-eb180b1a973f', 700), alt: 'Porträtt av frisör' },
  { src: u('1582095133179-bfd08e2fc6b3', 700), alt: 'Porträtt av frisör' },
  { src: u('1607990281513-2c110a25bd8c', 700), alt: 'Porträtt av frisör' },
]

/** Full-bleed closing-CTA photograph (parallax moment). */
export const CLOSING_PHOTO: StorePhoto = {
  src: u('1503951914875-452162b0f3f1'),
  alt: 'Inbjudande salongsmiljö redo att ta emot dig',
}
