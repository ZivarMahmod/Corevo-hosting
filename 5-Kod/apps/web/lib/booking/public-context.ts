import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { DEFAULT_TENANT_REGION } from '@/lib/tenant-region'
import {
  normalizeBookingProvider,
  type BookingProviderKind,
} from '@/lib/platform/booking-external-url'
import { currentRequestTenant } from '@/lib/tenant-data'

export type PublicBookingContext = {
  tenantId: string
  slug: string
  name: string
  countryCode: string
  currency: string
  timeZone: string
  locationId: string | null
  bookingProvider: BookingProviderKind
}

export async function getPublicBookingContext(): Promise<PublicBookingContext | null> {
  const tenant = await currentRequestTenant()
  if (!tenant) return null
  const supabase = createPublicClient()
  const [{ data: loc }, { data: region }] = await Promise.all([
    supabase
      .from('locations')
      .select('id, timezone')
      .eq('tenant_id', tenant.id)
      .eq('is_primary', true)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('country_code, locale, currency, default_timezone, settings')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ])
  if (
    !region ||
    region.country_code !== DEFAULT_TENANT_REGION.countryCode ||
    region.locale !== DEFAULT_TENANT_REGION.locale ||
    region.currency !== DEFAULT_TENANT_REGION.currency
  ) {
    return null
  }
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    countryCode: region.country_code,
    currency: region.currency,
    timeZone: loc?.timezone ?? region.default_timezone,
    locationId: loc?.id ?? null,
    bookingProvider: normalizeBookingProvider(
      (region.settings as Record<string, unknown> | null)?.booking
        ? ((region.settings as Record<string, unknown>).booking as Record<string, unknown>).provider
        : null,
    ),
  }
}

export async function publicBookingIsLive(ctx: PublicBookingContext): Promise<boolean> {
  if (ctx.bookingProvider !== 'corevo') return false
  const states = await getTenantModuleStates(ctx.tenantId, ctx.slug)
  return isModuleLive(states, 'booking')
}
