// PWA-manifest för KUND-ytan (/konto) — plan 015. Länkas endast från
// (kund)/konto/layout.tsx metadata (aldrig globalt: varje storefront-sida ska
// inte bli "installerbar" som konto-appen). Speglar personal-manifestet.
// Service workern (public/kund-sw.js) registreras av PushOptIn på kontosidan.
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Mina sidor',
      short_name: 'Mina sidor',
      description: 'Dina bokningar, notiser och förmåner — direkt på hemskärmen.',
      start_url: '/konto',
      scope: '/',
      display: 'standalone',
      background_color: '#121210',
      theme_color: '#121210',
      icons: [
        { src: '/pwa/personal-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa/personal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa/personal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  )
}
