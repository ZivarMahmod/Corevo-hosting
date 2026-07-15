// Prestanda B5: responsiva storefront-bilder utan next/image (remote-image-configen är
// FRUSEN — se HeroCarousel-kommentaren). Storefronten renderar råa <img> med Unsplash-
// URL:er som redan bär `?w=1600`. Mobilkunden laddade därför alltid 1600 px (2-4× för
// mycket på 4G). Den här hjälparen genererar en srcset ur SAMMA URL genom att byta
// w-parametern — ingen ändring av den frusna configen, inga nya beroenden.
//
// Icke-Unsplash-URL:er (R2-uppladdningar, relativa sökvägar) får undefined → <img> faller
// tillbaka till bara src, exakt som förut. En URL utan w= lämnas orörd (samma effekt).

const WIDTHS = [480, 800, 1200, 1600] as const

/** srcset med 480/800/1200/1600 px ur en Unsplash-URL, annars undefined. */
export function unsplashSrcSet(src: string | null | undefined): string | undefined {
  // Värd-förankrad (inte substring): en R2-URL som råkar bära texten i sin path ska
  // aldrig felaktigt behandlas som Unsplash. Kräver också en w=-param att byta.
  if (!src || !/^https?:\/\/images\.unsplash\.com\//.test(src) || !/[?&]w=\d+/.test(src)) {
    return undefined
  }
  return WIDTHS.map((w) => `${src.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(', ')
}
