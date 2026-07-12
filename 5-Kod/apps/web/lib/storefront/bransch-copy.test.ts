import { describe, it, expect } from 'vitest'
import {
  BRANSCH_COPY,
  BRANSCH_IMAGES,
  branschCopy,
  branschMedia,
} from '@/components/storefront/bransch-copy'
import { withBranschMedia } from '@/components/storefront/images'
import {
  THEME_CONTENT,
  layerCopy,
  resolveThemeContent,
  COPY_OVERRIDE_KEYS,
  type CopyOverride,
} from '@/components/storefront/theme-content'

// BRANSCH-LAGRET. Zivar: "när jag skapar en tatueringsstudio ska de inte vara en mall
// som säger välkommen till din slaong. branschen avgör mycket av vad som kommer stå."
//
// Precedensen som bevisas här (fält för fält):
//     ägarens settings.copy  >  BRANSCHEN  >  mallens THEME_CONTENT
//
// getVerticalCopy (vertical-copy.ts) är 'server-only' + DB, så den testas inte här.
// Den lägger DB:s default_copy ovanpå BRANSCH_COPY och matar resultatet in i exakt
// den layerCopy() som testas nedan — kedjan är alltså densamma, bara med ett extra
// DB-steg inuti bransch-lagret.
//
// MEDVETET: inget test nedan påstår något om vad mallens THEME_CONTENT innehåller
// (en parallell körning neutraliserar tema-lagret). Vi testar bara VÅRT lager och
// precedensen mellan lagren — så testet överlever att temats texter ändras.

/** Så här ser den riktiga anropskedjan ut i en render (page.tsx → resolveThemeContent). */
const resolveFor = (
  theme: Parameters<typeof resolveThemeContent>[0],
  verticalId: string | null,
  ownerCopy?: CopyOverride | null,
) => resolveThemeContent(theme, null, layerCopy(branschCopy(verticalId), ownerCopy))

describe('BRANSCH_COPY — kontraktet mot CopyOverride', () => {
  it('varje bransch använder BARA kända CopyOverride-nycklar (inga påhittade)', () => {
    const known = new Set<string>(COPY_OVERRIDE_KEYS)
    for (const [bransch, copy] of Object.entries(BRANSCH_COPY)) {
      for (const key of Object.keys(copy)) {
        // En okänd nyckel skulle tyst falla bort i cleanCopyOverride → fånga den här.
        expect(known, `${bransch}.${key} är inte en CopyOverride-nyckel`).toContain(key)
      }
    }
  })

  it('varje bransch fyller åtminstone hero + tagline + about (inga tomma skal)', () => {
    for (const [bransch, copy] of Object.entries(BRANSCH_COPY)) {
      for (const f of ['heroEyebrow', 'heroTitle', 'heroLede', 'tagline', 'aboutCopy'] as const) {
        expect(copy[f]?.trim(), `${bransch} saknar ${f}`).toBeTruthy()
      }
    }
  })

  it('branscherna som FINNS i DB (0028/0030/0056) är täckta', () => {
    // De riktiga verticals.key-värdena — 'frisör' med ö, 'barbershop' (ej "barberare").
    for (const key of ['frisör', 'barbershop', 'nagelstudio', 'restaurang', 'generell', 'florist']) {
      expect(BRANSCH_COPY[key], `bransch '${key}' saknas`).toBeDefined()
    }
  })

  it('okänd/null bransch → {} (lagret är transparent, temat bestämmer som förr)', () => {
    expect(branschCopy(null)).toEqual({})
    expect(branschCopy(undefined)).toEqual({})
    expect(branschCopy('finns-inte')).toEqual({})
    // …och då är den resolvade sidan EXAKT temats default (ingen regression).
    const base = THEME_CONTENT.salvia
    const out = resolveFor('salvia', 'finns-inte')
    expect(out.heroTitle).toBe(base.heroTitle)
    expect(out.heroLede).toBe(base.heroLede)
  })
})

describe('PRECEDENS: ägaren > branschen > mallen', () => {
  it('BRANSCHEN slår MALLEN när ägaren inte skrivit något', () => {
    const out = resolveFor('salvia', 'tatuering')
    expect(out.heroTitle).toBe(BRANSCH_COPY['tatuering']!.heroTitle)
    expect(out.heroEyebrow).toBe('— Tatueringsstudio')
    expect(out.tagline).toBe('Tatuering med hantverket först')
    // …och den skiljer sig från mallens egen text (annars bevisar testet inget).
    expect(out.heroTitle).not.toBe(THEME_CONTENT.salvia.heroTitle)
  })

  it('ÄGAREN slår BRANSCHEN, fält för fält', () => {
    const owner: CopyOverride = { heroTitle: 'Min egen rubrik', tagline: 'Min egen tagline' }
    const out = resolveFor('salvia', 'tatuering', owner)
    expect(out.heroTitle).toBe('Min egen rubrik')
    expect(out.tagline).toBe('Min egen tagline')
    // Fält ägaren INTE rört faller till branschen (inte till mallen).
    expect(out.heroLede).toBe(BRANSCH_COPY['tatuering']!.heroLede)
    expect(out.heroEyebrow).toBe('— Tatueringsstudio')
  })

  it('tomt/blankt ägarfält blankar INTE ut — det faller till branschen', () => {
    const out = resolveFor('salvia', 'tatuering', { heroTitle: '   \n ', heroLede: '' })
    expect(out.heroTitle).toBe(BRANSCH_COPY['tatuering']!.heroTitle)
    expect(out.heroLede).toBe(BRANSCH_COPY['tatuering']!.heroLede)
  })

  it('hela kedjan i ETT fall: ägare-fält, bransch-fält, mall-fält samtidigt', () => {
    const out = resolveFor('salvia', 'tatuering', { heroTitle: 'Ägarens rubrik' })
    expect(out.heroTitle).toBe('Ägarens rubrik') // ägaren
    expect(out.italic).toBe(BRANSCH_COPY['tatuering']!.italic) // branschen
    expect(out.utility).toBe(THEME_CONTENT.salvia.utility) // mallen (utility är tema-only)
  })
})

describe('Zivars krav: en tatueringsstudio hälsar ALDRIG "välkommen till salongen"', () => {
  // Kärnbuggen: mallens FRISÖR-copy läckte till varje bransch. Invarianten är alltså
  // inte "säg aldrig salong" — det är "bär aldrig en ANNAN branschs ordförråd".
  //
  // HÅRORD är fel i varje icke-frisör-bransch.
  const HARORD = /frisör|klippning|hårvård|hårstudio|slingor|balayage|fade|skägg/i
  // "Salong" är absurt för en tatuerare/restaurang/florist/klinik — men helt korrekt
  // för en hudvårdssalong. Ordet bannlyses därför bara där det faktiskt är fel.
  const SALONG = /salong/i

  it('tatuering på salvia-mallen: inga salong-/frisörord i heron', () => {
    const out = resolveFor('salvia', 'tatuering')
    for (const f of ['heroEyebrow', 'heroTitle', 'heroLede', 'tagline', 'italic'] as const) {
      expect(out[f], `${f} läcker frisör-copy: "${out[f]}"`).not.toMatch(HARORD)
      expect(out[f], `${f} kallar tatuerarens ställe för salong: "${out[f]}"`).not.toMatch(SALONG)
    }
    expect(out.aboutCopy).not.toMatch(HARORD)
    expect(out.aboutCopy).not.toMatch(SALONG)
  })

  it('tatuering får sina EGNA ord (inte bara frånvaron av fel ord)', () => {
    const out = resolveFor('salvia', 'tatuering')
    expect(`${out.heroEyebrow} ${out.heroTitle} ${out.heroLede} ${out.aboutCopy}`).toMatch(
      /tatuer|bläck|studio/i,
    )
  })

  it('gäller på VILKEN mall som helst — branschen äger orden, mallen formen', () => {
    for (const theme of ['salvia', 'leander', 'zigge', 'linnea', 'edit'] as const) {
      const out = resolveFor(theme, 'tatuering')
      expect(out.heroTitle, `mallen ${theme} läcker`).not.toMatch(HARORD)
      expect(out.heroTitle, `mallen ${theme} läcker`).not.toMatch(SALONG)
      expect(out.heroEyebrow, `mallen ${theme} läcker`).toBe('— Tatueringsstudio')
    }
  })

  it('INGEN icke-frisör-bransch bär hårord — på någon mall', () => {
    // nagelstudio ärver `linnea` (hårvård-copy) och restaurang ärver `leander`
    // (frisör-copy) som default_template — precis de läckor branschlagret täpper.
    const ICKE_FRISOR = [
      'tatuering', 'nagelstudio', 'restaurang', 'florist',
      'klinik', 'massage', 'hudvard', 'generell',
    ]
    // "Salong" är fel för alla utom de som legitimt ÄR en salong (hudvård/naglar).
    const SALONG_FEL = new Set(['tatuering', 'restaurang', 'florist', 'klinik', 'massage'])
    for (const bransch of ICKE_FRISOR) {
      for (const theme of ['salvia', 'leander', 'zigge', 'linnea', 'edit'] as const) {
        const out = resolveFor(theme, bransch)
        for (const f of ['heroEyebrow', 'heroTitle', 'heroLede', 'tagline', 'italic'] as const) {
          expect(out[f], `${bransch} på ${theme}: ${f} = "${out[f]}"`).not.toMatch(HARORD)
          if (SALONG_FEL.has(bransch)) {
            expect(out[f], `${bransch} på ${theme}: ${f} = "${out[f]}"`).not.toMatch(SALONG)
          }
        }
      }
    }
  })
})

describe('frisör-copyn flyttade HEM (den var inte fel — bara felplacerad)', () => {
  it('frisör-branschen bär den frisör-text som låg hårdkodad i salvia-mallen', () => {
    const f = BRANSCH_COPY['frisör']!
    expect(f.heroEyebrow).toBe('— Frisörsalong')
    expect(f.heroTitle).toBe('Skarpt klippt.\nSkönt mottagen.')
    expect(f.tagline).toBe('Hårvård med lugn hand')
    expect(f.italic).toBe('Varje stol är en stund för sig själv.')
  })

  it('en frisör behåller sin röst ÄVEN om tema-lagret neutraliseras', () => {
    // Poängen med flytten: texten kommer nu från BRANSCHEN, inte från mallen — så
    // den överlever att THEME_CONTENT görs bransch-neutralt.
    const out = resolveFor('edit', 'frisör') // frisör på en ANNAN mall än salvia
    expect(out.heroEyebrow).toBe('— Frisörsalong')
    expect(out.heroTitle).toBe('Skarpt klippt.\nSkönt mottagen.')
  })

  it('tvåradsbrytningen (\\n) i heroTitle överlever hela kedjan', () => {
    expect(resolveFor('salvia', 'frisör').heroTitle).toContain('\n')
    expect(resolveFor('salvia', 'tatuering').heroTitle).toContain('\n')
  })
})

describe('BRANSCH_IMAGES — ägarens bild > branschens > mallens', () => {
  it('branschens foton fyller i när ägaren inte laddat upp något', () => {
    const branding = withBranschMedia(null, 'florist')
    expect(branding?.hero_images).toEqual(BRANSCH_IMAGES.florist!.heroImages)
    expect(branding?.about_image).toBe(BRANSCH_IMAGES.florist!.aboutImage)
    // …och floristen får DÄRMED inte längre salongsbilder ur mallen.
    const out = resolveThemeContent('salvia', branding, null)
    expect(out.heroImages).toEqual(BRANSCH_IMAGES.florist!.heroImages)
    expect(out.heroImages).not.toEqual(THEME_CONTENT.salvia.heroImages)
  })

  it('ägarens uppladdade bild vinner ALLTID över branschens', () => {
    const egen = ['https://pub-test.r2.dev/t/min-hero.png']
    const branding = withBranschMedia({ hero_images: egen }, 'florist')
    expect(branding?.hero_images).toEqual(egen)
    // Fält ägaren INTE laddat upp får fortfarande branschens foto.
    expect(branding?.about_image).toBe(BRANSCH_IMAGES.florist!.aboutImage)
    expect(resolveThemeContent('salvia', branding, null).heroImages).toEqual(egen)
  })

  it('bransch utan verifierade foton → branding orört → mallens default gäller', () => {
    // BRANSCH_IMAGES är medvetet gles (inga påhittade Unsplash-id → inga 404:or).
    expect(branschMedia('tatuering')).toBeNull()
    expect(withBranschMedia(null, 'tatuering')).toBeNull()
    const out = resolveThemeContent('salvia', withBranschMedia(null, 'tatuering'), null)
    expect(out.heroImages).toEqual(THEME_CONTENT.salvia.heroImages)
  })

  it('null/okänd bransch → branding passerar oförändrat (ingen regression)', () => {
    const branding = { hero_images: ['x.png'], color_primary: '#123456' }
    expect(withBranschMedia(branding, null)).toBe(branding)
    expect(withBranschMedia(branding, 'finns-inte')).toBe(branding)
  })

  it('muterar inte sitt argument och behåller övriga branding-fält', () => {
    const branding = { color_primary: '#123456', logo_url: 'logo.png' }
    const ut = withBranschMedia(branding, 'florist')
    expect(branding).toEqual({ color_primary: '#123456', logo_url: 'logo.png' }) // orört
    expect(ut?.color_primary).toBe('#123456')
    expect(ut?.logo_url).toBe('logo.png')
  })
})
