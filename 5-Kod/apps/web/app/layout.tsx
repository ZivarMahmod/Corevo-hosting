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
  Wix_Madefor_Display,
  DM_Sans,
  Merriweather,
  Manrope,
  Lora,
  Nunito_Sans,
  Archivo,
  Newsreader,
  Instrument_Serif,
  Instrument_Sans,
  Mulish,
  Karla,
  Poiret_One,
  Space_Grotesk,
  Bodoni_Moda,
  Schibsted_Grotesk,
  Hanken_Grotesk,
  Anton,
  Work_Sans,
  Figtree,
} from 'next/font/google'
// Steg 1 (prestanda-auditen): palett-CSS:en importeras nu ur en REN DATAFIL (noll
// imports) i stället för ur tema-registryt. Registryt drog hela storefront-modulgrafen
// (nav/footer/kassa/wizard, 150+ filer) in i rot-layouten, som kör på VARJE request —
// login, admin, 404, api. Filen genereras ur registryn (npm run gen:theme-css) och
// hålls i synk av theme-css.sync.test.ts.
import {
  FLORIST_THEME_CSS,
  EKONOMI_THEME_CSS,
  SALONG_THEME_CSS,
} from '@/components/storefront/layouts/theme-css.generated'
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

// EKONOMI-SVITEN (goal-63, zentum): hero-displayen (Wix Madefor Display 500/600),
// hero-brödtexten (DM Sans 400) och intro-statementet (Merriweather 400). Exakt de
// tre familjer källdesignen FAKTISKT laddar — dess deklarerade Inter laddas aldrig
// (renderas i systemets sans), och det är medvetet replikerat i mallens CSS.
const wixMadefor = Wix_Madefor_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-wixmadefor',
  display: 'swap',
  preload: false,
})
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dmsans',
  display: 'swap',
  preload: false,
})
const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-merriweather',
  display: 'swap',
  preload: false,
})

// CLAUDE DESIGN-SVITEN (goal-64, 12 mallar). Varje mall deklarerar sina två familjer i
// sitt levererade manifest (`fonts.heading`/`fonts.body`) — de laddas här och exponeras
// som råa familje-vars, precis som florist-/ekonomi-typsnitten ovan. En familj som INTE
// laddas faller tyst till Georgia och gör två "olika" mallar typografiskt identiska;
// därför är listan uttömmande mot manifesten. preload:false → inga extra preload-taggar
// på ytor som inte renderar en storefront.
// next/font är en BYGG-TIDS-transform: varje anrop måste ha ett literalt objekt (ingen
// spread, inga variabler) — annars kan swc-pluginet inte läsa det och familjen laddas
// aldrig. Därför upprepas subsets/display/preload på varje rad; det är avsiktligt.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap', preload: false }) // ateljevinter (display + brödtext)
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap', preload: false }) // aurora display
const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito', display: 'swap', preload: false }) // aurora brödtext
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap', preload: false }) // blomstertorget masthead
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap', preload: false }) // blomstertorget brödtext
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-instrumentserif', display: 'swap', preload: false }) // calytrix display
const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrumentsans', display: 'swap', preload: false }) // calytrix brödtext
const mulish = Mulish({ subsets: ['latin'], variable: '--font-mulish', display: 'swap', preload: false }) // eloria brödtext
const karla = Karla({ subsets: ['latin'], variable: '--font-karla', display: 'swap', preload: false }) // kalla brödtext
const poiret = Poiret_One({ subsets: ['latin'], weight: '400', variable: '--font-poiret', display: 'swap', preload: false }) // lunaria display
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-spacegrotesk', display: 'swap', preload: false }) // onyx display
const bodoni = Bodoni_Moda({ subsets: ['latin'], variable: '--font-bodoni', display: 'swap', preload: false }) // siluett display
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap', preload: false }) // siluett brödtext
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap', preload: false }) // sivsav brödtext
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap', preload: false }) // snitt poster-display
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-worksans', display: 'swap', preload: false }) // snitt brödtext
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap', preload: false }) // solsalt brödtext

const DC_FONT_VARS = [
  manrope, lora, nunitoSans, archivo, newsreader, instrumentSerif, instrumentSans,
  mulish, karla, poiret, spaceGrotesk, bodoni, schibsted, hanken, anton, workSans, figtree,
]
  .map((f) => f.variable)
  .join(' ')

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
      className={`${playfair.variable} ${inter.variable} ${sourceSans.variable} ${libreCaslon.variable} ${libreFranklin.variable} ${plexMono.variable} ${cormorant.variable} ${dmSerif.variable} ${jost.variable} ${marcellus.variable} ${italiana.variable} ${fraunces.variable} ${dancingScript.variable} ${wixMadefor.variable} ${dmSans.variable} ${merriweather.variable} ${DC_FONT_VARS}`}
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
        {/* EKONOMI-SVITENS palettblock (goal-63) — samma mekanik som florist ovan. */}
        <style dangerouslySetInnerHTML={{ __html: EKONOMI_THEME_CSS }} />
        {/* SALONG-SVITENS palettblock (goal-64) — samma mekanik. */}
        <style dangerouslySetInnerHTML={{ __html: SALONG_THEME_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
