import type { SiteEditorTab } from '@/lib/platform/site-editor-manifest'

export type EditorFieldTarget = {
  field: string
  tabId: string
  cardId: string
}

const DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
const GENERAL_FIELDS = ['name', 'color_primary', 'color_accent', 'color_bg', 'color_fg', 'seo.title', 'seo.description']
const CONTACT_FIELDS = [
  'contact.email',
  'contact.phone',
  'location.address',
  'social.instagram',
  'social.facebook',
  'social.tiktok',
  ...DAYS.map((_, index) => `opening_hours.${index}.time`),
]
const BOOKING_FIELDS = ['booking.variant', 'booking.pickerMode', 'booking.staffAvatars']

export function normalizeEditorFieldKey(field: string): string {
  const aliases: Record<string, string> = {
    'tenant.name': 'name',
    'branding.logo_url': 'logo_url',
    'logo_url.0': 'logo_url',
    'branding.about_image': 'about_image',
    'about_image.0': 'about_image',
    'branding.closing_image': 'closing_image',
    'closing_image.0': 'closing_image',
    email: 'contact.email',
    epost: 'contact.email',
    phone: 'contact.phone',
    telefon: 'contact.phone',
    address: 'location.address',
    adress: 'location.address',
  }
  if (aliases[field]) return aliases[field]
  if (field.startsWith('settings.copy.')) return field.slice('settings.copy.'.length)
  if (field.startsWith('settings.')) return field.slice('settings.'.length)
  if (field.startsWith('branding.')) return field.slice('branding.'.length)
  const opening = /^(?:openingHours|opening_hours)\.(\d+)\.time$/.exec(field)
  if (opening) return `opening_hours.${opening[1]}.time`
  const day = /^hours\.(.+)$/.exec(field)
  if (day) {
    const index = DAYS.indexOf(day[1]!)
    if (index >= 0) return `opening_hours.${index}.time`
  }
  return field
}

export function editorFieldTargets(tabs: SiteEditorTab[], activeTabId: string): EditorFieldTarget[] {
  const ordered = [
    ...tabs.filter((tab) => tab.id === activeTabId),
    ...tabs.filter((tab) => tab.id !== activeTabId),
  ]
  const targets: EditorFieldTarget[] = []
  const add = (tabId: string, cardId: string, fields: string[]) => {
    fields.forEach((field) => targets.push({ field, tabId, cardId }))
  }

  for (const tab of ordered) {
    for (const card of tab.cards) {
      add(tab.id, card.id, (card.fields ?? []).map((field) => field.key))
      if (card.imageSlot) {
        if (card.imageSlot === 'hero_images' || card.imageSlot === 'gallery_images') {
          const limit = card.imageLimit ?? card.imageDefaults?.length ?? 1
          add(tab.id, card.id, Array.from({ length: limit }, (_, index) => `${card.imageSlot}.${index}`))
        } else {
          add(tab.id, card.id, [card.imageSlot])
        }
      }
      if (card.statsDefaults) {
        add(tab.id, card.id, card.statsDefaults.flatMap((_, index) => [
          `stats.${index}.value`,
          `stats.${index}.label`,
        ]))
      }
    }
    if (tab.id === 'allmant') add(tab.id, 'built-in-general', GENERAL_FIELDS)
    if (tab.id === 'kontakt') add(tab.id, 'built-in-contact', CONTACT_FIELDS)
    if (tab.id === 'bokning') add(tab.id, 'built-in-booking', BOOKING_FIELDS)
  }

  const seen = new Set<string>()
  return targets.filter(({ field }) => !seen.has(field) && Boolean(seen.add(field)))
}

export function resolveEditorFieldTarget(
  tabs: SiteEditorTab[],
  activeTabId: string,
  field: string,
): EditorFieldTarget | null {
  const normalized = normalizeEditorFieldKey(field)
  return editorFieldTargets(tabs, activeTabId).find((target) => target.field === normalized) ?? null
}

export function resolveEditorPickMessage(
  event: MessageEvent,
  iframeWindow: Window | null,
  origin: string,
  tabs: SiteEditorTab[],
  activeTabId: string,
): EditorFieldTarget | null {
  if (!iframeWindow || event.origin !== origin || event.source !== iframeWindow) return null
  const data = event.data as { source?: unknown; type?: unknown; field?: unknown }
  if (data?.source !== 'corevo-sida' || data.type !== 'editor-pick-field' || typeof data.field !== 'string') return null
  return resolveEditorFieldTarget(tabs, activeTabId, data.field)
}

export function focusEditorControl(root: ParentNode, field: string, reducedMotion: boolean): boolean {
  const control = [...root.querySelectorAll<HTMLElement>('[data-corevo-editor-field]')]
    .find((element) => element.getAttribute('data-corevo-editor-field') === field)
  if (!control) return false
  control.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  control.focus({ preventScroll: true })
  return true
}
