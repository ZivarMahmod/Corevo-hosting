import 'server-only'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { currentTenant } from '@/lib/tenant-data'
import type { TenantContact, TenantLocation } from '@/lib/tenant-data'
import { requestOrigin } from '@/lib/url'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * Storefront SEO helpers (M2 §2.2) — all tenant-driven, no invented data.
 *
 *  - pageMetadata(): per-page generateMetadata (title/description/openGraph) that
 *    pulls the real salon name. Falls back to a neutral title off-tenant.
 *  - LocalBusinessJsonLd: schema.org structured data mounted once in the public
 *    layout. Name/url/telephone/image emit always; address + opening hours emit
 *    only when REAL; no `geo` (we don't geocode → coordinates would be fabricated).
 *
 * Plain values only — frozen remote-image config means no next/image; the image
 * URL here is just a string in JSON-LD, not an <img>.
 */

/** Pages that get per-tenant metadata. The home page is handled by the layout. */
type StorefrontPage = 'om' | 'kontakt' | 'tjanster' | 'shop' | 'blogg' | 'offert' | 'presentkort'

const PAGE_META: Record<StorefrontPage, { title: string; describe: (name: string) => string }> = {
  om: {
    title: 'Om oss',
    describe: (name) => `Lär känna ${name} — vårt team, vår salong och hur vi arbetar.`,
  },
  kontakt: {
    title: 'Kontakt',
    describe: (name) => `Hitta hit, öppettider och kontaktuppgifter till ${name}.`,
  },
  tjanster: {
    title: 'Tjänster',
    describe: (name) => `Behandlingar och priser hos ${name}. Boka en ledig tid online.`,
  },
  shop: {
    title: 'Butik',
    describe: (name) => `Handla online hos ${name}.`,
  },
  blogg: {
    title: 'Blogg',
    describe: (name) => `Nyheter, tips och inspiration från ${name}.`,
  },
  offert: {
    title: 'Offert',
    describe: (name) => `Begär en offert från ${name}.`,
  },
  presentkort: {
    title: 'Presentkort',
    describe: (name) => `Ge bort ett presentkort hos ${name}.`,
  },
}

/**
 * Per-page metadata for a storefront route. Resolves the current tenant and
 * builds a per-tenant description + openGraph; off-tenant (platform/reserved)
 * falls back to a plain title with no leaked data. metadataBase comes from the
 * layout's generateMetadata, so the relative canonical/og URLs resolve absolutely.
 */
export async function pageMetadata(page: StorefrontPage): Promise<Metadata> {
  const cfg = PAGE_META[page]
  const bundle = await currentTenant()
  if (!bundle) return { title: cfg.title }
  const description = cfg.describe(bundle.tenant.name)
  const canonical = `/${page}`
  return {
    title: cfg.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${cfg.title} · ${bundle.tenant.name}`,
      description,
      type: 'website',
      url: canonical,
      siteName: bundle.tenant.name,
    },
  }
}

/** schema.org dayOfWeek URIs indexed by working_hours.weekday (0 = Sunday). */
const SCHEMA_DAYS = [
  'https://schema.org/Sunday',
  'https://schema.org/Monday',
  'https://schema.org/Tuesday',
  'https://schema.org/Wednesday',
  'https://schema.org/Thursday',
  'https://schema.org/Friday',
  'https://schema.org/Saturday',
] as const

/** "09:00:00" / "09:00" → "09:00" (valid for openingHoursSpecification). */
function toHHMM(t: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  return `${m[1]!.padStart(2, '0')}:${m[2]}`
}

type OpeningSpec = {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string
  opens: string
  closes: string
}

/**
 * Build a VALID openingHoursSpecification array from the salon's real
 * working_hours (one entry per staff window). We emit the raw staff windows
 * rather than the display-formatted envelope so the times are schema-valid
 * HH:MM. Returns [] when no real rows exist → the spec is omitted entirely.
 *
 * Cached under the same `tenant:${slug}` tag as the rest of the storefront so an
 * admin schedule save refreshes it live, and so the JSON-LD render does NOT add
 * an uncached working_hours read on every storefront request.
 */
async function loadOpeningSpec(tenantId: string, slug: string): Promise<OpeningSpec[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<OpeningSpec[]> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('working_hours')
        .select('weekday, start_time, end_time')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT isolate anon)
        .order('weekday', { ascending: true })
      if (!data || data.length === 0) return []
      const out: OpeningSpec[] = []
      for (const r of data) {
        if (r.weekday < 0 || r.weekday > 6) continue
        const opens = toHHMM(r.start_time)
        const closes = toHHMM(r.end_time)
        if (!opens || !closes) continue
        out.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: SCHEMA_DAYS[r.weekday]!,
          opens,
          closes,
        })
      }
      return out
    },
    ['seo-opening-spec-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

export async function LocalBusinessJsonLd({
  name,
  location,
  contact,
  logoUrl,
}: {
  name: string
  location: TenantLocation | null
  contact: TenantContact
  logoUrl: string | null
}) {
  const bundle = await currentTenant()
  // Without a resolved tenant we have no canonical url/id; skip the block rather
  // than emit a half-formed entity.
  if (!bundle) return null
  const origin = await requestOrigin()

  // HairSalon is the most specific schema.org subtype of LocalBusiness for a
  // hair/barber salon; it inherits the same address/hours/telephone fields.
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${origin}/#business`,
    name,
    url: origin,
  }

  if (logoUrl) data.image = logoUrl
  if (contact.phone) data.telephone = contact.phone
  if (contact.email) data.email = contact.email

  // Address only when real — no invented street.
  if (location?.address) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: location.address,
      addressCountry: 'SE',
    }
  }

  // Opening hours only when real working_hours exist; schema-valid HH:MM windows.
  const spec = await loadOpeningSpec(bundle.tenant.id, bundle.tenant.slug)
  if (spec.length > 0) data.openingHoursSpecification = spec

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe inside a script tag; no user HTML is
      // interpolated, and "<" in values is escaped below to avoid </script> breaks.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
