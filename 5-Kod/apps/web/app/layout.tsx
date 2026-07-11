import type { Metadata } from 'next'
import {
  Playfair_Display,
  Inter,
  Source_Sans_3,
  Libre_Caslon_Display,
  Libre_Franklin,
  IBM_Plex_Mono,
  Cormorant_Garamond,
  DM_Serif_Display,
  Jost,
  Marcellus,
  Italiana,
  Fraunces,
  Dancing_Script,
} from 'next/font/google'
import { FLORIST_THEME_CSS } from '@/components/storefront/layouts/florist/registry'
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
// Bokningsflödets typsnittstrio (design-paketet "Frisörbokningsformulär redesign"):
// Libre Caslon Display (display) / Libre Franklin (UI) / IBM Plex Mono (prislist-
// meta). Exponeras som RÅA familje-vars (--font-caslon/-franklin/-plexmono) och
// mappas till --fc-font-* ENBART inne i bokningsytans .fc-scope (booking-global.css)
// — de rör ALDRIG back-office --font-display (Playfair). preload:false → inga extra
// preload-taggar på admin-sidor; filerna hämtas först när bokningsytan renderas.
const libreCaslon = Libre_Caslon_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-caslon',
  display: 'swap',
  preload: false,
})
const libreFranklin = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-franklin',
  display: 'swap',
  preload: false,
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plexmono',
  display: 'swap',
  preload: false,
})

// FLORIST-SVITENS typsnitt (goal-58, 13 mallar). tokens.css refererade redan
// Cormorant/Jost/DM Serif utan att någon LADDADE dem — de föll tyst till Georgia,
// vilket hade gjort 13 "olika" mallar typografiskt identiska. preload:false → inga
// extra preload-taggar på ytor som inte renderar en florist-storefront.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
})
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dmserif',
  display: 'swap',
  preload: false,
})
const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
  preload: false,
})
const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-marcellus',
  display: 'swap',
  preload: false,
})
const italiana = Italiana({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-italiana',
  display: 'swap',
  preload: false,
})
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
})
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Corevo',
  description: 'Corevo Booking Platform',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="sv"
      className={`${playfair.variable} ${inter.variable} ${sourceSans.variable} ${libreCaslon.variable} ${libreFranklin.variable} ${plexMono.variable} ${cormorant.variable} ${dmSerif.variable} ${jost.variable} ${marcellus.variable} ${italiana.variable} ${fraunces.variable} ${dancingScript.variable}`}
    >
      <head>
        {/* No-flash för back-office-temat: sätt data-bo-theme FÖRE första paint så ett
            sparat Mörk/Ljus-val aldrig blinkar. Bara [data-world="backoffice"]-tokens
            lyssnar (tokens.css) — storefronts/konto påverkas inte av attributet. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('corevo-bo-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-bo-theme',t)}catch(e){}",
          }}
        />
        {/* FLORIST-SVITENS palettblock (goal-58): samma sorts
            [data-world="storefront"][data-theme="<key>"]-block som tokens.css har för de
            7 äldre temana, men GENERERADE ur florist-registryt — en sanning, ingen
            handskriven CSS-dubblering. Ligger i roten (inte i (public)/layout.tsx) för
            att ALLA sex rötter som sätter data-theme ska få färgerna: storefront,
            salong-preview, /boka, /avboka, /konto och onboarding-studions preview. */}
        <style dangerouslySetInnerHTML={{ __html: FLORIST_THEME_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
