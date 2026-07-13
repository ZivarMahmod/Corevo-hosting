// Galleri-modul — SHARED types (goal-64).
//
// PURA typer, INGEN I/O, INGEN 'server-only'. Samma kontrakt som blogg/types.ts:
// filen importeras av BÅDE server-loadern (load-galleri.ts) OCH mall-vyerna
// (ThemeGalleriViewProps i layouts/florist/types.ts), som i sin tur kan hamna i en
// klient-bundle. Drar den in ett 'server-only'-beroende kraschar `next build` —
// därför bara typer här.
//
// VARFÖR MODULEN FINNS: alla 12 Claude Design-paket har `galleri: { route: '/galleri' }`
// i sitt manifest, och Ateljé Vinters nav länkade redan dit → 404. Sidan byggs nu på
// riktigt, med kundens EGNA bilder (media_assets) — aldrig stock-foton som utges för
// att vara kundens arbete.

/** En bild i kundens galleri — client-safe vy av en gallery_items-rad (0057) joinad
 *  mot sitt media_assets-foto. Alla presentationsfält är NULLBARA: render-on-present
 *  är lag, ett tomt fält ska INTE renderas (och absolut inte fyllas med påhitt). */
export type GalleryItem = {
  id: string
  /** Löst ur den joinade media_assets-raden. null = raden har ingen bild (rendera inget). */
  imageUrl: string | null
  imageAlt: string | null
  /** "samling nr 13 — ranunkel, sju stjälkar" */
  caption: string | null
  /** siluett/snitt: "Klipp" · onyx: "FIG. 01 — MAGNOLIA NOIR" */
  tag: string | null
  /** ateljevinter: "juni 2026" */
  yearLabel: string | null
  /** '3/2' | '4/5' | '3/4' — mallens masonry-rytm. null → mallens default. */
  aspectRatio: string | null
}

/** Allt galleri-sidan behöver efter att loadern kört. Ingen config-variant (till
 *  skillnad från blogg/shop): galleriets FORM ägs helt av mallen (vektor-regeln),
 *  modulen äger bara bilderna. */
export type GalleriData = {
  items: GalleryItem[]
}
