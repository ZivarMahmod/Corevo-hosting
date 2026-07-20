export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Corevo Platform',
      short_name: 'Corevo',
      description: 'Kunder, partners och drift — direkt på hemskärmen.',
      id: '/platform',
      start_url: '/platform',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#121210',
      theme_color: '#121210',
      icons: [
        { src: '/pwa/admin-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/pwa/admin-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  )
}
