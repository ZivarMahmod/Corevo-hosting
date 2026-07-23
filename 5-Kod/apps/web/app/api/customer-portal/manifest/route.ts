// Kundportalens PWA-identitet är avsiktligt Corevo-neutral. Tenant-, kund-,
// boknings- och sessionstillstånd får aldrig läcka in i manifestet eller dess URL.
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Mina bokningar · Corevo',
      short_name: 'Mina bokningar',
      id: '/mina/',
      start_url: '/mina/',
      scope: '/mina/',
      display: 'standalone',
      background_color: '#191a17',
      theme_color: '#191a17',
      icons: [
        {
          src: '/pwa/corevo-icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/corevo-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/corevo-icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/pwa/corevo-icon-monochrome.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'monochrome',
        },
      ],
    },
    {
      headers: {
        'content-type': 'application/manifest+json',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  )
}
