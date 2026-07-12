// goal-61 — portalvärden för storefront-overlays (kvitto-toast, kassa-loader).
//
// INTE <body>: [data-theme] sitter på storefront-SKALET, så en portal i body faller
// ur temat och renderas i plattformens default-guld bredvid mallens egna färger
// (verifierat i flora: kvitto-ikonen blev guld, köpknappen grön). Overlays måste
// alltså landa INUTI temaroten för att ärva mallens --sf-*-tokens.
export function storefrontPortalHost(): Element {
  return (
    document.querySelector('[data-world="storefront"]') ??
    document.querySelector('[data-theme]') ??
    document.body
  )
}
