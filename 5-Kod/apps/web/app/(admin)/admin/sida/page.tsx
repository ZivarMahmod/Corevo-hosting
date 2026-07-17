import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { createClient } from '@/lib/supabase/server'
import { getTenantDetail } from '@/lib/platform/tenants'
import { buildSiteSnapshot, deriveSiteScheduleHours, loadSiteRevisionState } from '@/lib/platform/site-revisions'
import { getVerticalCopy } from '@/components/storefront/vertical-copy'
import {
  resolveThemeContent,
  type ResolvedThemeContent,
} from '@/components/storefront/theme-content'
import {
  SidaStudioV2,
  type SiteEditorCard,
  type SiteEditorField,
  type SiteEditorManifest,
  type SiteEditorTab,
} from '@/components/platform/SidaStudioV2'
import { tenantStorefrontHost, tenantStorefrontUrl } from '@/lib/storefront-url'
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEMES,
  type StorefrontTheme,
} from '@/lib/tenant-data'
import { themePalette } from '@/lib/platform/theme-palettes'
import {
  THEME_EXTRA_HOME,
  themeCaps,
  type ExtraField,
} from '@/lib/platform/theme-capabilities'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Redigera sidan · Adminpanel' }

type EditorManifestKind = 'kalla' | 'snitt' | 'generic'

const ACCEPTANCE_TAB_LABELS = {
  kalla: ['Allmänt', 'Hem', 'Behandlingar', 'Terapeuter', 'Om oss', 'Kontakt', 'Bokning', 'Apoteket', 'Anteckningar'],
  snitt: ['Allmänt', 'Postern', 'Tjänster', 'Teamet', 'Galleriet', 'Kontakt', 'Bokning'],
} as const

const field = (
  defaults: ResolvedThemeContent,
  key: string,
  label: string,
  options: Partial<Pick<SiteEditorField, 'rows' | 'help'>> = {},
): SiteEditorField => {
  const candidate = (defaults as unknown as Record<string, unknown>)[key]
  return {
    key,
    label,
    ...(typeof candidate === 'string' && candidate.trim() ? { defaultValue: candidate } : {}),
    ...options,
  }
}

const themeField = (entry: ExtraField): SiteEditorField => ({
  key: entry.name,
  label: entry.label,
  defaultValue: entry.default,
  ...(entry.rows ? { rows: entry.rows } : {}),
  ...(entry.hint ? { help: entry.hint } : {}),
})

const MODULE_FIELD_PREFIXES = {
  shop: ['shop'],
  kurser: [],
  blogg: ['blog'],
  offert: [],
  presentkort: ['gift'],
  klubb: ['club'],
  galleri: ['gallery'],
} as const

const mergeThemeDefaults = (
  defaults: ResolvedThemeContent,
  fields: ExtraField[],
): ResolvedThemeContent => {
  const merged = { ...defaults } as ResolvedThemeContent & Record<string, unknown>
  for (const entry of fields) {
    const value = merged[entry.name]
    if (typeof value !== 'string' || !value.trim()) merged[entry.name] = entry.default
  }
  return merged
}

const uniqueFields = (fields: SiteEditorField[]): SiteEditorField[] =>
  [...new Map(fields.map((item) => [item.key, item])).values()]

function kallaModuleTabs(defaults: ResolvedThemeContent): SiteEditorTab[] {
  return [
    {
      id: 'apoteket',
      label: 'Apoteket',
      sub: 'Butikens sida',
      path: '/shop',
      cards: [
        {
          id: 'shop-copy',
          title: 'Apoteket',
          fields: [
            field(defaults, 'shopEyebrow', 'Liten rubrik'),
            field(defaults, 'shopTitle', 'Sidrubrik'),
            field(defaults, 'shopCta', 'Knapptext'),
          ],
          info: {
            text: 'Produkter, priser och lager sköts i butiksmodulen.',
            href: '/admin/webshop',
            label: 'Ändra under Butik',
          },
        },
      ],
    },
    {
      id: 'journal',
      label: 'Anteckningar',
      sub: 'Bloggens sida',
      path: '/blogg',
      cards: [{
        id: 'blog-copy',
        title: 'Anteckningar',
        fields: [
          field(defaults, 'blogEyebrow', 'Liten rubrik'),
          field(defaults, 'blogTitle', 'Sidrubrik'),
          field(defaults, 'blogCta', 'Knapptext'),
        ],
        info: {
          text: 'Inläggen skrivs i bloggmodulen och visas automatiskt här.',
          href: '/admin/blogg',
          label: 'Skriv ett inlägg',
        },
      }],
    },
  ]
}

function genericModuleTabs(fields: ExtraField[]): SiteEditorTab[] {
  const routes = [
    { id: 'shop', label: 'Butik', sub: 'Butikssidan · bandtexter', path: '/shop', module: 'shop', admin: '/admin/webshop' },
    { id: 'kurser', label: 'Kurser', sub: 'Kurssidan', path: '/kurser', module: 'kurser', admin: '/admin/kurser' },
    { id: 'blogg', label: 'Blogg', sub: 'Bloggsidan · bandtexter', path: '/blogg', module: 'blogg', admin: '/admin/blogg' },
    { id: 'offert', label: 'Offert', sub: 'Offertsidan', path: '/offert', module: 'offert', admin: '/admin/offert' },
    { id: 'presentkort', label: 'Presentkort', sub: 'Presentkortssidan · bandtexter', path: '/presentkort', module: 'presentkort', admin: '/admin/presentkort' },
    { id: 'klubb', label: 'Klubb', sub: 'Medlemskap · texter', path: '/klubb', module: 'lojalitet', admin: '/admin/lojalitet' },
    { id: 'galleri', label: 'Galleri', sub: 'Gallerisidan · texter', path: '/galleri', module: 'galleri', admin: '/admin/moduler' },
  ] as const
  return routes.map((route) => ({
    ...route,
    cards: [{
      id: `${route.id}-copy`,
      title: `${route.label}-sidans texter`,
      fields: (() => {
        const prefixes = MODULE_FIELD_PREFIXES[route.id]
        return fields.filter((field) => prefixes.some((prefix) => field.name.startsWith(prefix))).map(themeField)
      })(),
      info: {
        text: 'Sidans data hanteras i sin modul. Här ändrar ni bara sidans texter.',
        href: route.admin,
        label: `Öppna ${route.label}`,
      },
    }],
  }))
}

function manifestFor(kind: EditorManifestKind, defaults: ResolvedThemeContent, theme: StorefrontTheme): SiteEditorManifest {
  const caps = themeCaps(theme)
  const themeHomeFields = THEME_EXTRA_HOME[theme] ?? []
  defaults = mergeThemeDefaults(defaults, themeHomeFields)
  const common: Record<'allmant' | 'tjanster' | 'team' | 'kontakt' | 'bokning', SiteEditorTab> = {
    allmant: {
      id: 'allmant',
      label: 'Allmänt',
      sub: 'Namn · färger · sökresultat',
      path: '',
      cards: [
        { id: 'logo', title: 'Logotyp', imageSlot: 'logo_url' },
        {
          id: 'footer-copy',
          title: 'Sidfot',
          fields: [field(defaults, 'tagline', 'Sidfotens text')],
        },
      ],
    },
    tjanster: {
      id: 'tjanster',
      label: kind === 'kalla' ? 'Behandlingar' : 'Tjänster',
      sub: 'Utbud och priser',
      path: '/tjanster',
      cards: [{
        id: 'services-copy',
        title: 'Sidans rubriker',
        fields: [
          field(defaults, 'servicesEyebrow', 'Liten rubrik'),
          field(defaults, 'servicesTitle', 'Sidrubrik'),
          field(defaults, 'servicesIntro', 'Ingress', { rows: 3 }),
        ],
        info: {
          text: 'Tjänster, priser och längder hämtas från tjänstelistan.',
          href: '/admin/tjanster',
          label: 'Ändra under Tjänster',
        },
      }],
    },
    team: {
      id: 'team',
      label: kind === 'kalla' ? 'Terapeuter' : kind === 'snitt' ? 'Teamet' : 'Team',
      sub: 'Teamsidan',
      path: '/team',
      cards: [{
        id: 'team-copy',
        title: 'Teamet',
        fields: [
          field(defaults, 'teamEyebrow', 'Liten rubrik'),
          field(defaults, 'teamTitle', 'Sidrubrik'),
          field(defaults, 'teamLead', 'Ingress', { rows: 3 }),
        ],
        info: {
          text: 'Namn, roller och bilder hämtas från personalprofilerna.',
          href: '/admin/personal',
          label: 'Ändra under Personal',
        },
      }],
    },
    kontakt: {
      id: 'kontakt',
      label: 'Kontakt',
      sub: 'Adress · öppettider',
      path: '/kontakt',
      cards: [{
        id: 'contact-copy',
        title: 'Sidans rubriker',
        fields: [
          ...(kind === 'generic' ? [field(defaults, 'contactEyebrow', 'Liten rubrik')] : []),
          field(defaults, 'contactTitle', 'Sidrubrik'),
          field(defaults, 'closingLede', 'Kontakttext', { rows: 3 }),
          ...(kind === 'snitt' ? [field(defaults, 'italic', 'Kursiv rad', { rows: 3 })] : []),
        ],
      }],
    },
    bokning: {
      id: 'bokning',
      label: 'Bokning',
      sub: 'Bokningssätt · tider · bilder',
      path: '?boka=1',
      cards: [{
        id: 'booking-data',
        title: 'Tider och bokningssätt',
        info: {
          text: 'Bokningsbara tider styrs av personalens arbetstider och tjänsternas längd.',
          href: '/admin/installningar/bokning',
          label: 'Ändra bokningsregler',
        },
      }],
    },
  }

  const genericHomeFields = [
    field(defaults, 'aboutTitle', 'Om oss-rubrik'),
    field(defaults, 'aboutCopyHome', 'Om oss-text', { rows: 4 }),
    field(defaults, 'homeSecondTitle', 'Mittenrubrik'),
    field(defaults, 'whyTitle', 'Varför oss-rubrik'),
    field(defaults, 'whySub', 'Varför oss-underrubrik'),
    field(defaults, 'whyBody', 'Varför oss-text', { rows: 4 }),
    field(defaults, 'closingEyebrow', 'Avslutningens lilla rubrik'),
    field(defaults, 'closingTitle', 'Avslutningens rubrik'),
    field(defaults, 'closingLede', 'Avslutningens text', { rows: 3 }),
  ]
  const contractedHomeFields = uniqueFields([
    ...(caps.homeAbout ? [
      field(defaults, 'aboutTitle', 'Om oss-rubrik'),
      field(defaults, 'aboutCopyHome', 'Om oss-text', { rows: 4 }),
    ] : []),
    ...(kind !== 'kalla' ? [field(defaults, 'italic', 'Kursiv rad')] : []),
    field(defaults, 'servicesEyebrow', 'Tjänstesektionens lilla rubrik'),
    field(defaults, 'servicesTitle', 'Tjänstesektionens rubrik'),
    field(defaults, 'teamEyebrow', 'Teamsektionens lilla rubrik'),
    field(defaults, 'teamTitle', 'Teamsektionens rubrik'),
    ...themeHomeFields.map(themeField),
  ])
  const home: SiteEditorTab = {
    id: 'hem',
    label: kind === 'snitt' ? 'Postern' : 'Hem',
    sub: 'Rubriker · texter · bilder',
    path: '',
    cards: [
      {
        id: 'hero-copy',
        title: 'Texterna på startsidan',
        fields: [
          ...(caps.heroEyebrow ? [field(defaults, 'heroEyebrow', 'Liten rubrik')] : []),
          field(defaults, 'heroTitle', 'Stora rubriken', { rows: 2, help: 'Radbrytning är tillåten.' }),
          field(defaults, 'heroLede', 'Texten under rubriken', { rows: 3 }),
        ],
      },
      {
        id: 'hero-images', title: 'Bilder på startsidan', imageSlot: 'hero_images',
        imageDefaults: defaults.heroImages,
        imageLimit: kind === 'snitt' ? 3 : kind === 'kalla' ? 1 : defaults.heroImages.length,
      },
      ...(caps.homeGallery ? [{
        id: 'home-gallery-images', title: 'Galleri på startsidan', imageSlot: 'gallery_images' as const,
        imageDefaults: defaults.galleryImages,
        imageLimit: defaults.galleryImages.length,
      }] : []),
      ...(kind === 'snitt' ? [{
        id: 'rating-data',
        title: 'Betygsraden',
        info: {
          text: 'Betyget och antalet recensioner hämtas från era Google-recensioner och uppdateras automatiskt.',
          href: '/admin/installningar/integrationer',
          label: 'Koppla under Inställningar → Integrationer',
        },
      }] : []),
      {
        id: 'home-sections',
        title: 'Startsidan längre ned',
        fields: kind === 'generic' ? genericHomeFields : contractedHomeFields,
      },
      ...(caps.homeAbout ? [{
        id: 'about-home-image', title: 'Bild i Om oss-sektionen', imageSlot: 'about_image' as const,
        imageDefaults: defaults.aboutImage ? [defaults.aboutImage] : [],
      }] : []),
      ...(kind === 'generic' ? [{
        id: 'closing-image', title: 'Avslutningsbild', imageSlot: 'closing_image',
        imageDefaults: defaults.closingImage ? [defaults.closingImage] : [],
      } as SiteEditorCard] : []),
      ...(caps.homeStats && defaults.stats.length ? [{
        id: 'home-stats', title: 'Fakta / statistik', statsDefaults: defaults.stats,
      }] : []),
    ],
  }

  const tabs: SiteEditorTab[] = [common.allmant, home, common.tjanster, common.team]
  if (kind !== 'snitt') {
    tabs.push({
      id: 'om',
      label: 'Om oss',
      sub: 'Berättelse · bild',
      path: '/om',
      cards: [
        {
          id: 'about-copy',
          title: 'Berättelsen',
          fields: [
            field(defaults, 'aboutTitle', 'Sidrubrik'),
            field(defaults, 'aboutCopy', 'Om oss-text', { rows: 5 }),
            field(defaults, 'teamEyebrow', 'Liten rubrik'),
            field(defaults, 'italic', 'Kursiv rad', { rows: 3 }),
          ],
        },
        {
          id: 'about-image', title: 'Bild på Om oss-sidan', imageSlot: 'about_image',
          imageDefaults: defaults.aboutImage ? [defaults.aboutImage] : [],
        },
        ...(kind === 'kalla' && defaults.stats.length ? [{
          id: 'about-stats', title: 'Fakta / statistik', statsDefaults: defaults.stats,
        }] : []),
      ],
    })
  } else {
    tabs.push({
      id: 'galleri',
      label: 'Galleriet',
      sub: 'Bildrutor',
      path: '/galleri',
      cards: [{
        id: 'gallery-copy',
        title: 'Galleriet',
        fields: [
          field(defaults, 'galleryEyebrow', 'Liten rubrik'),
          field(defaults, 'galleryTitle', 'Sidrubrik'),
          field(defaults, 'galleryLede', 'Ingress', { rows: 3 }),
        ],
        info: {
          text: 'Galleribilderna hanteras i gallerimodulen och visas automatiskt här.',
          href: 'mailto:hej@corevo.se',
          label: 'Kontakta Corevo',
        },
      }],
    })
  }
  tabs.push(common.kontakt, common.bokning)

  const palette = themePalette(theme)
  const colors = kind === 'kalla'
    ? ['#F3EFE7', '#1D5E54', '#22302B', '#1F4636', '#33518F']
    : kind === 'snitt'
      ? ['#141412', '#D6F344', '#EFEDE6', '#D6AC6A']
      : [palette.primary, palette.accent, palette.bg, palette.fg]
  const manifest: SiteEditorManifest = {
    swatches: {
      color_primary: colors,
      color_accent: colors,
      color_bg: colors,
      color_fg: colors,
    },
    tabs,
    modules: kind === 'kalla'
      ? kallaModuleTabs(defaults)
      : kind === 'generic'
        ? genericModuleTabs(themeHomeFields)
        : [],
  }
  if (kind === 'kalla' || kind === 'snitt') {
    const labels = [...manifest.tabs, ...(manifest.modules ?? [])].map((tab) => tab.label)
    const expected = [...ACCEPTANCE_TAB_LABELS[kind]]
    if (labels.join('\u001f') !== expected.join('\u001f')) {
      throw new Error(`Invalid ${kind} editor manifest order`)
    }
  }
  return manifest
}

type AdminSidaPageProps = {
  searchParams: Promise<{ flik?: string | string[] }>
}

export default async function AdminSidaPage({ searchParams }: AdminSidaPageProps) {
  const query = await searchParams
  const requestedTabId = Array.isArray(query.flik) ? query.flik[0] : query.flik
  const user = await requireAdminArea('sida')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const supabase = await createClient()
  const [detail, revisionState, moduleStates, verticalCopy] = await Promise.all([
    getTenantDetail(tenant.id, supabase),
    loadSiteRevisionState(supabase, tenant.id),
    getAdminModuleStates(tenant.id),
    getVerticalCopy(tenant.verticalId),
  ])
  if (!detail) {
    return (
      <section className="portal-section">
        <h1>Redigera sidan</h1>
        <p className="prose">Kunde inte läsa företagets data. Försök igen.</p>
      </section>
    )
  }

  const publishedSnapshot = buildSiteSnapshot(detail)
  const effectiveSnapshot = revisionState.draft?.snapshot ?? publishedSnapshot
  const rawTheme = publishedSnapshot.settings.theme
  const storefrontTheme: StorefrontTheme = STOREFRONT_THEMES.includes(rawTheme as StorefrontTheme)
    ? rawTheme as StorefrontTheme
    : DEFAULT_STOREFRONT_THEME
  const manifestKind: EditorManifestKind = storefrontTheme === 'kalla' || storefrontTheme === 'snitt'
    ? storefrontTheme
    : 'generic'
  const defaults = resolveThemeContent(storefrontTheme, null, verticalCopy)
  const storefrontUrl = tenantStorefrontUrl(detail.tenant.slug, detail.primaryDomain)
    ?? `https://${detail.tenant.slug}.corevo.se`
  const storefrontHost = tenantStorefrontHost(detail.tenant.slug, detail.primaryDomain)
    ?? `${detail.tenant.slug}.corevo.se`
  const liveModules = [
    'shop', 'kurser', 'blogg', 'offert', 'presentkort', 'lojalitet', 'galleri',
  ].filter((key) => isModuleActivated(moduleStates, key))

  return (
    <SidaStudioV2
      tenantId={detail.tenant.id}
      effectiveSnapshot={effectiveSnapshot}
      publishedSnapshot={publishedSnapshot}
      draft={revisionState.draft}
      history={revisionState.history}
      previewPath={`/salong-preview/${detail.tenant.slug}`}
      storefrontHost={storefrontHost}
      storefrontUrl={storefrontUrl}
      isActive={detail.tenant.status === 'active'}
      initialTabId={requestedTabId}
      manifestData={manifestFor(manifestKind, defaults, storefrontTheme)}
      liveModules={liveModules}
      scheduleHours={deriveSiteScheduleHours(detail)}
    />
  )
}
