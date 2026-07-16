'use client'

import { useEffect } from 'react'

// Runs INSIDE the /salong-preview iframe. Listens for live brand-token patches posted
// by the parent Sida editor (same-origin only) and applies them as CSS vars on the
// storefront root — so dragging a colour picker recolours the preview instantly, before
// the form is saved. Purely additive: on reload the server-rendered inline tokens win
// again (these JS overrides live only for the current, unsaved edit).
const MSG_SOURCE = 'corevo-sida'
const FIELD_ATTR = 'data-corevo-editor-field'
const STABLE_FIELD_ATTR = 'data-corevo-editor-stable-field'
const SITE_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,span,em,i,a,button,li,div,blockquote,figcaption,small'
// The full set of tokens the brand form can drive. We reset ALL of them each message:
// a key PRESENT in the patch → setProperty; a key ABSENT (e.g. font_body blanked, so
// injectTenantTokens omits --font-body) → removeProperty, so the SSR value takes over
// again instead of the old override lingering until reload.
const TOKEN_KEYS = ['--color-primary', '--color-bg', '--color-fg', '--color-accent', '--color-accent-fg', '--font-body', '--font-display']
type PreviewImageSlot = 'logo_url' | 'about_image' | 'closing_image' | 'hero_images' | 'gallery_images'

type SiteSnapshotPreview = {
  tenant: { name?: unknown }
  settings: {
    copy: Record<string, unknown>
    contact?: { email?: unknown; phone?: unknown }
    social?: { instagram?: unknown; facebook?: unknown; tiktok?: unknown }
    map?: unknown
    booking?: { variant?: unknown; pickerMode?: unknown; staffAvatars?: unknown }
    opening_hours?: unknown
  }
  branding: Record<string, unknown>
  location?: { address?: unknown }
}

type OriginalFieldText = {
  nodes: { node: Text; value: string }[]
  fallback: string
}
const originalFieldText = new WeakMap<HTMLElement, OriginalFieldText>()

type OriginalLinkState = { href: string | null; display: string }
const originalLinkState = new WeakMap<HTMLAnchorElement, OriginalLinkState>()
const originalDisplay = new WeakMap<HTMLElement, string>()
const originalHidden = new WeakMap<HTMLElement, boolean>()
type OriginalImageState = { src: string | null; srcset: string | null; sizes: string | null }
const originalImageState = new WeakMap<HTMLImageElement, OriginalImageState>()

// Publika undersidor som HAR en preview-tvilling under /salong-preview/<slug>/…
// goal-61 preview-parity: modulsidorna (shop/kurser/blogg/offert/presentkort) fick
// tvillingar — Zivar redigerade tidigare en butik han inte kunde se, och ett nav-klick
// på "Butik" i previewen gjorde ingenting. Allt annat (t.ex. /boka, externa länkar,
// enskilda produkt-/inläggssidor) blockeras — previewen lämnar aldrig preview-världen.
const PREVIEW_PATHS = new Set([
  '',
  'tjanster',
  'om',
  'kontakt',
  'shop',
  'kurser',
  'blogg',
  'offert',
  'presentkort',
  'klubb',
  'galleri',
  'team',
])

export function SidaPreviewBridge() {
  useEffect(() => {
    let previousSnapshot: SiteSnapshotPreview | null = null
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const data = e.data as {
        source?: string
        type?: string
        tokens?: Record<string, string>
        text?: string
        field?: string
        value?: string
        currentUrl?: string
        url?: string
        requestId?: number
        fields?: { name: string; value: string }[]
        snapshot?: unknown
        imageSlots?: unknown
      }
      if (data?.source !== MSG_SOURCE) return
      if (data.type === 'site-snapshot-preview') {
        previousSnapshot = applySiteSnapshotPreview(data.snapshot, data.tokens, data.imageSlots, previousSnapshot)
        return
      }
      if (data.type === 'brand-preview' && data.tokens) {
        applyPreviewTokens(data.tokens)
        return
      }
      if (data.type === 'editor-scan' && Array.isArray(data.fields)) {
        scanEditableFields(data.fields, data.requestId)
        if (previousSnapshot) applySnapshotCopy(previousSnapshot.settings.copy, null)
        return
      }
      if (data.type === 'copy-preview' && typeof data.field === 'string' && typeof data.value === 'string') {
        patchField(data.field, data.value)
        return
      }
      if (data.type === 'copy-flash-field' && typeof data.field === 'string') {
        flashField(data.field)
        return
      }
      if (data.type === 'site-field-flash' && typeof data.field === 'string') {
        flashSiteField(data.field, typeof data.text === 'string' ? data.text : '')
        return
      }
      if (
        data.type === 'image-preview' &&
        typeof data.currentUrl === 'string' &&
        typeof data.url === 'string'
      ) {
        patchImage(data.currentUrl, data.url)
        return
      }
      // "Visa var" för TEXT (Zivar: "sidfot… var är den? kan den markeras?"):
      // hitta elementen som visar exakt den texten, scrolla dit och pulsa en ram —
      // generiskt via text-matchning, så inga per-mall-DOM-taggar behövs.
      if (data.type === 'copy-flash' && typeof data.text === 'string') flashText(data.text)
      // "Visa var" för BILDER: matcha på bild-URL (både <img src> och CSS
      // background-image), scrolla dit och pulsa samma ram.
      if (data.type === 'img-flash' && typeof data.text === 'string') flashImage(data.text)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage(
      { source: MSG_SOURCE, type: 'preview-ready' },
      window.location.origin,
    )

    // Länk-styrning: storefrontens nav-länkar är relativa (/, /tjanster …) och
    // previewen ligger på PLATTFORM-hosten — obehandlade hade ett klick laddat
    // super-admin INUTI iframen. Sidor som har en preview-tvilling SKRIVS OM till
    // /salong-preview/<slug>/<sida> (med ?theme= bevarad) så operatören kan klicka
    // runt precis som på den skarpa sidan (Zivar: "flikarna ska kunna öppnas");
    // allt annat (t.ex. /boka, externa länkar) blockeras. Capture-fasen, så inga
    // andra handlers hinner före; knappar (boknings-drawern) påverkas inte.
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      // Ankarlänkar stannar redan på samma preview-sida. Floristmallarnas
      // "Så funkar leveransen" blockerades tidigare innan browsern hann scrolla.
      if (href.startsWith('#')) return
      e.preventDefault()
      e.stopPropagation()
      if (!href.startsWith('/')) return // extern/hash → blockerad
      const m = /^\/salong-preview\/([a-z0-9-]+)/.exec(window.location.pathname)
      const slug = m?.[1]
      if (!slug) return
      const target = href.split(/[?#]/)[0]?.replace(/^\/+|\/+$/g, '') ?? ''
      if (!PREVIEW_PATHS.has(target)) return // ingen preview-tvilling → blockerad
      window.parent.postMessage(
        { source: MSG_SOURCE, type: 'preview-route', path: target ? `/${target}` : '' },
        window.location.origin,
      )
    }
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPreviewImageSlot(value: unknown): value is PreviewImageSlot {
  return ['logo_url', 'about_image', 'closing_image', 'hero_images', 'gallery_images'].includes(String(value))
}

function applyPreviewTokens(tokens: unknown) {
  const root = document.querySelector<HTMLElement>('[data-tenant]')
  if (!root) return
  const patch = isRecord(tokens) ? tokens : {}
  for (const key of TOKEN_KEYS) {
    const value = patch[key]
    if (typeof value === 'string') root.style.setProperty(key, value)
    else root.style.removeProperty(key)
  }
}

/** One complete, ephemeral V2 preview update. Theme is deliberately ignored: it
 * is read-only manifest context and customers cannot switch it from this editor. */
function applySiteSnapshotPreview(
  input: unknown,
  tokens: unknown,
  imageSlots: unknown,
  previous: SiteSnapshotPreview | null,
): SiteSnapshotPreview | null {
  if (!isRecord(input) || !isRecord(input.tenant) || !isRecord(input.settings) ||
      !isRecord(input.settings.copy) || !isRecord(input.branding)) return previous
  const snapshot = input as SiteSnapshotPreview
  const activeImageSlots = Array.isArray(imageSlots)
    ? imageSlots.filter(isPreviewImageSlot)
    : []
  restoreStableFieldMarkers()
  applyPreviewTokens(tokens)
  applySnapshotCopy(snapshot.settings.copy, previous?.settings.copy ?? null)
  markSnapshotImages(snapshot.branding, activeImageSlots)
  applySnapshotImages(snapshot.branding, previous?.branding ?? null, activeImageSlots)
  applySnapshotStats(snapshot.branding, previous?.branding ?? null)
  applySnapshotFacts(snapshot, previous)
  return snapshot
}

function applySnapshotCopy(
  copy: Record<string, unknown>,
  previous: Record<string, unknown> | null,
) {
  if (previous) {
    for (const [field, oldValue] of Object.entries(previous)) {
      const value = copy[field]
      if (typeof oldValue === 'string' && oldValue.trim() &&
          (typeof value !== 'string' || !value.trim())) restoreField(field)
    }
  }
  for (const [field, value] of Object.entries(copy)) {
    if (typeof value === 'string' && value.trim()) patchField(field, value)
  }
}

function patchAliases(names: string[], value: unknown) {
  if (typeof value !== 'string') return
  for (const name of names) patchField(name, value)
}

function patchContactLink(prefix: 'mailto:' | 'tel:', value: unknown) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const attr = prefix === 'mailto:' ? 'contact.email' : 'contact.phone'
  root.querySelectorAll<HTMLAnchorElement>(
    `a[href^="${prefix}"],[${FIELD_ATTR}="${attr}"],[${STABLE_FIELD_ATTR}="${attr}"]`,
  ).forEach((link) => {
    rememberLink(link)
    link.setAttribute(FIELD_ATTR, attr)
    const hasValue = typeof value === 'string' && !!value.trim()
    link.hidden = !hasValue
    if (!hasValue) {
      link.style.display = 'none'
      return
    }
    link.style.display = originalLinkState.get(link)?.display ?? ''
    link.href = `${prefix}${prefix === 'tel:' ? value.replace(/\s+/g, '') : value}`
    replaceTextNodes(link, value)
  })
}

function applySnapshotFacts(snapshot: SiteSnapshotPreview, previous: SiteSnapshotPreview | null) {
  patchTenantName(snapshot.tenant.name, previous?.tenant.name)
  patchAliases(['name', 'tenant.name'], snapshot.tenant.name)
  if (typeof snapshot.tenant.name === 'string') {
    document.querySelectorAll<HTMLElement>('[data-tenant-name]').forEach((el) =>
      replaceTextNodes(el, snapshot.tenant.name as string))
  }
  const contact = isRecord(snapshot.settings.contact) ? snapshot.settings.contact : {}
  patchAliases(['email', 'epost', 'contact.email'], contact.email)
  patchAliases(['phone', 'telefon', 'contact.phone'], contact.phone)
  patchContactLink('mailto:', contact.email)
  patchContactLink('tel:', contact.phone)
  const hasEmail = typeof contact.email === 'string' && !!contact.email.trim()
  const hasPhone = typeof contact.phone === 'string' && !!contact.phone.trim()
  document.querySelectorAll<HTMLElement>('[data-corevo-contact-group]').forEach((element) => {
    if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
    element.hidden = !hasEmail && !hasPhone
    element.style.display = hasEmail || hasPhone ? originalDisplay.get(element) ?? '' : 'none'
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-contact-email-break]').forEach((element) => {
    element.hidden = !hasEmail
    element.style.display = hasEmail ? '' : 'none'
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-contact-phone-row]').forEach((element) => {
    element.hidden = !hasPhone
    element.style.display = hasPhone ? '' : 'none'
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-contact-email-row]').forEach((element) => {
    element.hidden = !hasEmail
    element.style.display = hasEmail ? '' : 'none'
  })

  const social = isRecord(snapshot.settings.social) ? snapshot.settings.social : {}
  patchSocialLink('instagram', social.instagram)
  patchSocialLink('facebook', social.facebook)
  patchSocialLink('tiktok', social.tiktok)

  const address = isRecord(snapshot.location) ? snapshot.location.address : undefined
  patchAliases(['address', 'adress', 'location.address'], address)
  syncMapPreview(snapshot)
  const hasAddress = typeof address === 'string' && !!address.trim()
  document.querySelectorAll<HTMLElement>('[data-corevo-fact-group="location.address"]').forEach((element) => {
    if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
    element.hidden = !hasAddress
    element.style.display = hasAddress ? originalDisplay.get(element) ?? '' : 'none'
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-address-placeholder]').forEach((element) => {
    if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
    element.hidden = hasAddress
    element.style.display = hasAddress ? 'none' : originalDisplay.get(element) ?? ''
  })
  document.querySelectorAll<HTMLElement>('address').forEach((element) => {
    if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
    element.setAttribute(FIELD_ATTR, 'location.address')
    if (typeof address !== 'string' || !address.trim()) {
      element.style.display = 'none'
      return
    }
    element.style.display = originalDisplay.get(element) ?? ''
    rememberFieldText(element)
    replaceTextNodes(element, address)
  })

  if (Array.isArray(snapshot.settings.opening_hours)) {
    const activeHourIndexes = new Set<number>()
    snapshot.settings.opening_hours.forEach((row, index) => {
      if (!isRecord(row) || typeof row.day !== 'string' || typeof row.time !== 'string') return
      const dayIndex = SITE_DAYS.indexOf(row.day)
      const fieldIndex = dayIndex >= 0 ? dayIndex : index
      activeHourIndexes.add(fieldIndex)
      patchAliases([
        `opening_hours.${fieldIndex}.time`, `openingHours.${fieldIndex}.time`, `hours.${row.day}`,
      ], row.time)
      patchOpeningHour(row.day, row.time, fieldIndex)
    })
    document.querySelectorAll<HTMLElement>('[data-corevo-opening-group]').forEach((element) => {
      if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
      element.hidden = activeHourIndexes.size === 0
      element.style.display = activeHourIndexes.size ? originalDisplay.get(element) ?? '' : 'none'
    })
    document.querySelectorAll<HTMLElement>('[data-corevo-opening-row]').forEach((element) => {
      const index = Number(element.dataset.corevoOpeningRow)
      const visible = Number.isInteger(index) && activeHourIndexes.has(index)
      if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
      element.hidden = !visible
      element.style.display = visible ? originalDisplay.get(element) ?? '' : 'none'
    })
    document.querySelectorAll<HTMLElement>('[data-corevo-opening-placeholder]').forEach((element) => {
      if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
      element.hidden = activeHourIndexes.size > 0
      element.style.display = activeHourIndexes.size ? 'none' : originalDisplay.get(element) ?? ''
    })
  } else if (Array.isArray(previous?.settings.opening_hours)) {
    previous.settings.opening_hours.forEach((_, index) => restoreField(`opening_hours.${index}.time`))
    document.querySelectorAll<HTMLElement>('[data-corevo-opening-group],[data-corevo-opening-row]')
      .forEach((element) => {
        element.hidden = true
        element.style.display = 'none'
      })
    document.querySelectorAll<HTMLElement>('[data-corevo-opening-placeholder]').forEach((element) => {
      element.hidden = false
      element.style.display = originalDisplay.get(element) ?? ''
    })
  }

  if (isRecord(snapshot.settings.booking)) {
    window.dispatchEvent(new CustomEvent('corevo-booking-preview', {
      detail: { ...snapshot.settings.booking, tenantName: snapshot.tenant.name },
    }))
  }
}

function patchTenantName(value: unknown, previous: unknown) {
  if (typeof value !== 'string' || typeof previous !== 'string' || !previous.trim() || value === previous) return
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const pattern = new RegExp(previous.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const parent = node.parentElement
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
      node.data = node.data.replace(pattern, (match) =>
        match === match.toUpperCase() ? value.toUpperCase() : value)
    }
    current = walker.nextNode()
  }
}

function syncMapPreview(snapshot: SiteSnapshotPreview) {
  const address = isRecord(snapshot.location) && typeof snapshot.location.address === 'string'
    ? snapshot.location.address.trim()
    : ''
  const rawMap = isRecord(snapshot.settings.map) ? snapshot.settings.map : null
  const lat = typeof rawMap?.lat === 'number' && Number.isFinite(rawMap.lat) ? rawMap.lat : null
  const lon = typeof rawMap?.lon === 'number' && Number.isFinite(rawMap.lon) ? rawMap.lon : null
  const validMap = lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  const mapHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : ''
  const mapEmbed = validMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(lon - 0.004).toFixed(5)}%2C${(lat - 0.0025).toFixed(5)}%2C${(lon + 0.004).toFixed(5)}%2C${(lat + 0.0025).toFixed(5)}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lon.toFixed(6)}`
    : ''

  document.querySelectorAll<HTMLAnchorElement>('[data-corevo-map-link]').forEach((link) => {
    link.hidden = !mapHref
    link.style.display = mapHref ? '' : 'none'
    if (mapHref) link.href = mapHref
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-map-link-group]').forEach((group) => {
    group.hidden = !mapHref
    group.style.display = mapHref ? '' : 'none'
  })
  document.querySelectorAll<HTMLIFrameElement>('[data-corevo-map-embed]').forEach((frame) => {
    frame.hidden = !mapEmbed
    frame.style.display = mapEmbed ? '' : 'none'
    if (mapEmbed) frame.src = mapEmbed
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-map-group]').forEach((group) => {
    if (!originalDisplay.has(group)) originalDisplay.set(group, group.style.display)
    group.hidden = !mapEmbed
    group.style.display = mapEmbed ? originalDisplay.get(group) ?? '' : 'none'
  })
}

function patchSocialLink(kind: 'instagram' | 'facebook' | 'tiktok', value: unknown) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const hasValue = typeof value === 'string' && !!value.trim()
  root.querySelectorAll<HTMLAnchorElement>(
    `a[href*="${kind}"],[${FIELD_ATTR}="social.${kind}"],[${STABLE_FIELD_ATTR}="social.${kind}"]`,
  ).forEach((link) => {
    rememberLink(link)
    link.setAttribute(FIELD_ATTR, `social.${kind}`)
    link.hidden = !hasValue
    if (!hasValue) {
      link.style.display = 'none'
      return
    }
    const url = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
    link.style.display = originalLinkState.get(link)?.display ?? ''
    link.href = url
  })
  root.querySelectorAll<HTMLElement>('[data-corevo-social-group]').forEach((group) => {
    group.hidden = ![...group.querySelectorAll<HTMLAnchorElement>(`[${FIELD_ATTR}^="social."]`)]
      .some((link) => !link.hidden && link.style.display !== 'none')
  })
}

function rememberLink(link: HTMLAnchorElement) {
  if (originalLinkState.has(link)) return
  originalLinkState.set(link, { href: link.getAttribute('href'), display: link.style.display })
}

function patchOpeningHour(day: string, time: string, index: number) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  for (const dayElement of findTextElements(root, norm(day)).slice(0, 4)) {
    const row = dayElement.closest<HTMLElement>('li,tr,[data-day]') ?? dayElement.parentElement
    if (!row) continue
    const value = [...row.querySelectorAll<HTMLElement>('span,time,td,p,div')].find((el) => {
      if (el === dayElement || el.contains(dayElement)) return false
      const text = norm(el.textContent ?? '')
      return /(?:\d{1,2}(?::\d{2})?\s*[–-]\s*\d{1,2}|stängt|closed)/i.test(text)
    })
    if (value) {
      value.setAttribute(FIELD_ATTR, `opening_hours.${index}.time`)
      rememberFieldText(value)
      replaceTextNodes(value, time)
    }
  }
}

function markSnapshotImages(branding: Record<string, unknown>, activeSlots: PreviewImageSlot[]) {
  for (const key of ['logo_url', 'about_image', 'closing_image'] as const) {
    if (!activeSlots.includes(key)) continue
    const value = branding[key]
    if (typeof value === 'string' && value) markImageUrl(value, key)
  }
  for (const key of ['hero_images', 'gallery_images'] as const) {
    if (!activeSlots.includes(key)) continue
    const values = Array.isArray(branding[key]) ? branding[key] : []
    values.forEach((value, index) => {
      if (typeof value === 'string' && value) markImageUrl(value, `${key}.${index}`)
    })
  }
}

function markImageUrl(url: string, field: string) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    const stableField = image.getAttribute(STABLE_FIELD_ATTR)
    if (stableField) {
      image.setAttribute(FIELD_ATTR, stableField)
      continue
    }
    if (image.src === url || image.src.endsWith(url) || url.endsWith(image.getAttribute('src') ?? ' ')) {
      image.setAttribute(FIELD_ATTR, field)
      image.setAttribute(STABLE_FIELD_ATTR, field)
      return
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    const stableField = element.getAttribute(STABLE_FIELD_ATTR)
    if (stableField) {
      element.setAttribute(FIELD_ATTR, stableField)
      continue
    }
    const background = getComputedStyle(element).backgroundImage
    if (background && background !== 'none' && background.includes(url)) {
      element.setAttribute(FIELD_ATTR, field)
      element.setAttribute(STABLE_FIELD_ATTR, field)
      return
    }
  }
}

function applySnapshotImages(
  branding: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  activeSlots: PreviewImageSlot[],
) {
  for (const key of ['logo_url', 'about_image', 'closing_image'] as const) {
    if (!activeSlots.includes(key)) continue
    const value = branding[key]
    const old = previous?.[key]
    const names = [key, `branding.${key}`]
    if (typeof value === 'string' && value) {
      for (const name of names) fieldElements(name).forEach((element) => setPreviewImageVisible(element, true))
      patchImageCandidates(names, value)
    } else if (typeof old === 'string' && old) {
      for (const name of names) fieldElements(name).forEach((element) => setPreviewImageVisible(element, false))
    }
  }
  for (const key of ['hero_images', 'gallery_images'] as const) {
    if (!activeSlots.includes(key)) continue
    const values = Array.isArray(branding[key]) ? branding[key] : []
    const oldValues = previous && Array.isArray(previous[key]) ? previous[key] : []
    syncSnapshotImageList(key, values, oldValues)
  }
  if (activeSlots.includes('logo_url')) syncLogoPreview(branding.logo_url)
}

function syncSnapshotImageList(key: 'hero_images' | 'gallery_images', values: unknown[], oldValues: unknown[]) {
  const length = Math.max(values.length, oldValues.length)
  for (let index = 0; index < length; index += 1) {
    const value = values[index]
    const names = [`${key}.${index}`, `branding.${key}.${index}`]
    if (typeof value === 'string' && value) {
      for (const name of names) {
        fieldElements(name).forEach((element) => setPreviewImageVisible(element, true))
      }
      patchImageCandidates(names, value)
    } else {
      for (const name of names) {
        fieldElements(name).forEach((element) => setPreviewImageVisible(element, false))
      }
    }
  }
}

function setPreviewImageVisible(element: HTMLElement, visible: boolean) {
  if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
  element.hidden = !visible
  element.style.display = visible ? originalDisplay.get(element) ?? '' : 'none'
}

function syncLogoPreview(value: unknown) {
  const url = typeof value === 'string' ? value.trim() : ''
  document.querySelectorAll<HTMLImageElement>('[data-corevo-logo-image]').forEach((image) => {
    image.hidden = !url
    if (url) patchPreviewImageSource(image, url)
    else image.removeAttribute('src')
  })
  document.querySelectorAll<HTMLElement>('[data-corevo-logo-text]').forEach((text) => {
    text.hidden = !!url
  })
}

function applySnapshotStats(branding: Record<string, unknown>, previous: Record<string, unknown> | null) {
  const rows = Array.isArray(branding.stats) ? branding.stats : []
  const oldRows = previous && Array.isArray(previous.stats) ? previous.stats : []
  rows.forEach((row, index) => {
    if (!Array.isArray(row)) return
    const oldRow = Array.isArray(oldRows[index]) ? oldRows[index] : []
    ;[0, 1].forEach((part) => {
      const value = row[part]
      const old = oldRow[part]
      const field = `stats.${index}.${part === 0 ? 'value' : 'label'}`
      if (typeof old === 'string' && old && typeof value === 'string' && value && old !== value) {
        const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
        const hits = findTextElements(root, norm(old)).slice(0, 4)
        hits.forEach((element) => {
          element.setAttribute(FIELD_ATTR, field)
          rememberFieldText(element)
          replaceTextNodes(element, value)
        })
      } else if (typeof value === 'string' && value) {
        const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
        findTextElements(root, norm(value)).slice(0, 4).forEach((element) => element.setAttribute(FIELD_ATTR, field))
      }
    })
  })
}

function patchImageCandidates(names: string[], value: string) {
  for (const name of names) {
    for (const element of fieldElements(name)) {
      if (element instanceof HTMLImageElement) patchPreviewImageSource(element, value)
      else element.style.backgroundImage = `url("${value}")`
    }
  }
}

/** A responsive SSR image may carry candidates for the old URL. While an
 * editor-only source is active they must not outrank `src`; returning to the
 * original source restores the exact responsive attributes. */
export function patchPreviewImageSource(image: HTMLImageElement, value: string) {
  let original = originalImageState.get(image)
  if (!original) {
    original = {
      src: image.getAttribute('src'),
      srcset: image.getAttribute('srcset'),
      sizes: image.getAttribute('sizes'),
    }
    originalImageState.set(image, original)
  }
  if (original.src === value) {
    setOptionalAttribute(image, 'src', original.src)
    setOptionalAttribute(image, 'srcset', original.srcset)
    setOptionalAttribute(image, 'sizes', original.sizes)
    return
  }
  image.setAttribute('src', value)
  image.removeAttribute('srcset')
  image.removeAttribute('sizes')
}

function setOptionalAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value === null) element.removeAttribute(name)
  else element.setAttribute(name, value)
}

// Normalisera för matchning: kollapsa whitespace (heroTitle kan bära \n).
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

type FieldCandidate = { name: string; value: string }

/**
 * Storefrontens faktiska DOM är facit. Kandidaterna kommer från mallens copy-kontrakt,
 * men ett fält blir synligt i editorn först när just den route som visas verkligen
 * renderar dess nuvarande värde. Det eliminerar gamla mallfält och döda "Visa var".
 */
function scanEditableFields(fields: FieldCandidate[], requestId?: number) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  root.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`).forEach((el) => el.removeAttribute(FIELD_ATTR))
  restoreStableFieldMarkers(root)

  const grouped = new Map<string, FieldCandidate[]>()
  for (const field of fields) {
    const value = norm(field.value)
    if (!field.name || !value) continue
    const list = grouped.get(value) ?? []
    if (!list.some((item) => item.name === field.name)) list.push(field)
    grouped.set(value, list)
  }

  const found = new Set<string>()
  const counts: Record<string, number> = {}
  for (const [value, candidates] of grouped) {
    const hits = findTextElements(root, value)
    if (!hits.length) continue

    // Ett fält kan medvetet synas på flera ställen (t.ex. sidfot + band). När flera
    // fält råkar ha samma text fördelas DOM-träffarna i dokumentordning, så två rader
    // med "arkivet" inte pekar på exakt samma element.
    if (candidates.length === 1) {
      for (const hit of hits.slice(0, 12)) markField(hit, candidates[0]!.name)
      found.add(candidates[0]!.name)
      counts[candidates[0]!.name] = Math.min(hits.length, 12)
      continue
    }
    candidates.forEach((candidate, index) => {
      const hit = hits[index]
      if (!hit) return
      markField(hit, candidate.name)
      found.add(candidate.name)
      counts[candidate.name] = 1
    })
  }

  window.parent.postMessage(
    {
      source: MSG_SOURCE,
      type: 'editor-scan-result',
      requestId,
      fields: [...found],
      counts,
    },
    window.location.origin,
  )
}

function findTextElements(root: HTMLElement, wanted: string): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(TEXT_SELECTOR)].filter((el) => {
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  const exact = all.filter((el) => norm(el.textContent ?? '') === wanted)
  const candidates = exact.length
    ? exact
    : all.filter((el) => {
        const value = norm(el.textContent ?? '')
        return value.length <= wanted.length * 3 + 80 && value.includes(wanted)
      })
  return candidates.filter(
    (el) => !candidates.some((child) => child !== el && el.contains(child)),
  )
}

function markField(el: HTMLElement, name: string) {
  el.setAttribute(FIELD_ATTR, name)
}

function fieldElements(name: string): HTMLElement[] {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  return [...root.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`)].filter(
    (el) => el.getAttribute(FIELD_ATTR) === name,
  )
}

function flashField(name: string) {
  pulse(fieldElements(name).slice(0, 4))
}

/** Ändra bara textnoderna, aldrig mallens spans/italic/line-break-markup. */
function patchField(name: string, value: string) {
  for (const el of fieldElements(name)) {
    rememberFieldText(el)
    setPreviewCopyVisible(el, true)
    if (!patchSegmentedLines(el, value)) replaceTextNodes(el, value)
  }
}

export function distributePreviewLines(value: string, slotCount: number): { text: string; visible: boolean }[] {
  if (slotCount <= 0) return []
  const lines = value.split('\n')
  const result = Array.from({ length: slotCount }, () => ({ text: '', visible: false }))
  const tailIndex = slotCount - 1
  const headLines = lines.slice(0, -1)
  const headSlots = Math.max(0, slotCount - 1)
  headLines.slice(0, headSlots).forEach((text, index) => {
    result[index] = { text, visible: true }
  })
  if (headLines.length > headSlots && headSlots > 0) {
    result[headSlots - 1] = { text: headLines.slice(headSlots - 1).join('\n'), visible: true }
  }
  result[tailIndex] = { text: lines.at(-1) ?? '', visible: true }
  return result
}

function patchSegmentedLines(element: HTMLElement, value: string): boolean {
  const segments = [...element.querySelectorAll<HTMLElement>('[data-corevo-editor-line]')]
  if (!segments.length) return false
  distributePreviewLines(value, segments.length).forEach((line, index) => {
    const segment = segments[index]
    if (!segment) return
    setPreviewCopyVisible(segment, line.visible)
    if (line.visible) replaceTextNodes(segment, line.text)
  })
  return true
}

function setPreviewCopyVisible(element: HTMLElement, visible: boolean) {
  if (!originalHidden.has(element)) originalHidden.set(element, element.hidden)
  if (!originalDisplay.has(element)) originalDisplay.set(element, element.style.display)
  element.hidden = !visible
  element.style.display = visible ? originalDisplay.get(element) ?? '' : 'none'
}

/** Copy-scanningen bygger om de tillfälliga textmarkörerna. Bildplatser och
 * strukturella fakta ägs däremot av layoutens DOM och måste överleva varje scan. */
function restoreStableFieldMarkers(
  root: HTMLElement = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body,
) {
  root.querySelectorAll<HTMLElement>(`[${STABLE_FIELD_ATTR}]`).forEach((el) => {
    const field = el.getAttribute(STABLE_FIELD_ATTR)
    if (field) el.setAttribute(FIELD_ATTR, field)
  })
}

function restoreField(name: string) {
  for (const el of fieldElements(name)) {
    const original = originalFieldText.get(el)
    if (!original) continue
    const wasHidden = originalHidden.get(el)
    if (wasHidden !== undefined) setPreviewCopyVisible(el, !wasHidden)
    el.querySelectorAll<HTMLElement>('[data-corevo-editor-line]').forEach((segment) => {
      const segmentWasHidden = originalHidden.get(segment)
      if (segmentWasHidden !== undefined) setPreviewCopyVisible(segment, !segmentWasHidden)
    })
    if (!original.nodes.length) {
      el.textContent = original.fallback
      continue
    }
    for (const entry of original.nodes) {
      if (el.contains(entry.node)) entry.node.data = entry.value
    }
  }
}

function rememberFieldText(el: HTMLElement) {
  if (originalFieldText.has(el)) return
  originalFieldText.set(el, {
    nodes: editableTextNodes(el).map((node) => ({ node, value: node.data })),
    fallback: el.textContent ?? '',
  })
}

function editableTextNodes(el: HTMLElement): Text[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    const textNode = current as Text
    const parent = textNode.parentElement
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) &&
        !parent.closest('[data-corevo-editor-decoration]') && textNode.data.trim()) {
      nodes.push(textNode)
    }
    current = walker.nextNode()
  }
  return nodes
}

function replaceTextNodes(el: HTMLElement, value: string) {
  const nodes = editableTextNodes(el)
  if (!nodes.length) {
    el.textContent = value
    return
  }
  if (nodes.length === 1) {
    const raw = nodes[0]!.data
    const leading = raw.match(/^\s*/)?.[0] ?? ''
    const trailing = raw.match(/\s*$/)?.[0] ?? ''
    nodes[0]!.data = `${leading}${value}${trailing}`
    return
  }

  const weights = nodes.map((node) => Math.max(1, node.data.trim().length))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let consumed = 0
  nodes.forEach((node, index) => {
    const leading = node.data.match(/^\s*/)?.[0] ?? ''
    const trailing = node.data.match(/\s*$/)?.[0] ?? ''
    const start = Math.round((consumed / total) * value.length)
    consumed += weights[index]!
    const end = index === nodes.length - 1 ? value.length : Math.round((consumed / total) * value.length)
    node.data = `${leading}${value.slice(start, end)}${trailing}`
  })
}

/** Förhandsvisa vald lokal fil utan upload. Save-actionen är fortsatt enda live-skrivning. */
function patchImage(currentUrl: string, previewUrl: string) {
  const want = currentUrl.trim()
  if (!want || !previewUrl) return
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const hits: HTMLElement[] = []
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    const original = img.dataset.corevoPreviewOriginalSrc
    if (
      original === want ||
      img.src === want ||
      img.src.endsWith(want) ||
      want.endsWith(img.getAttribute('src') ?? ' ')
    ) {
      if (!original) img.dataset.corevoPreviewOriginalSrc = img.getAttribute('src') ?? want
      patchPreviewImageSource(img, previewUrl)
      hits.push(img)
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const original = el.dataset.corevoPreviewOriginalBg
    const background = getComputedStyle(el).backgroundImage
    if (original === want || (background && background !== 'none' && background.includes(want))) {
      if (!original) el.dataset.corevoPreviewOriginalBg = want
      el.style.backgroundImage = `url("${previewUrl}")`
      hits.push(el)
    }
  }
  pulse(hits.slice(0, 4))
}

function flashSiteField(field: string, text: string) {
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const marked = fieldElements(field)
  if (marked.length) {
    pulse(marked.slice(0, 4))
    return
  }
  if (field === 'color_bg' || field.startsWith('seo.')) {
    pulse([root])
    return
  }
  if (field === 'color_primary' || field === 'color_accent') {
    pulse([...root.querySelectorAll<HTMLElement>('a,button,h1,h2')].slice(0, 4))
    return
  }
  if (field === 'color_fg') {
    pulse([...root.querySelectorAll<HTMLElement>('h1,h2,p')].slice(0, 4))
    return
  }
  if (field.startsWith('booking.')) {
    pulse([...root.querySelectorAll<HTMLElement>('[role="dialog"],#boka-inline,.ckompakt-title,.wizard-q,a[href*="boka"],button')].slice(0, 4))
    return
  }
  if (field.startsWith('social.')) {
    const provider = field.slice('social.'.length)
    pulse([...root.querySelectorAll<HTMLElement>(`a[href*="${provider}"]`)].slice(0, 4))
    return
  }
  if (text.trim()) {
    flashText(text)
    return
  }
  pulse([root])
}

/** Markera elementen som innehåller `target`-texten: scrolla till det första och
 *  pulsa en tydlig ram/glow ~1.6 s. Matchar per ELEMENT vars egen text innehåller
 *  målet (närmast-omslutande vinner via sist-i-dokumentordning-fördjupning). */
function flashText(target: string) {
  const wanted = norm(target)
  if (!wanted) return
  const short = wanted.length > 60 ? wanted.slice(0, 60) : wanted
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const all = root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,span,em,i,a,li,div,blockquote,figcaption,small')
  const hits: HTMLElement[] = []
  for (const el of all) {
    const t = norm(el.textContent ?? '')
    if (!t || t.length > wanted.length * 3 + 80) continue // för stor container → inte "själva" texten
    if (t.includes(short)) {
      // föredra det INNERSTA träffande elementet: släng föräldrar som redan ligger i hits
      while (hits.length && hits[hits.length - 1]!.contains(el)) hits.pop()
      hits.push(el)
    }
  }
  pulse(hits.slice(0, 4))
}

/** Markera var en uppladdad BILD syns: matcha <img src> och CSS background-image
 *  mot URL:en, scrolla dit och pulsa. */
function flashImage(url: string) {
  const want = url.trim()
  if (!want) return
  const root = document.querySelector<HTMLElement>('[data-tenant]') ?? document.body
  const hits: HTMLElement[] = []
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    if (
      img.dataset.corevoPreviewOriginalSrc === want ||
      img.src === want ||
      img.src.endsWith(want) ||
      want.endsWith(img.getAttribute('src') ?? ' ')
    ) hits.push(img)
  }
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (hits.length >= 6) break
    const bg = getComputedStyle(el).backgroundImage
    if (bg && bg !== 'none' && bg.includes(want)) hits.push(el)
  }
  pulse(hits.slice(0, 4))
}

function pulse(marks: HTMLElement[]) {
  if (!marks.length) return
  marks[0]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
  for (const el of marks) {
    const prev = el.style.cssText
    el.style.outline = '2px solid #D6AC6A'
    el.style.outlineOffset = '4px'
    el.style.borderRadius = '4px'
    el.style.transition = 'outline-color .2s'
    window.setTimeout(() => {
      el.style.cssText = prev
    }, 1700)
  }
}
