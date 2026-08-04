export const SETTINGS_SCOPES = [
  'all',
  'booking',
  'notifications',
  'integrations',
  'privacy',
] as const

export type SettingsScope = (typeof SETTINGS_SCOPES)[number]

export function parseSettingsScope(value: unknown): SettingsScope | null {
  const candidate = String(value ?? '')
  return SETTINGS_SCOPES.includes(candidate as SettingsScope)
    ? (candidate as SettingsScope)
    : null
}

export function parseCancellationCutoffHours(value: unknown): number | null {
  const raw = String(value ?? '').trim()
  if (raw === '') return 24
  const hours = Number(raw)
  return Number.isSafeInteger(hours) && hours >= 0 && hours <= 8760 ? hours : null
}

type NotificationSettings = {
  confirmation: boolean
  reminder: boolean
  review: boolean
}

export type ScopedSettingsInput = {
  cancellationHours?: number
  contact?: { email: string | null; phone: string | null }
  notifications?: NotificationSettings
  googleReviewUrl?: string | null
  cookieBannerEnabled?: boolean
}

export function mergeScopedSettings(
  existing: Record<string, unknown>,
  scope: SettingsScope,
  input: ScopedSettingsInput,
): Record<string, unknown> {
  const next = { ...existing }

  if (scope === 'all' || scope === 'booking') {
    if (input.cancellationHours !== undefined) {
      next.cancellation_cutoff_hours = input.cancellationHours
    }
  }

  if ((scope === 'all' || scope === 'notifications') && input.notifications) {
    const savedNotifications =
      typeof existing.notifications === 'object' &&
      existing.notifications !== null &&
      !Array.isArray(existing.notifications)
        ? (existing.notifications as Record<string, unknown>)
        : {}
    next.notifications = { ...savedNotifications, ...input.notifications }
  }

  if (scope === 'all' && input.contact) next.contact = input.contact

  if (scope === 'all' || scope === 'integrations') {
    if (input.googleReviewUrl !== undefined) next.google_review_url = input.googleReviewUrl
  }

  if (scope === 'all' || scope === 'privacy') {
    if (input.cookieBannerEnabled !== undefined) {
      next.cookie_banner_enabled = input.cookieBannerEnabled
    }
  }

  return next
}
