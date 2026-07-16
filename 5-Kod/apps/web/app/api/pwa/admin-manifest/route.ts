// PWA-manifest för kund-adminen (booking) — länkas ENDAST från app/(admin)/layout.tsx
// metadata, aldrig globalt (ett app/manifest.ts hade gjort varje storefront
// "installerbar" som adminappen). Samma mönster som personal-manifestet.
//
// Varför den behövs: salongen står med en iPad i receptionen hela dagen. Sparad på
// hemskärmen ska adminen öppna som en APP — utan adressfält, utan flikar, direkt i
// dagens kalender. Utan `display: standalone` startar den i webbläsaren, och då tar
// webbläsarens chrome ~15 % av en redan liten skärm.
//
// start_url pekar på KALENDERN, inte översikten: den som installerar appen på salongens
// iPad gör det för att jobba i dagen, inte för att läsa en sammanfattning.
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Corevo Admin',
      short_name: 'Corevo',
      description: 'Din kalender, dina kunder och din sida — direkt på hemskärmen.',
      // Stabil identitet så Android inte skapar en ny installation när start_url
      // får fler kalenderparametrar i en senare release.
      id: '/admin',
      start_url: '/admin/bokningar?vy=dag',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f6f6f2',
      theme_color: '#26261f',
      icons: [
        { src: '/pwa/admin-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/pwa/admin-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        { src: '/pwa/admin-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
      // Långtryck på appikonen → hoppa direkt till dagens jobb. Stöds på Android och
      // iPadOS; ignoreras tyst där det inte finns.
      shortcuts: [
        {
          name: 'Dagens kalender',
          short_name: 'Kalender',
          url: '/admin/bokningar?vy=dag',
        },
        {
          name: 'Översikt',
          short_name: 'Översikt',
          url: '/admin',
        },
        {
          name: 'Kunder',
          short_name: 'Kunder',
          url: '/admin/kunder',
        },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  )
}
