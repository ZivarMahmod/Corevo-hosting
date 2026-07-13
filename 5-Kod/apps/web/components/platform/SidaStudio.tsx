'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { Badge } from '@/components/portal/ui'
import { PlatformBrandingForm } from './PlatformBrandingForm'
import { ImageSlotManager } from './StorefrontContentCard'
import {
  CopyFieldsCard,
  type CopyFieldDef,
  type PreviewFieldRegistration,
} from './CopyFieldsCard'
import { TenantNameCard } from './TenantNameCard'
import { ThemePicker } from './ThemePicker'
import { BookingPanel } from './BookingSettings'
import { TenantContactForm } from './TenantContactForm'
import { OpeningHoursCard } from './OpeningHoursCard'
import { TeamCard } from './TeamCard'
import { StaffTeamCard, type StaffTeamMember } from './StaffTeamCard'
import { SingleImageSlot, StatsCard } from './StorefrontExtrasCard'
import type { BookingVariant, PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
import { themeCaps, THEME_EXTRA_HOME } from '@/lib/platform/theme-capabilities'
import { THEME_CONTENT } from '@/components/storefront/theme-content'
import styles from './SidaStudio.module.css'

type Copy = {
  heroEyebrow: string
  heroTitle: string
  heroLede: string
  aboutCopy: string
  aboutCopyHome: string
  tagline: string
  italic: string
  aboutTitle: string
  homeSecondTitle: string
  whyTitle: string
  whySub: string
  whyBody: string
  servicesEyebrow: string
  servicesTitle: string
  servicesIntro: string
  teamEyebrow: string
  teamTitle: string
  teamLead: string
  closingEyebrow: string
  closingTitle: string
  closingLede: string
  contactEyebrow: string
  contactTitle: string
}

/**
 * Sida-fliken (super-admin) — v4: redigeringen är organiserad SOM SIDAN (Zivar:
 * "en flik som ändrar hemsidan, en optimerad för tjänster-sidan, nästa om oss …").
 * En flik per publik sida (Hem/Tjänster/Om oss/Kontakt) + Allmänt (mall, färger,
 * typsnitt, boknings-vy — sådant som gäller HELA sidan). Väljer du en sida-flik
 * hoppar previewen till höger till just den sidan, så du redigerar och ser samma
 * sak. Färg/typsnitt speglas i previewen DIREKT medan du ändrar (postMessage →
 * iframen sätter CSS-vars). Text och valda bilder speglas också direkt i samma
 * storefront-DOM, men tenant_settings/R2 skrivs först när användaren sparar.
 */
const MSG_SOURCE = 'corevo-sida'

type PageKey =
  | 'allmant'
  | 'hem'
  | 'tjanster'
  | 'om'
  | 'kontakt'
  | 'bokning'
  | 'shop'
  | 'kurser'
  | 'blogg'
  | 'offert'
  | 'presentkort'
  | 'klubb'
  | 'galleri'
  | 'team'
type PageDef = { key: PageKey; label: string; sub: string; path: string }
const PAGES: PageDef[] = [
  { key: 'allmant', label: 'Allmänt', sub: 'Mall · färger · typsnitt', path: '' },
  { key: 'hem', label: 'Hem', sub: 'Hero · bilder', path: '' },
  { key: 'tjanster', label: 'Tjänster', sub: 'Utbud & priser', path: '/tjanster' },
  { key: 'om', label: 'Om oss', sub: 'Berättelse · team', path: '/om' },
  { key: 'kontakt', label: 'Kontakt', sub: 'Adress · öppettider', path: '/kontakt' },
  // Bokning = f.d. "Boknings-vy"-kortet + separata Bokningsflöde-ytan, ihopslagna
  // (Zivar 2026-07-10: "de går hand i hand — gör dem samma, en preview").
  { key: 'bokning', label: 'Bokning', sub: 'Bokningssätt · tider · bilder', path: '' },
]

// goal-61 preview-parity: modulsidorna får egna flikar (bara när modulen är PÅ) — Zivar
// redigerade tidigare en butik han inte kunde se. Fliken visar sidans preview-tvilling
// och mallens EGNA bandtext-fält (ur THEME_EXTRA_HOME, filtrerat på modulens prefix).
const MODULE_PAGES: PageDef[] = [
  { key: 'shop', label: 'Butik', sub: 'Butikssidan · bandtexter', path: '/shop' },
  { key: 'kurser', label: 'Kurser', sub: 'Kurssidan', path: '/kurser' },
  { key: 'blogg', label: 'Blogg', sub: 'Bloggsidan · bandtexter', path: '/blogg' },
  { key: 'offert', label: 'Offert', sub: 'Offertsidan', path: '/offert' },
  { key: 'presentkort', label: 'Presentkort', sub: 'Presentkortssidan · bandtexter', path: '/presentkort' },
  { key: 'klubb', label: 'Klubb', sub: 'Medlemskap · texter', path: '/klubb' },
  { key: 'galleri', label: 'Galleri', sub: 'Gallerisidan · texter', path: '/galleri' },
  { key: 'team', label: 'Team', sub: 'Teamsidan · rubriker', path: '/team' },
]
export function SidaStudio({
  tenantId,
  previewPath,
  storefrontUrl,
  storefrontHost,
  templateKey,
  isActive,
  branding,
  copy,
  heroImages,
  galleryImages,
  name,
  contactEmail,
  contactPhone,
  address,
  social,
  openingHours,
  bookingVariant,
  pickerMode = 'calendar',
  staffAvatars = 'initialer',
  hasStaffPhoto = false,
  staffTeam = [],
  canChangeTemplate = true,
  verticalCopy,
  liveModules = [],
}: {
  tenantId: string
  previewPath: string
  storefrontUrl: string
  storefrontHost: string
  templateKey: string
  isActive: boolean
  branding: TenantBranding
  /** Sparade text-OVERRIDES ('' = ingen — mallens standard gäller). */
  copy: Copy
  heroImages: string[]
  galleryImages: string[]
  /** Salongens namn (tenants.name) — sidans identitet i sidhuvud/sidfot/bokning. */
  name: string
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  /** Sociala medier-länkar (settings.social) — '' när osatta. */
  social: { instagram: string; facebook: string; tiktok: string }
  /** Manuella öppettider (settings.opening_hours) — null = härleds ur scheman. */
  openingHours: { day: string; time: string }[] | null
  bookingVariant: BookingVariant
  /** Bokning-flikens val (tenant_settings.settings.booking) — defaults så äldre
   *  mounts kompilerar; panelen sparar via updateBookingSettings (sidaCtx-guard). */
  pickerMode?: PickerMode
  staffAvatars?: StaffAvatarMode
  /** true när minst en AKTIV medarbetare har profilbild — låser upp Foto-läget. */
  hasStaffPhoto?: boolean
  /** RIKTIGA medarbetare (staff-tabellen) — publika team-sektionens datakälla när
   *  minst en synlig medlem finns (annars gäller den gamla settings-listan, se
   *  lib/tenant-data loadStaffTeam). Default [] så äldre mounts kompilerar. */
  staffTeam?: StaffTeamMember[]
  /** false för salon_admin: mall-byte är plattformens beslut — sektionen döljs
   *  (och setTenantTheme nekar server-side). */
  canChangeTemplate?: boolean
  /** Branschens mall-text (verticals.default_copy, goal-57 körning 12) — visas som
   *  fältens "Mallens text"-standard så editorn speglar vad publika sidan faktiskt
   *  faller tillbaka på (kund → bransch → tema). */
  verticalCopy?: Record<string, string>
  /** Modulnycklar som är PÅ (live/paused) för kunden — styr vilka modulsid-flikar
   *  som visas. Default [] så äldre mounts kompilerar (inga modulflikar). */
  liveModules?: string[]
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [page, setPage] = useState<PageKey>('allmant')
  const [reloadToken, setReloadToken] = useState(0)
  // Draft-mall: previewen kan visa en ANNAN mall (via ?theme=) utan att den skarpa
  // sidan ändras — publiceras separat. null = tenantens sparade mall.
  const [previewTheme, setPreviewTheme] = useState<string | null>(null)
  const [registeredCards, setRegisteredCards] = useState<Record<string, PreviewFieldRegistration[]>>({})
  const [visibleCopyFields, setVisibleCopyFields] = useState<ReadonlySet<string> | null>(null)
  const draftCopyRef = useRef<Record<string, string>>({})
  const scanRequestRef = useRef(0)

  // Kontrollerna följer mallen du TITTAR på (förhandsvisad mall om en är vald, annars
  // den sparade): varje mall visar bara sina egna ändringsalternativ (theme-capabilities).
  // Sparade värden för dolda kontroller ligger kvar i DB och dyker upp igen när en mall
  // som använder dem väljs.
  const activeTheme = previewTheme ?? templateKey
  const caps = themeCaps(activeTheme)
  // Mallens standardtext/fakta för mallen du TITTAR på (THEME_CONTENT är ren data,
  // klient-säker) — förhandsvisar du en annan mall visar fälten DEN mallens standard.
  const themeBase = THEME_CONTENT[(activeTheme in THEME_CONTENT ? activeTheme : templateKey) as keyof typeof THEME_CONTENT] ?? Object.values(THEME_CONTENT)[0]!
  const copyDefaults: Copy = {
    heroEyebrow: themeBase.heroEyebrow,
    heroTitle: themeBase.heroTitle,
    heroLede: themeBase.heroLede,
    aboutCopy: themeBase.aboutCopy,
    aboutCopyHome: themeBase.aboutCopy,
    tagline: themeBase.tagline,
    italic: themeBase.italic,
    aboutTitle: themeBase.aboutTitle,
    homeSecondTitle: '',
    whyTitle: '',
    whySub: '',
    whyBody: '',
    servicesEyebrow: themeBase.servicesEyebrow,
    servicesTitle: themeBase.servicesTitle,
    servicesIntro: '',
    teamEyebrow: themeBase.teamEyebrow,
    teamTitle: themeBase.teamTitle,
    teamLead: '',
    closingEyebrow: '',
    closingTitle: '',
    closingLede: '',
    contactEyebrow: '',
    contactTitle: '',
  }
  const statsDefaults = themeBase.stats
  // Bransch-mall-texten (goal-57 körning 12) läggs OVANPÅ temats standard så
  // "Mallens text" i editorn = det publika sidan faktiskt faller tillbaka på.
  const vc = verticalCopy ?? {}
  for (const [k, v] of Object.entries(vc)) {
    if (typeof v === 'string' && v.trim().length > 0 && k in copyDefaults) {
      ;(copyDefaults as Record<string, string>)[k] = v
    }
  }
  if (vc.aboutCopy?.trim() && !vc.aboutCopyHome?.trim()) copyDefaults.aboutCopyHome = vc.aboutCopy
  // Sid-texternas inbyggda standarder (render-fallbacks utan temadefault) — samma
  // strängar som sidorna/sektionerna faller tillbaka på, så fälten förifylls ärligt.
  const servicesIntroDefault = vc.servicesIntro?.trim()
    ? vc.servicesIntro
    : `Våra behandlingar hos ${name}. Alla priser är inkl. moms — välj en tjänst och boka en ledig tid online.`
  const teamLeadDefault = vc.teamLead?.trim()
    ? vc.teamLead
    : `Teamet på ${name} brinner för hantverket och för att du ska känna dig hemma.`
  // Flora har egen avslutnings-prosa (FloraLayout) — fältens standard ska spegla
  // vad sidan faktiskt visar, inte frisör-defaulten (goal-57 körning 13 D2).
  const themeClosing =
    activeTheme === 'flora'
      ? {
          closingEyebrow: 'Redo när du är',
          closingTitle: 'Blommor för din dag?',
          closingLede: 'Beställ, boka en kurs eller hör av dig — vi hjälper dig gärna.',
        }
      : {
          closingEyebrow: 'Redo när du är',
          closingTitle: 'Redo för en ny stil?',
          closingLede: 'Hitta en tid som passar dig och boka online på under en minut — bekräftelse direkt.',
        }
  const closingDefaults = {
    closingEyebrow: vc.closingEyebrow?.trim() ? vc.closingEyebrow : themeClosing.closingEyebrow,
    closingTitle: vc.closingTitle?.trim() ? vc.closingTitle : themeClosing.closingTitle,
    closingLede: vc.closingLede?.trim() ? vc.closingLede : themeClosing.closingLede,
  }
  const contactHeadDefaults = {
    contactEyebrow: vc.contactEyebrow?.trim() ? vc.contactEyebrow : '— Hitta hit',
    contactTitle: vc.contactTitle?.trim() ? vc.contactTitle : 'Plats & öppettider',
  }

  // Flikordningen speglar publika navens ordning: Hem · Butik · Tjänster · Kurser ·
  // Blogg · Offert · Presentkort · Om · Kontakt (+ Allmänt först, Bokning sist).
  // Modulflikar visas BARA för moduler som är på — previewn matchar verkligheten.
  const pages = useMemo(() => {
    const on = new Set(liveModules)
    const stateKey: Partial<Record<PageKey, string>> = {
      shop: 'shop',
      kurser: 'kurser',
      blogg: 'blogg',
      offert: 'offert',
      presentkort: 'presentkort',
      klubb: 'lojalitet',
      galleri: 'galleri',
    }
    const mod = (k: PageKey) =>
      MODULE_PAGES.filter((p) => {
        if (p.key !== k) return false
        if (k === 'team') return staffTeam.length > 0 || (branding.team ?? []).length > 0
        return on.has(stateKey[k] ?? k)
      })
    return [
      PAGES[0]!, // allmant
      PAGES[1]!, // hem
      ...mod('shop'),
      PAGES[2]!, // tjanster
      ...mod('kurser'),
      ...mod('blogg'),
      ...mod('offert'),
      ...mod('presentkort'),
      ...mod('klubb'),
      ...mod('galleri'),
      ...mod('team'),
      PAGES[3]!, // om
      PAGES[4]!, // kontakt
      PAGES[5]!, // bokning
    ]
  }, [branding.team, liveModules, staffTeam.length])

  const activePage = pages.find((p) => p.key === page) ?? pages[0]!
  const src = useMemo(() => {
    const q = new URLSearchParams()
    if (previewTheme) q.set('theme', previewTheme)
    if (reloadToken > 0) q.set('_p', String(reloadToken))
    const qs = q.toString()
    return `${previewPath}${activePage.path}${qs ? `?${qs}` : ''}`
  }, [previewPath, activePage.path, previewTheme, reloadToken])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  const registerCopyFields = useCallback((cardId: string, fields: PreviewFieldRegistration[]) => {
    setRegisteredCards((current) => {
      const before = current[cardId]
      const beforeSignature = before?.map((field) => `${field.name}=${field.value}`).join('\u001f')
      const nextSignature = fields.map((field) => `${field.name}=${field.value}`).join('\u001f')
      return beforeSignature === nextSignature ? current : { ...current, [cardId]: fields }
    })
  }, [])
  const unregisterCopyFields = useCallback((cardId: string) => {
    setRegisteredCards((current) => {
      if (!(cardId in current)) return current
      const next = { ...current }
      delete next[cardId]
      return next
    })
  }, [])
  const copyFieldCandidates = useMemo(() => {
    const fields = new Map<string, PreviewFieldRegistration>()
    for (const cardFields of Object.values(registeredCards)) {
      for (const field of cardFields) fields.set(field.name, field)
    }
    return [...fields.values()]
  }, [registeredCards])

  // Push a live brand-token patch into the preview iframe (same-origin).
  const pushTokens = useCallback((tokens: Record<string, string>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'brand-preview', tokens },
      window.location.origin,
    )
  }, [])
  const pushCopyDraft = useCallback((field: string, value: string) => {
    draftCopyRef.current[field] = value
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'copy-preview', field, value },
      window.location.origin,
    )
  }, [])
  const pushFieldFlash = useCallback((field: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'copy-flash-field', field },
      window.location.origin,
    )
  }, [])
  const pushImagePreview = useCallback((currentUrl: string, url: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'image-preview', currentUrl, url },
      window.location.origin,
    )
  }, [])
  // "Visa var" för text: be previewen scrolla till + blinka elementet med texten.
  const pushFlash = useCallback((text: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'copy-flash', text },
      window.location.origin,
    )
  }, [])
  // "Visa var" för bilder: matcha på bild-URL i previewen.
  const pushImgFlash = useCallback((url: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'img-flash', text: url },
      window.location.origin,
    )
  }, [])

  const scanPreview = useCallback(() => {
    if (!isActive) return
    const requestId = ++scanRequestRef.current
    setVisibleCopyFields(null)
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'editor-scan', requestId, fields: copyFieldCandidates },
      window.location.origin,
    )
  }, [copyFieldCandidates, isActive])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as {
        source?: string
        type?: string
        requestId?: number
        fields?: string[]
      }
      if (data?.source !== MSG_SOURCE || data.type !== 'editor-scan-result') return
      if (data.requestId !== scanRequestRef.current || !Array.isArray(data.fields)) return
      setVisibleCopyFields(new Set(data.fields))
      for (const [field, value] of Object.entries(draftCopyRef.current)) {
        iframeRef.current?.contentWindow?.postMessage(
          { source: MSG_SOURCE, type: 'copy-preview', field, value },
          window.location.origin,
        )
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    draftCopyRef.current = {}
    setVisibleCopyFields(null)
  }, [page, activeTheme])

  useEffect(() => {
    if (!isActive) return
    const timer = window.setTimeout(scanPreview, 0)
    return () => window.clearTimeout(timer)
  }, [isActive, scanPreview, src])
  // "Visa var" för en CSS-var-yta (t.ex. FreshCuts mörka "Varför oss"-bakgrund =
  // Primärfärgen): pulsa markörfärgen ~1 s och återställ till sparade tokens.
  const flashVar = useCallback(
    (cssVar: string) => {
      const base = injectTenantTokens(branding)
      pushTokens({ ...base, [cssVar]: '#FF2FD6' })
      window.setTimeout(() => pushTokens(base), 1100)
    },
    [branding, pushTokens],
  )

  // Per-mall-fält (Zivar: "alla mallar har sina ändringsrutor för det de är uppbyggda
  // för"): fältuppsättningen styrs av theme-capabilities för mallen du tittar på.
  const homeFields: CopyFieldDef[] = [
    ...(caps.heroEyebrow
      ? [
          {
            name: 'heroEyebrow',
            label: 'Liten rubrik ovanför hero-rubriken',
            hint: 'Den lilla versala raden överst i heron.',
          },
        ]
      : []),
    { name: 'heroTitle', label: 'Hero-rubrik', rows: 2, hint: 'Sidans stora rubrik. Radbrytning tillåten.' },
    { name: 'heroLede', label: 'Hero-ingress', rows: 2, hint: 'Texten direkt under hero-rubriken.' },
    ...(caps.homeAbout
      ? [
          {
            name: 'aboutCopyHome',
            label: 'Om-text på startsidan',
            rows: 4,
            hint: 'Startsidans om-sektion. Standard = samma text som Om oss-sidan — skriv en egen här om hem och Om oss ska säga olika saker.',
          },
        ]
      : []),
  ]
  // Mallens samlade copy-kontrakt. Vi routar INTE längre fält efter namn-prefix
  // (shop*/blog*/gift*): det var den gamla hårdkodningen som gav fel rader när en
  // mall placerade samma sorts innehåll på en annan sida. Samma kandidater skickas
  // till aktuell route och den verkliga iframe-DOM:en väljer automatiskt vilka som
  // faktiskt renderas där.
  const allExtra = THEME_EXTRA_HOME[activeTheme] ?? []
  const extraHomeFields: CopyFieldDef[] = allExtra.map(({ name, label, hint, rows }) => ({ name, label, hint, rows }))
  const rawCopy = copy as unknown as Record<string, string>
  const extraHomeOverrides = Object.fromEntries(
    allExtra.map((f) => [
      f.name,
      rawCopy[f.name] || (f.name === 'homeGalleryEyebrow' ? rawCopy.galleryEyebrow : '') || '',
    ]),
  )
  const extraHomeDefaults = Object.fromEntries(
    allExtra.map((f) => {
      const verticalDefault = vc[f.name]
      return [
        f.name,
        typeof verticalDefault === 'string' && verticalDefault.trim()
          ? verticalDefault
          : f.default,
      ]
    }),
  )
  const omFields: CopyFieldDef[] = [
    {
      name: 'aboutTitle',
      label: 'Om-rubrik (liten)',
      hint: 'Den lilla rubriken vid om-sektionen (syns på Om oss-sidan och i mallar med om-sektion på startsidan).',
    },
    {
      name: 'aboutCopy',
      label: 'Om företaget',
      rows: 5,
      hint: 'Berättelsen på Om oss-sidan. Startsidans om-sektion följer den här texten tills du sätter en egen under Hem-fliken.',
    },
    { name: 'italic', label: 'Kursiv fras (citat/värme)', hint: 'Den korta kursiva frasen mellan sektionerna.' },
  ]
  const allmantFields: CopyFieldDef[] = [
    { name: 'tagline', label: 'Footer-tagline', hint: 'Den korta raden i sidfoten — syns på alla sidor.' },
  ]
  const teamPageFields: CopyFieldDef[] = [
    { name: 'teamEyebrow', label: 'Liten rubrik (eyebrow)' },
    { name: 'teamTitle', label: 'Team-rubrik' },
    { name: 'teamLead', label: 'Team-ingress', rows: 2 },
  ]
  const activeModuleFields = page === 'team'
    ? [...teamPageFields, ...extraHomeFields]
    : extraHomeFields
  const activeModuleOverrides = page === 'team'
    ? { ...extraHomeOverrides, teamEyebrow: copy.teamEyebrow, teamTitle: copy.teamTitle, teamLead: copy.teamLead }
    : extraHomeOverrides
  const activeModuleDefaults = page === 'team'
    ? { ...extraHomeDefaults, teamEyebrow: copyDefaults.teamEyebrow, teamTitle: copyDefaults.teamTitle, teamLead: teamLeadDefault }
    : extraHomeDefaults
  const copyEditorProps = {
    onRegister: registerCopyFields,
    onUnregister: unregisterCopyFields,
    visibleFields: isActive ? visibleCopyFields : undefined,
    onDraftChange: isActive ? pushCopyDraft : undefined,
    onFlashField: isActive ? pushFieldFlash : undefined,
  }

  return (
    <div className={styles.grid}>
      {/* ── vänster: redigering, organiserad som sidan ── */}
      <div className={styles.left}>
        {/* Sid-flikar: samma struktur som kundens publika sida. */}
        <nav style={pageRail} aria-label="Sidans delar">
          {pages.map((p) => {
            const on = p.key === page
            const sub = p.key === 'allmant' && !canChangeTemplate ? 'Färger · typsnitt' : p.sub
            return (
              <button key={p.key} type="button" onClick={() => setPage(p.key)} aria-pressed={on} style={pageTab(on)}>
                <span style={{ fontWeight: 650, fontSize: 13.5 }}>{p.label}</span>
                <span style={{ fontSize: 10.5, color: on ? 'var(--c-gold-600)' : 'var(--c-ink-3)' }}>{sub}</span>
              </button>
            )
          })}
        </nav>

        {page === 'allmant' ? (
          <>
            {canChangeTemplate ? (
              <section className={styles.card}>
                <h3 className={styles.cardHead}>Mall</h3>
                <p className={styles.note}>
                  Klicka en mall för att <strong>förhandsvisa</strong> den till höger — den går
                  <strong> inte live</strong> förrän du klickar Publicera.
                </p>
                <ThemePicker
                  tenantId={tenantId}
                  current={templateKey}
                  onPreview={(theme) => {
                    setPreviewTheme(theme === templateKey ? null : theme)
                    reload()
                  }}
                  onPublished={() => {
                    setPreviewTheme(null)
                    reload()
                  }}
                />
              </section>
            ) : null}

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Företagsnamn</h3>
              <TenantNameCard tenantId={tenantId} name={name} onSaved={reload} onFlash={pushFlash} />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Varumärke</h3>
              <p className={styles.liveHint}>
                <span className={styles.liveDot} aria-hidden="true" />
                Färg &amp; typsnitt syns direkt i previewen medan du ändrar — live först när du sparar
              </p>
              <PlatformBrandingForm
                tenantId={tenantId}
                branding={branding}
                themeKey={templateKey}
                onLiveTokens={pushTokens}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Sidfot</h3>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={allmantFields}
                overrides={{ tagline: copy.tagline }}
                defaults={{ tagline: copyDefaults.tagline }}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>

          </>
        ) : null}

        {page === 'bokning' ? (
          <BookingPanel
            tenantId={tenantId}
            templateKey={templateKey}
            branding={branding}
            variant={bookingVariant}
            pickerMode={pickerMode}
            staffAvatars={staffAvatars}
            hasStaffPhoto={hasStaffPhoto}
            onSaved={reload}
          />
        ) : null}

        {page === 'hem' ? (
          <>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>Hero-text</h3>
              <p className={styles.note}>
                Texten som möter besökaren överst på startsidan. Dagens gällande text står
                redan i rutorna — ändra och spara, previewen uppdateras.
              </p>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={[...homeFields, ...extraHomeFields]}
                overrides={{
                  heroEyebrow: copy.heroEyebrow,
                  heroTitle: copy.heroTitle,
                  heroLede: copy.heroLede,
                  aboutCopyHome: copy.aboutCopyHome,
                  ...extraHomeOverrides,
                }}
                defaults={{
                  heroEyebrow: copyDefaults.heroEyebrow,
                  heroTitle: copyDefaults.heroTitle,
                  heroLede: copyDefaults.heroLede,
                  aboutCopyHome: copy.aboutCopy || copyDefaults.aboutCopy,
                  ...extraHomeDefaults,
                }}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Bilder på startsidan</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <ImageSlotManager
                  tenantId={tenantId}
                  slot="hero"
                  label="Hero-bilder"
                  hint="Bilderna högst upp på startsidan — de som visas här är exakt de som syns på sidan just nu. Ladda upp egna för att ersätta mallens."
                  images={heroImages}
                  defaults={themeBase.heroImages}
                  onFlashImage={pushImgFlash}
                  onPreviewImage={pushImagePreview}
                  onSaved={reload}
                />
                {caps.homeGallery ? (
                  <ImageSlotManager
                    tenantId={tenantId}
                    slot="gallery"
                    label="Galleri-bilder"
                    hint="Bildgalleriet mitt på startsidan — det som visas här är exakt det som syns på sidan just nu."
                    images={galleryImages}
                    defaults={themeBase.galleryImages}
                    onFlashImage={pushImgFlash}
                    onPreviewImage={pushImagePreview}
                    onSaved={reload}
                  />
                ) : null}
              </div>
            </section>

            {activeTheme === 'freshcut' ? (
              <section className={styles.card}>
                <h3 className={styles.cardHead}>&quot;Varför oss&quot;-sektionens bakgrund</h3>
                <p className={styles.note}>
                  Den mörka bakgrunden är ingen bild — den är{' '}
                  <strong>Primärfärgen</strong>. Ändra den under Allmänt → Varumärke → Primärfärg.
                </p>
                <button
                  type="button"
                  className={styles.btn}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => flashVar('--color-primary')}
                  title="Blinkar primärfärgens ytor i previewen — inklusive den här bakgrunden"
                >
                  Visa var
                </button>
              </section>
            ) : null}

            {caps.homeStats ? (
              <section className={styles.card}>
                <h3 className={styles.cardHead}>Fakta / statistik</h3>
                <p className={styles.note}>
                  Siffer-fakta-raden på startsidan (den här mallen visar den; FreshCut har ingen).
                </p>
                <StatsCard
                  tenantId={tenantId}
                  stats={branding.stats ?? []}
                  statsDefaults={statsDefaults}
                  onFlashText={pushFlash}
                  onSaved={reload}
                />
              </section>
            ) : null}
          </>
        ) : null}

        {page === 'tjanster' ? (
          <>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>Sidans texter</h3>
              <p className={styles.note}>
                Rubriken och intro-raden ovanför prislistan — dagens gällande text står
                redan i rutorna.
              </p>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={[
                  { name: 'servicesEyebrow', label: 'Liten rubrik (eyebrow)', hint: 'Den lilla raden ovanför sidrubriken.' },
                  { name: 'servicesTitle', label: 'Sidrubrik', hint: 'Tjänster-sidans stora rubrik.' },
                  { name: 'servicesIntro', label: 'Intro-rad', rows: 2, hint: 'Raden under rubriken, ovanför prislistan.' },
                ]}
                overrides={{
                  servicesEyebrow: copy.servicesEyebrow,
                  servicesTitle: copy.servicesTitle,
                  servicesIntro: copy.servicesIntro,
                }}
                defaults={{
                  servicesEyebrow: copyDefaults.servicesEyebrow,
                  servicesTitle: copyDefaults.servicesTitle,
                  servicesIntro: servicesIntroDefault,
                }}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Själva tjänsterna &amp; priserna</h3>
              <p className={styles.note}>
                Listan hämtas automatiskt från kundkortets <strong>Tjänster</strong>-flik
                (högst upp) — namn, priser, kategorier, rea-badges och bilder redigeras där
                och slår igenom här direkt.
              </p>
            </section>
          </>
        ) : null}

        {page === 'om' ? (
          <>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>Om oss-text</h3>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={omFields}
                overrides={{ aboutTitle: copy.aboutTitle, aboutCopy: copy.aboutCopy, italic: copy.italic }}
                defaults={{ aboutTitle: copyDefaults.aboutTitle, aboutCopy: copyDefaults.aboutCopy, italic: copyDefaults.italic }}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Bilder på Om oss</h3>
              <p className={styles.note}>
                Bilden vid om-texten och avslutningsbilden längst ner. Tomma = mallens
                standardbilder visas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SingleImageSlot
                  tenantId={tenantId}
                  slot="about"
                  label="Om-bild"
                  hint="Bilden BREDVID om-texten (högre upp på Om oss-sidan)."
                  url={branding.about_image ?? null}
                  defaultUrl={themeBase.aboutImage}
                  onFlashImage={pushImgFlash}
                  onPreviewImage={pushImagePreview}
                  onSaved={reload}
                />
                <SingleImageSlot
                  tenantId={tenantId}
                  slot="closing"
                  label="Avslutningsbild"
                  hint="Den stora bakgrundslika bilden LÄNGST NER (bakom 'Redo…'-texten, syns även på Kontakt-sidan)."
                  url={branding.closing_image ?? null}
                  defaultUrl={themeBase.closingImage}
                  onFlashImage={pushImgFlash}
                  onPreviewImage={pushImagePreview}
                  onSaved={reload}
                />
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Teamet</h3>
              <p className={styles.note}>
                Team-sektionen på sidan hämtas från företagets <strong>riktiga personal</strong> —
                lägger du in en bokningsbar medarbetare i <strong>Personal</strong>-fliken dyker
                hen upp här och på sidan. Här styr du bara <strong>foto</strong> och om en
                medarbetare <strong>syns</strong>; det tekniska (tjänster, schema,
                bokningsbarhet, inlogg) sköts i Personal-fliken.
              </p>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={[
                  { name: 'teamEyebrow', label: 'Liten rubrik (eyebrow)' },
                  { name: 'teamTitle', label: 'Team-rubrik' },
                  { name: 'teamLead', label: 'Team-ingress', rows: 2, hint: 'Raden under team-rubriken.' },
                ]}
                overrides={{ teamEyebrow: copy.teamEyebrow, teamTitle: copy.teamTitle, teamLead: copy.teamLead }}
                defaults={{ teamEyebrow: copyDefaults.teamEyebrow, teamTitle: copyDefaults.teamTitle, teamLead: teamLeadDefault }}
                onSaved={reload}
                {...copyEditorProps}
              />
              {/* Riktiga medarbetare (staff) = sidans datakälla så fort minst en synlig
                  finns; den gamla manuella settings-listan (TeamCard) visas bara för
                  legacy-tenanter helt utan personal — samma regel som rendern
                  (lib/tenant-data loadStaffTeam). */}
              {staffTeam.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <StaffTeamCard
                    tenantId={tenantId}
                    staff={staffTeam}
                    onSaved={reload}
                    onFlash={pushFlash}
                  />
                  {(branding.team ?? []).length > 0 ? (
                    <p className={styles.note} style={{ marginTop: 10 }}>
                      Den äldre manuella team-listan finns kvar i inställningarna men visas
                      inte på sidan så länge minst en medarbetare ovan är synlig.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <TeamCard
                    tenantId={tenantId}
                    team={(branding.team ?? []).map((m) => ({ name: m.name ?? '', role: m.role ?? '', img: m.img ?? '' }))}
                    onSaved={reload}
                    onFlash={pushFlash}
                    onFlashImage={pushImgFlash}
                  />
                </div>
              )}
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Avslutningssektionen</h3>
              <p className={styles.note}>
                Texten ovanpå den stora avslutningsbilden längst ner (syns på både Om oss-
                och Kontakt-sidan).
              </p>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={[
                  { name: 'closingEyebrow', label: 'Liten rad överst' },
                  { name: 'closingTitle', label: 'Rubrik' },
                  { name: 'closingLede', label: 'Underrad', rows: 2 },
                ]}
                overrides={{ closingEyebrow: copy.closingEyebrow, closingTitle: copy.closingTitle, closingLede: copy.closingLede }}
                defaults={closingDefaults}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>
          </>
        ) : null}

        {page === 'kontakt' ? (
          <>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>Sidans rubriker</h3>
              <CopyFieldsCard
                tenantId={tenantId}
                fields={[
                  { name: 'contactEyebrow', label: 'Liten rubrik (eyebrow)' },
                  { name: 'contactTitle', label: 'Sidrubrik' },
                ]}
                overrides={{ contactEyebrow: copy.contactEyebrow, contactTitle: copy.contactTitle }}
                defaults={contactHeadDefaults}
                onSaved={reload}
                {...copyEditorProps}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Kontakt, adress &amp; sociala medier</h3>
              <p className={styles.note}>
                Syns på Kontakt-sidan och i sidfoten. Adressen driver även kartan på
                Kontakt-sidan (slås upp automatiskt när du sparar).
              </p>
              <TenantContactForm
                tenantId={tenantId}
                email={contactEmail}
                phone={contactPhone}
                address={address}
                social={social}
                onSaved={reload}
                onFlash={pushFlash}
              />
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>Öppettider</h3>
              <OpeningHoursCard
                tenantId={tenantId}
                openingHours={openingHours}
                onSaved={reload}
                onFlash={pushFlash}
              />
            </section>
          </>
        ) : null}

        {/* goal-61 preview-parity: modulsidornas flikar. Previewn till höger visar
            sidans TVILLING (salong-preview/<slug>/<modulsida>); fälten är mallens EGNA
            bandtexter (THEME_EXTRA_HOME filtrerat på modulprefix) — varje mall visar
            precis sina element. Innehållet (produkter, inlägg, kurstillfällen) bor i
            modulens egen flik, inte här — den här fliken äger sidans ORD. */}
        {MODULE_PAGES.some((m) => m.key === page) ? (
          <section className={styles.card}>
            <h3 className={styles.cardHead}>{activePage.label}-sidans texter</h3>
            <p className={styles.note}>
              {page === 'shop'
                ? 'Produkter, priser och lager hanteras i modulens egen Butik-flik. Här äger du sidans och butiksbandets texter.'
                : page === 'blogg'
                  ? 'Inläggen skrivs i modulens egen Blogg-flik. Här äger du sidans och bloggbandets texter.'
                  : page === 'kurser'
                    ? 'Kurstillfällen (datum, pris, platser) skapas i modulens egen flik. Sidan visar alltid kommande tillfällen.'
                  : page === 'offert'
                      ? 'Inkomna förfrågningar ligger i modulens egen Offert-flik. Formulärets ämnen styrs där.'
                      : page === 'klubb'
                        ? 'Medlemsnivåer och förmåner kommer från lojalitetsmodulen. Här ändrar du mallens egna rubriker, ingress och knapptext.'
                        : page === 'galleri'
                          ? 'Bilderna kommer från gallerimodulen. Här ändrar du mallens egna rubriker och bildsidans texter.'
                          : page === 'team'
                            ? 'Personerna kommer från riktig personaldata. Här ändrar du bara de rubriker som den valda team-sidan faktiskt visar.'
                      : 'Presentkortens belopp och giltighet hanteras i modulens egen flik. Här äger du presentkortsbandets texter.'}
            </p>
            {activeModuleFields.length > 0 ? (
              <CopyFieldsCard
                tenantId={tenantId}
                fields={activeModuleFields}
                overrides={activeModuleOverrides}
                defaults={activeModuleDefaults}
                onSaved={reload}
                {...copyEditorProps}
              />
            ) : (
              <p className={styles.note}>
                Mallen {activeTheme} har inga egna textfält för den här sidan ännu — texterna är
                mallens inbyggda. Använd previewen för att se hur sidan ser ut.
              </p>
            )}
          </section>
        ) : null}
      </div>

      {/* ── höger: sticky live-preview av den valda sidan ── */}
      <div className={styles.right}>
        <div className={styles.bar}>
          <div className={styles.barSide}>
            <span className={styles.host}>
              {storefrontHost}
              <span style={{ color: 'var(--c-ink-3)' }}>{activePage.path || '/'}</span>
            </span>
            {canChangeTemplate ? <Badge tone="neutral">mall: {previewTheme ?? templateKey}</Badge> : null}
          </div>
          <div className={styles.barSide}>
            <button type="button" className={styles.btn} onClick={reload} title="Ladda om previewen">
              Ladda om
            </button>
            <a
              className={styles.btnPrimary}
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              title="Öppna den skarpa sidan i ny flik"
            >
              Öppna live ↗
            </a>
          </div>
        </div>

        <div className={styles.stage}>
          {isActive ? (
            <iframe
              ref={iframeRef}
              src={src}
              className={styles.frame}
              title={`Förhandsvisning av ${storefrontHost}${activePage.path}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              loading="lazy"
              onLoad={scanPreview}
            />
          ) : (
            <div className={styles.blocked}>
              <strong>Storefronten är pausad</strong>
              <p>
                {/* Drift-fliken finns bara i plattformens kundkort — kundens egen
                    studio (canChangeTemplate=false) hänvisas till Corevo i stället. */}
                {canChangeTemplate
                  ? 'Kunden är inte aktiv, så den publika sidan är blockerad. Återaktivera kunden i Drift för att förhandsvisa den.'
                  : 'Din sida är inte aktiv just nu, så förhandsvisningen är blockerad. Kontakta Corevo så aktiverar vi den igen.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const pageRail: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}
function pageTab(on: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    padding: '8px 13px',
    borderRadius: 7,
    border: `1.5px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
    background: on ? 'color-mix(in srgb, var(--c-forest) 8%, var(--c-paper))' : 'var(--c-paper)',
    color: on ? 'var(--c-forest)' : 'var(--c-ink-2)',
    font: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  }
}
