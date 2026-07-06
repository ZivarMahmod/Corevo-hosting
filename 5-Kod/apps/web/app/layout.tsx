import type { Metadata } from 'next'
import { Playfair_Display, Inter, Source_Sans_3 } from 'next/font/google'
import '@corevo/ui/tokens.css'
import './globals.css'
import './booking-global.css'
import './portal-global.css'

// Corevo family typography (design-system.md §3): Playfair Display for display
// headings, Inter for body/UI. Exposed as CSS vars consumed by --font-display /
// --font-body in @corevo/ui/tokens.css. self-hosted by next/font at build time.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
// FreshCut theme body font (Source Sans Pro on freshcut.se → Source Sans 3 here);
// exposed as --font-source-sans, consumed by [data-theme="freshcut"] --font-body.
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Corevo',
  description: 'Corevo Booking Platform',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className={`${playfair.variable} ${inter.variable} ${sourceSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
