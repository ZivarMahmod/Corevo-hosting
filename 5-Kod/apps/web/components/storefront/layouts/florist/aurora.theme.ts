import type { FloristTheme } from './types'

/**
 * AURORA — korall/laxrosa på varmvitt, lekfull (goal-58). Signatur: tunn
 * korall-annonsrad → bred landskaps-hero med en rund "Handla nu"-cirkelknapp
 * ovanpå bilden → korall-band med en fet mening + liten CTA → rosa panel med
 * ett förskjutet, asymmetriskt valv-collage → invävda butik/blogg/presentkort
 * → tjänster → om → plats → closing. Foton verifierade 200 OK (curl -sI) 2026-07-11.
 */
export const aurora: FloristTheme = {
  key: 'aurora',
  name: 'Aurora',
  desc: 'Korall & laxrosa · lekfull',
  palette: {
    primary: '#F2603F',
    primaryD: '#C8412A',
    bg: '#FFF7F1',
    surface: '#FFFFFF',
    fg: '#2A1F18',
    fg2: '#8C7A6E',
    line: '#F0DFD2',
    accentSoft: '#FFE1D3',
  },
  fonts: {
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-jost), system-ui, sans-serif',
  },
  radius: '20px',
  content: {
    heroEyebrow: '— Blomsterbutik',
    heroTitle: 'Blommor som\ngör dagen bättre.',
    heroLede:
      'Handknutna buketter i glada färger — beställ hem, hämta i butiken eller skicka en go överraskning till någon du gillar.',
    tagline: 'Vi binder blommor med känsla och lite för mycket kärlek.',
    utility: 'Handbundet varje dag · Hämta i butiken eller få hemskickat',
    italic: 'En bukett säger mer än de flesta ord.',
    aboutCopy:
      'Vi är en blomsterbutik med känsla för säsongens bästa snitt och handbundna buketter. Varje beställning packas med omsorg, för att glädjen ska hålla hela vägen fram.',
    servicesEyebrow: '— Beställ hos oss',
    servicesTitle: 'Buketter & binderier',
    aboutTitle: 'Blommor, bundna med omsorg',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [
      'https://images.unsplash.com/photo-1487070183336-b863922373d4?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=1600&q=80&auto=format&fit=crop',
    ],
    galleryImages: [
      'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1520763185298-1b434c919102?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1457089328109-e5d9bd499191?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80&auto=format&fit=crop',
    ],
    aboutImage:
      'https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?w=1600&q=80&auto=format&fit=crop',
    closingImage:
      'https://images.unsplash.com/photo-1494972308805-463bc619d34e?w=1600&q=80&auto=format&fit=crop',
    team: [
      { name: 'Vårt team', role: 'Florister & rådgivare', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&q=80&auto=format&fit=crop' },
      { name: 'Buketter', role: 'Handbundet, dagligen', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&q=80&auto=format&fit=crop' },
      { name: 'Rådgivning', role: 'Hjälper dig välja rätt', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=700&q=80&auto=format&fit=crop' },
    ],
    stats: [
      ['Färskt', 'varje leverans'],
      ['Handbundet', 'med omsorg'],
      ['Glatt', 'bemötande'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
}
