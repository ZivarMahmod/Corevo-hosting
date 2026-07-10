// PWA-manifest för personal-portalen (minbooking) — länkas ENDAST från
// app/(personal)/layout.tsx metadata, aldrig globalt (ett app/manifest.ts hade
// gjort varje storefront "installerbar" som personal-appen). /api/* passerar
// host-routing på alla dörrar. Ingen service worker — Chrome/Samsung Internet
// kräver bara manifest + https för "Lägg till på hemskärmen" i app-läge.
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Min bokning — Corevo',
      short_name: 'Min bokning',
      description: 'Dina bokningar och tider — direkt på hemskärmen.',
      start_url: '/personal',
      scope: '/',
      display: 'standalone',
      background_color: '#faf8f4',
      theme_color: '#1F4636',
      icons: [
        { src: '/pwa/personal-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa/personal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa/personal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/pwa/personal-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  )
}
