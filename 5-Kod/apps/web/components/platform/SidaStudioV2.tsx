'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import {
  discardSiteDraft,
  publishSiteDraft,
  restoreSiteRevision,
  saveSiteDraft,
  uploadSiteDraftImage,
} from '@/lib/platform/actions/site-revisions'
import type { SiteRevision, SiteSnapshot } from '@/lib/platform/site-revisions'
import styles from './SidaStudioV2.module.css'

const MESSAGE_SOURCE = 'corevo-sida'
const HISTORY_BACK_TARGET = '__corevo_history_back__'
const COLOR_LABELS = {
  color_primary: 'Primärfärg',
  color_accent: 'Knappfärg',
  color_bg: 'Bakgrund',
  color_fg: 'Textfärg',
} as const
type ColorKey = keyof typeof COLOR_LABELS
type ImageSlot = 'logo_url' | 'hero_images' | 'gallery_images' | 'about_image' | 'closing_image'

export type SiteEditorField = {
  key: string
  label: string
  defaultValue?: string
  rows?: number
  help?: string
}
export type SiteEditorCard = {
  id: string
  title: string
  fields?: SiteEditorField[]
  imageSlot?: ImageSlot
  imageDefaults?: string[]
  imageLimit?: number
  statsDefaults?: [string, string][]
  info?: { text: string; href: string; label: string }
}
export type SiteEditorTab = {
  id: string
  label: string
  sub: string
  path: string
  cards: SiteEditorCard[]
  module?: string
}
export type SiteEditorManifest = {
  tabs: SiteEditorTab[]
  modules?: SiteEditorTab[]
  swatches: Partial<Record<ColorKey, string[]>>
}

type Props = {
  tenantId: string
  effectiveSnapshot: SiteSnapshot
  publishedSnapshot: SiteSnapshot
  draft: SiteRevision | null
  history: SiteRevision[]
  previewPath: string
  storefrontHost: string
  storefrontUrl: string
  isActive: boolean
  statusMessage?: string
  manifestData: SiteEditorManifest
  liveModules?: string[]
  scheduleHours: { day: string; time: string }[] | null
}

const sameSnapshot = (a: SiteSnapshot, b: SiteSnapshot) => JSON.stringify(a) === JSON.stringify(b)
const copySnapshot = (snapshot: SiteSnapshot): SiteSnapshot => structuredClone(snapshot)
const resolvePreviewSnapshot = (
  snapshot: SiteSnapshot,
  tabs: SiteEditorTab[],
  scheduleHours: { day: string; time: string }[] | null,
): SiteSnapshot => {
  const next = copySnapshot(snapshot)
  if (!next.settings.opening_hours && scheduleHours) next.settings.opening_hours = scheduleHours
  const branding = next.branding as Record<string, unknown>
  for (const card of tabs.flatMap((tab) => tab.cards)) {
    for (const field of card.fields ?? []) {
      if (!next.settings.copy[field.key]?.trim() && field.defaultValue !== undefined) {
        next.settings.copy[field.key] = field.defaultValue
      }
    }
    if (card.imageSlot && card.imageDefaults?.length) {
      const current = branding[card.imageSlot]
      const hasValue = Array.isArray(current)
        ? current.length > 0
        : typeof current === 'string' && current.length > 0
      if (!hasValue) {
        branding[card.imageSlot] = card.imageSlot === 'hero_images' || card.imageSlot === 'gallery_images'
          ? card.imageDefaults.slice(0, card.imageLimit ?? card.imageDefaults.length)
          : card.imageDefaults[0] ?? null
      } else if (Array.isArray(current) && card.imageLimit) {
        branding[card.imageSlot] = current.slice(0, card.imageLimit)
      }
    }
    if (card.statsDefaults?.length && (!Array.isArray(next.branding.stats) || !next.branding.stats.length)) {
      next.branding.stats = card.statsDefaults
    }
  }
  return next
}
const formattedTime = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

const slotRatio = (slot: ImageSlot): number => {
  if (slot === 'logo_url') return 1
  if (slot === 'hero_images' || slot === 'closing_image') return 16 / 9
  return 4 / 3
}

/** Bake the selected focus point into a real crop before R2 upload. Persisting the
 * final bitmap keeps every storefront renderer on the same image contract. */
async function cropFocusedImage(file: File, ratio: number, focusX: number, focusY: number): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const sourceRatio = bitmap.width / bitmap.height
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  if (sourceRatio > ratio) {
    sw = bitmap.height * ratio
    sx = Math.max(0, Math.min(bitmap.width - sw, (bitmap.width - sw) * focusX))
  } else {
    sh = bitmap.width / ratio
    sy = Math.max(0, Math.min(bitmap.height - sh, (bitmap.height - sh) * focusY))
  }
  const width = Math.max(1, Math.min(2200, Math.round(sw)))
  const height = Math.max(1, Math.round(width / ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('crop_failed')),
    'image/webp',
    0.9,
  ))
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'bild'}.webp`, { type: 'image/webp' })
}

export function SidaStudioV2({
  tenantId,
  effectiveSnapshot,
  publishedSnapshot,
  draft,
  history,
  previewPath,
  storefrontHost,
  storefrontUrl,
  isActive,
  statusMessage,
  manifestData,
  liveModules = [],
  scheduleHours,
}: Props) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scanRequestRef = useRef(0)
  const historyGuardRef = useRef(false)
  const allowHistoryLeaveRef = useRef(false)
  const committedLeaveRef = useRef(false)
  const [working, setWorking] = useState<SiteSnapshot>(effectiveSnapshot)
  const [savedBaseline, setSavedBaseline] = useState<SiteSnapshot>(effectiveSnapshot)
  const [published, setPublished] = useState<SiteSnapshot>(publishedSnapshot)
  const [lockVersion, setLockVersion] = useState<number | null>(draft?.lock_version ?? null)
  const [hasDraft, setHasDraft] = useState(Boolean(draft))
  const [draftAt, setDraftAt] = useState(draft?.updated_at ?? null)
  const [notice, setNotice] = useState(statusMessage ?? '')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mobileSurface, setMobileSurface] = useState<'panel' | 'preview'>('panel')
  const [leaveHref, setLeaveHref] = useState<string | null>(null)
  const [visibleCopyFields, setVisibleCopyFields] = useState<Set<string> | null>(null)
  const [isPending, startTransition] = useTransition()

  const tabs = useMemo(
    () => [
      ...manifestData.tabs,
      ...(manifestData.modules ?? []).filter((tab) => !tab.module || liveModules.includes(tab.module)),
    ],
    [liveModules, manifestData],
  )
  const [tabId, setTabId] = useState(manifestData.tabs[0]?.id ?? '')
  const activeTab = tabs.find((tab) => tab.id === tabId) ?? tabs[0]
  const dirty = !sameSnapshot(working, savedBaseline)
  const status = dirty ? 'Osparat' : hasDraft ? 'Utkast' : 'Live'
  const activeFields = useMemo(
    () => activeTab?.cards.flatMap((card) => card.fields ?? []) ?? [],
    [activeTab],
  )
  const visibleFields = useMemo(
    () => activeFields
      .filter((field) => !visibleCopyFields || visibleCopyFields.has(field.key) || field.defaultValue === '')
      .map((field) => field.key),
    [activeFields, visibleCopyFields],
  )
  const activeImageSlots = useMemo(
    () => activeTab?.cards.flatMap((card) => card.imageSlot ? [card.imageSlot] : []) ?? [],
    [activeTab],
  )
  const effectiveCopy = useMemo(
    () => activeFields.flatMap((field) => {
      const currentValue = working.settings.copy[field.key] ?? field.defaultValue ?? ''
      const publishedValue = published.settings.copy[field.key] ?? field.defaultValue ?? ''
      const current = { name: field.key, value: currentValue }
      const publishedCandidate = { name: field.key, value: publishedValue }
      return currentValue === publishedValue ? [current] : [current, publishedCandidate]
    }),
    [activeFields, published.settings.copy, working.settings.copy],
  )
  const publishedCopy = useMemo(
    () => activeFields.map((field) => ({
      name: field.key,
      value: published.settings.copy[field.key] ?? field.defaultValue ?? '',
    })),
    [activeFields, published.settings.copy],
  )
  const previewSnapshot = useMemo(
    () => resolvePreviewSnapshot(working, activeTab ? [activeTab] : [], scheduleHours),
    [activeTab, scheduleHours, working],
  )
  const publishedPreviewSnapshot = useMemo(
    () => resolvePreviewSnapshot(published, activeTab ? [activeTab] : [], scheduleHours),
    [activeTab, published, scheduleHours],
  )
  const previewSrc = `${previewPath}${activeTab?.path ?? ''}`
  const displayPath = activeTab?.path.startsWith('?')
    ? `/${activeTab.path}`
    : activeTab?.path || '/'

  const postSnapshot = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      source: MESSAGE_SOURCE,
      type: 'site-snapshot-preview',
      snapshot: previewSnapshot,
      imageSlots: activeImageSlots,
      tokens: injectTenantTokens(previewSnapshot.branding),
    }, window.location.origin)
  }, [activeImageSlots, previewSnapshot])
  const postPublishedSnapshot = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      source: MESSAGE_SOURCE,
      type: 'site-snapshot-preview',
      snapshot: publishedPreviewSnapshot,
      imageSlots: activeImageSlots,
      tokens: injectTenantTokens(publishedPreviewSnapshot.branding),
    }, window.location.origin)
  }, [activeImageSlots, publishedPreviewSnapshot])
  const scanPreview = useCallback(() => {
    const requestId = ++scanRequestRef.current
    iframeRef.current?.contentWindow?.postMessage({
      source: MESSAGE_SOURCE,
      type: 'editor-scan',
      requestId,
      fields: effectiveCopy,
    }, window.location.origin)
  }, [effectiveCopy])
  const scanPublishedPreview = useCallback(() => {
    const requestId = ++scanRequestRef.current
    iframeRef.current?.contentWindow?.postMessage({
      source: MESSAGE_SOURCE,
      type: 'editor-scan',
      requestId,
      fields: publishedCopy,
    }, window.location.origin)
  }, [publishedCopy])
  const bootstrapPreview = useCallback(() => {
    postPublishedSnapshot()
    scanPublishedPreview()
  }, [postPublishedSnapshot, scanPublishedPreview])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as { source?: string; type?: string; requestId?: number; fields?: string[]; path?: string }
      if (data.source === MESSAGE_SOURCE && data.type === 'preview-ready') {
        bootstrapPreview()
        return
      }
      if (data.source === MESSAGE_SOURCE && data.type === 'preview-route' && typeof data.path === 'string') {
        const target = tabs.find((tab) => tab.path.split('?')[0] === data.path)
        if (target) {
          setTabId(target.id)
          setMobileSurface('panel')
        }
        return
      }
      if (data.source === MESSAGE_SOURCE && data.type === 'editor-scan-result') {
        if (data.requestId !== scanRequestRef.current || !Array.isArray(data.fields)) return
        setVisibleCopyFields(new Set(data.fields))
        postSnapshot()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [bootstrapPreview, postSnapshot, tabs])
  useEffect(() => { postSnapshot() }, [postSnapshot])
  useEffect(() => { setVisibleCopyFields(null) }, [previewSrc])
  useEffect(() => {
    const timer = window.setTimeout(scanPreview, 0)
    return () => window.clearTimeout(timer)
  }, [scanPreview, previewSrc])
  useEffect(() => {
    if (dirty && !historyGuardRef.current) {
      window.history.pushState(
        { ...window.history.state, corevoSidaDirtyGuard: true },
        '',
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      )
      historyGuardRef.current = true
    } else if (!dirty && historyGuardRef.current && !committedLeaveRef.current) {
      historyGuardRef.current = false
      window.history.back()
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    const click = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.href === window.location.href) return
      event.preventDefault()
      setLeaveHref(`${url.pathname}${url.search}${url.hash}`)
    }
    const popstate = () => {
      if (allowHistoryLeaveRef.current) {
        allowHistoryLeaveRef.current = false
        historyGuardRef.current = false
        return
      }
      if (!dirty || !historyGuardRef.current) return
      window.history.pushState(
        { ...window.history.state, corevoSidaDirtyGuard: true },
        '',
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      )
      setLeaveHref(HISTORY_BACK_TARGET)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', popstate)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', popstate)
      document.removeEventListener('click', click, true)
    }
  }, [dirty])

  const update = (recipe: (snapshot: SiteSnapshot) => void) => {
    setWorking((current) => {
      const next = copySnapshot(current)
      recipe(next)
      return next
    })
    setNotice('')
  }
  const save = useCallback(async (): Promise<number | null> => {
    const result = await saveSiteDraft({
      tenantId,
      snapshot: working,
      expectedLockVersion: lockVersion,
    })
    if (result.error || result.lockVersion == null) {
      setNotice(result.error ?? 'Utkastet kunde inte sparas.')
      return null
    }
    setLockVersion(result.lockVersion)
    setHasDraft(true)
    setDraftAt(new Date().toISOString())
    const resolved = copySnapshot(result.snapshot ?? working)
    setWorking(resolved)
    setSavedBaseline(resolved)
    setNotice(result.success ?? 'Utkastet är sparat.')
    return result.lockVersion
  }, [lockVersion, tenantId, working])
  const runSave = () => startTransition(() => { void save() })
  const runPublish = () => startTransition(async () => {
    let version = lockVersion
    if (dirty) version = await save()
    if (version == null) return
    const result = await publishSiteDraft({ tenantId, expectedLockVersion: version })
    if (result.error) {
      setNotice(result.error)
      return
    }
    const snapshot = copySnapshot(result.snapshot ?? working)
    setWorking(snapshot)
    setPublished(snapshot)
    setSavedBaseline(snapshot)
    setLockVersion(null)
    setHasDraft(false)
    setDraftAt(null)
    setNotice(result.success ?? 'Sidan är publicerad.')
    router.refresh()
  })
  const runDiscard = () => startTransition(async () => {
    if (hasDraft && lockVersion != null) {
      const result = await discardSiteDraft({ tenantId, expectedLockVersion: lockVersion })
      if (result.error) {
        setNotice(result.error)
        return
      }
    }
    const snapshot = copySnapshot(published)
    setWorking(snapshot)
    setSavedBaseline(snapshot)
    setLockVersion(null)
    setHasDraft(false)
    setDraftAt(null)
    setNotice('Utkastet har kastats.')
  })
  const runRestore = (revision: SiteRevision) => startTransition(async () => {
    const result = await restoreSiteRevision({
      tenantId,
      sourceRevisionId: revision.id,
      expectedLockVersion: lockVersion,
    })
    if (result.error || result.lockVersion == null) {
      setNotice(result.error ?? 'Versionen kunde inte återställas.')
      return
    }
    const snapshot = copySnapshot(revision.snapshot)
    setWorking(snapshot)
    setSavedBaseline(snapshot)
    setLockVersion(result.lockVersion)
    setHasDraft(true)
    setDraftAt(new Date().toISOString())
    setNotice(result.success ?? 'Versionen har återställts som utkast.')
  })
  const saveAndLeave = () => startTransition(async () => {
    const href = leaveHref
    committedLeaveRef.current = Boolean(href)
    const version = await save()
    if (version == null || !href) {
      committedLeaveRef.current = false
      return
    }
    if (href === HISTORY_BACK_TARGET) {
      allowHistoryLeaveRef.current = true
      window.history.go(-2)
      return
    }
    router.push(href)
  })
  const discardAndLeave = () => {
    const href = leaveHref
    committedLeaveRef.current = Boolean(href)
    setWorking(copySnapshot(savedBaseline))
    setLeaveHref(null)
    if (href === HISTORY_BACK_TARGET) {
      allowHistoryLeaveRef.current = true
      window.history.go(-2)
      return
    }
    if (href) router.push(href)
  }

  const showField = (field: string, value: string) => {
    const imageField = ['logo_url', 'hero_images', 'gallery_images', 'about_image', 'closing_image']
      .some((slot) => field === slot || field.startsWith(`${slot}.`))
    iframeRef.current?.contentWindow?.postMessage({
      source: MESSAGE_SOURCE,
      type: imageField ? 'img-flash' : field in working.settings.copy ? 'copy-flash-field' : 'site-field-flash',
      field,
      text: value,
    }, window.location.origin)
  }
  const previewImage = (currentUrl: string, url: string) => iframeRef.current?.contentWindow?.postMessage({
    source: MESSAGE_SOURCE,
    type: 'image-preview',
    currentUrl,
    url,
  }, window.location.origin)

  return (
    <section className={`sida-studio-host ${styles.shell}`} data-accept="editor-shell">
      <header className={styles.toolbar} data-accept="editor-toolbar">
        <div className={styles.identity}>
          <strong>Redigera sidan</strong>
          <span>{storefrontHost}{displayPath}</span>
        </div>
        <nav className={styles.tabs} data-accept="editor-tabs" aria-label="Sidans delar">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={tab.id === activeTab?.id ? styles.activeTab : ''}
              onClick={() => { setTabId(tab.id); setMobileSurface('panel') }} title={tab.sub}>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className={styles.toolbarActions}>
          <span className={`${styles.status} ${styles[`status${status}`]}`} data-accept="editor-status"
            title={dirty ? 'Ändringar finns bara i förhandsvisningen' : hasDraft ? 'Besökare ser fortfarande den publicerade versionen' : 'Besökare ser den här versionen'}>
            <i />{status}
          </span>
          <div className={styles.deviceButtons}>
            <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>Dator</button>
            <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>Mobil</button>
          </div>
          <a href={storefrontUrl} target="_blank" rel="noreferrer">Öppna live ↗</a>
          <button type="button" className={styles.secondary} disabled={!dirty || isPending} onClick={runSave}>Spara utkast</button>
          <button type="button" className={styles.primary} disabled={(!dirty && !hasDraft) || isPending} onClick={runPublish}>Publicera</button>
        </div>
      </header>

      {hasDraft && !dirty ? (
        <div className={styles.draftBanner} data-accept="draft-banner">
          <span>Utkast sparat {formattedTime(draftAt)} — besökare ser fortfarande den publicerade versionen.</span>
          <button type="button" onClick={runPublish} disabled={isPending}>Publicera nu</button>
          <button type="button" onClick={runDiscard} disabled={isPending}>Kasta utkast</button>
        </div>
      ) : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      <div className={styles.mobileSwitch} aria-label="Redigeringsvy">
        <button type="button" aria-pressed={mobileSurface === 'panel'} onClick={() => setMobileSurface('panel')}>Panel</button>
        <button type="button" aria-pressed={mobileSurface === 'preview'} onClick={() => setMobileSurface('preview')}>Förhandsvisning</button>
      </div>

      <div className={styles.workspace}>
        <div className={`${styles.panel} ${mobileSurface === 'preview' ? styles.mobileHidden : ''}`} data-accept="editor-panel">
          {activeTab?.id === 'allmant' ? (
            <>
              <EditorCard title="Företagsnamn">
                <FieldShell label="Företagsnamn" custom={working.tenant.name !== published.tenant.name}
                  help="Visas i sidhuvudet, sidfoten och bokningen. Samma namn som i er admin."
                  field="name" value={working.tenant.name} onShow={showField}>
                  <input value={working.tenant.name} onChange={(event) => update((next) => { next.tenant.name = event.target.value })}
                    data-corevo-editor-field="name" />
                </FieldShell>
              </EditorCard>
              <EditorCard title="Varumärke — färger">
                <p className={styles.cardNote}>Sidan har färdiga standardfärger — ändra bara det ni vill avvika från.</p>
                {(Object.keys(COLOR_LABELS) as ColorKey[]).map((key) => (
                  <ColorField key={key} name={key} value={working.branding[key] ?? ''}
                    options={manifestData.swatches[key] ?? []} onChange={(value) => update((next) => { next.branding[key] = value || null })}
                    onShow={() => showField(key, working.branding[key] ?? '')} />
                ))}
              </EditorCard>
              <EditorCard title="Typsnitt">
                <div className={styles.info}><span aria-hidden="true">ⓘ</span>
                  <p>Typsnitten är valda för att passa ihop och läsas bra på mobil. Vill ni en annan stil — hör av er till oss på Corevo.</p>
                  <a href="mailto:hej@corevo.se">Kontakta Corevo →</a>
                </div>
              </EditorCard>
              <EditorCard title="Google">
                <PlainField label="Sidtitel" value={working.settings.seo.title ?? ''} field="seo.title" onShow={showField}
                  onChange={(value) => update((next) => { next.settings.seo.title = value || null })} />
                <PlainField label="Beskrivning" value={working.settings.seo.description ?? ''} field="seo.description" rows={3} onShow={showField}
                  onChange={(value) => update((next) => { next.settings.seo.description = value || null })} />
              </EditorCard>
              <EditorCard title="Versionshistorik">
                <button type="button" className={styles.textButton} onClick={() => update((next) => Object.assign(next, copySnapshot(published)))}>
                  Återställ till publicerad version
                </button>
                {history.length ? <ul className={styles.history}>{history.map((revision) => (
                  <li key={revision.id}><span>{formattedTime(revision.published_at ?? revision.updated_at)}</span>
                    <button type="button" onClick={() => runRestore(revision)} disabled={isPending}>Återställ</button></li>
                ))}</ul> : <p className={styles.cardNote}>Ingen tidigare publicering ännu.</p>}
              </EditorCard>
            </>
          ) : null}

          {activeTab?.cards.map((card) => {
            const fields = card.fields?.filter((field) => visibleFields.includes(field.key)) ?? []
            if (!fields.length && !card.imageSlot && !card.statsDefaults && !card.info) return null
            return (
            <EditorCard key={card.id} title={card.title}>
              {fields.map((field) => <CopyField key={field.key} field={field} snapshot={working}
                onChange={(value) => update((next) => {
                  if (!value.trim() || value === field.defaultValue) delete next.settings.copy[field.key]
                  else next.settings.copy[field.key] = value
                })} onShow={showField} />)}
              {card.imageSlot ? <ImageField tenantId={tenantId} slot={card.imageSlot} snapshot={working}
                defaults={card.imageDefaults ?? []} limit={card.imageLimit ?? 1} onChange={update} onShow={showField} onPreview={previewImage} /> : null}
              {card.statsDefaults ? <StatsFields snapshot={working} defaults={card.statsDefaults} update={update} onShow={showField} /> : null}
              {card.info ? <div className={styles.info}><span aria-hidden="true">ⓘ</span><p>{card.info.text}</p>
                <a href={card.info.href}>{card.info.label} →</a></div> : null}
            </EditorCard>
            )
          })}

          {activeTab?.id === 'kontakt' ? <ContactFields snapshot={working} scheduleHours={scheduleHours} update={update} onShow={showField} /> : null}
          {activeTab?.id === 'bokning' ? <BookingFields snapshot={working} published={published} update={update} onShow={showField} /> : null}
        </div>

        <div className={`${styles.preview} ${mobileSurface === 'panel' ? styles.mobileHidden : ''}`} data-accept="editor-preview">
          <div className={`${styles.previewDevice} ${device === 'mobile' ? styles.mobileDevice : ''}`} data-accept="preview-device">
            {isActive ? <iframe ref={iframeRef} src={previewSrc} title={`Förhandsvisning av ${activeTab?.label ?? 'sidan'}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups" onLoad={bootstrapPreview} />
              : <div className={styles.blocked}><strong>Sidan är pausad</strong><p>Kontakta Corevo för att aktivera förhandsvisningen.</p></div>}
          </div>
        </div>
      </div>

      <button type="button" className={styles.mobilePublish} disabled={(!dirty && !hasDraft) || isPending} onClick={runPublish}>Publicera</button>

      {leaveHref ? <div className={styles.dialogBackdrop} role="presentation">
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="leave-title" data-accept="leave-dialog">
          <h2 id="leave-title">Lämna redigeraren?</h2>
          <p>Du har osparade ändringar.</p>
          <button type="button" className={styles.primary} onClick={saveAndLeave} disabled={isPending}>Spara utkast och lämna</button>
          <button type="button" className={styles.danger} onClick={discardAndLeave}>Kasta ändringarna</button>
          <button type="button" className={styles.secondary} onClick={() => setLeaveHref(null)}>Stanna kvar</button>
        </div>
      </div> : null}
    </section>
  )
}

function EditorCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.card}><h2>{title}</h2>{children}</section>
}

function FieldShell({ label, custom, help, field, value, onShow, children }: {
  label: string; custom: boolean; help?: string; field: string; value: string
  onShow: (field: string, value: string) => void; children: React.ReactNode
}) {
  return <label className={styles.field}><span className={styles.fieldHead}><b>{label}</b>
    <i className={custom ? styles.customChip : styles.standardChip}>{custom ? 'EGEN TEXT' : 'STANDARD'}</i></span>
    {children}{help ? <small>{help}</small> : null}
    <button type="button" className={styles.showButton} data-accept={`show-field-${field}`} onClick={(event) => { event.preventDefault(); onShow(field, value) }}>Visa var</button>
  </label>
}

function CopyField({ field, snapshot, onChange, onShow }: {
  field: SiteEditorField; snapshot: SiteSnapshot; onChange: (value: string) => void
  onShow: (field: string, value: string) => void
}) {
  const custom = Object.prototype.hasOwnProperty.call(snapshot.settings.copy, field.key)
  const value = snapshot.settings.copy[field.key] ?? field.defaultValue ?? ''
  return <FieldShell label={field.label} custom={custom} help={field.help} field={field.key} value={value} onShow={onShow}>
    {field.rows && field.rows > 1 ? <textarea rows={field.rows} value={value} onChange={(e) => onChange(e.target.value)} data-corevo-editor-field={field.key} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} data-corevo-editor-field={field.key} />}
  </FieldShell>
}

function PlainField({ label, value, field, rows, onChange, onShow }: {
  label: string; value: string; field: string; rows?: number; onChange: (value: string) => void
  onShow: (field: string, value: string) => void
}) {
  return <FieldShell label={label} custom={Boolean(value)} field={field} value={value} onShow={onShow}>
    {rows ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} data-corevo-editor-field={field} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} data-corevo-editor-field={field} />}
  </FieldShell>
}

function ColorField({ name, value, options, onChange, onShow }: {
  name: ColorKey; value: string; options: string[]; onChange: (value: string) => void; onShow: () => void
}) {
  const choices = value && !options.includes(value) ? [...options, value] : options
  return <div className={styles.colorField}><span className={styles.fieldHead}><b>{COLOR_LABELS[name]}</b>
    <i className={value ? styles.customChip : styles.standardChip}>{value ? 'EGEN FÄRG' : 'STANDARD'}</i></span>
    <div className={styles.swatches}><button type="button" className={!value ? styles.swatchActive : ''} onClick={() => onChange('')}>Standard</button>
      {choices.map((color) => <button key={color} type="button" className={value === color ? styles.swatchActive : ''}
        aria-label={`${COLOR_LABELS[name]} ${color}`} title={color} style={{ background: color }} onClick={() => onChange(color)} />)}</div>
    <button type="button" className={styles.showButton} data-accept={`show-field-${name}`} onClick={onShow}>Visa var</button>
  </div>
}

function ImageField({ tenantId, slot, snapshot, defaults, limit, onChange, onShow, onPreview }: {
  tenantId: string; slot: ImageSlot; snapshot: SiteSnapshot; defaults: string[]; limit: number
  onChange: (recipe: (snapshot: SiteSnapshot) => void) => void
  onShow: (field: string, value: string) => void
  onPreview: (currentUrl: string, url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [targetIndex, setTargetIndex] = useState(0)
  const [crop, setCrop] = useState<{ file: File; url: string; x: number; y: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const raw = snapshot.branding[slot]
  const customValues = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : []
  const hasCustom = customValues.length > 0
  const values = hasCustom ? customValues : defaults
  const visibleValues = values.slice(0, limit)
  const multiple = slot === 'hero_images' || slot === 'gallery_images'
  const canReorder = multiple && visibleValues.length > 1
  const set = (index: number, value: string) => onChange((next) => {
    if (multiple) {
      const list = hasCustom ? [...customValues] : [...defaults]
      if (value) list[index] = value
      else list.splice(index, 1)
      next.branding[slot] = list
    } else next.branding[slot] = value || null
  })
  const move = (from: number | null, to: number) => {
    if (!canReorder || from == null || from === to || from < 0 || to < 0 || from >= visibleValues.length || to >= visibleValues.length) return
    const reordered = [...values]
    const [item] = reordered.splice(from, 1)
    if (!item) return
    reordered.splice(to, 0, item)
    onChange((next) => { next.branding[slot] = reordered })
    setDraggedIndex(null)
  }
  const cropUrl = crop?.url
  useEffect(() => () => {
    if (cropUrl) URL.revokeObjectURL(cropUrl)
  }, [cropUrl])
  const choose = (index: number) => {
    setTargetIndex(index)
    setError('')
    inputRef.current?.click()
  }
  const selectFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Välj en bildfil.')
      return
    }
    setCrop({ file, url: URL.createObjectURL(file), x: 0.5, y: 0.5 })
  }
  const upload = async () => {
    if (!crop) return
    setUploading(true)
    setError('')
    try {
      const image = await cropFocusedImage(crop.file, slotRatio(slot), crop.x, crop.y)
      const fd = new FormData()
      fd.set('tenantId', tenantId)
      fd.set('image', image)
      const result = await uploadSiteDraftImage(fd)
      if (!result.url) {
        setError(result.error ?? 'Uppladdningen misslyckades.')
        return
      }
      const current = visibleValues[targetIndex] ?? defaults[targetIndex] ?? ''
      if (current) onPreview(current, result.url)
      set(targetIndex, result.url)
      setCrop(null)
    } catch {
      setError('Bilden kunde inte beskäras. Välj en annan bild.')
    } finally {
      setUploading(false)
    }
  }
  return <div className={styles.images}>
    <input ref={inputRef} className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
      onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = '' }} />
    <span className={hasCustom ? styles.customChip : styles.standardChip}>EGNA BILDER</span>
    {visibleValues.map((url, index) => <div className={styles.imageRow} key={`${url}-${index}`}
      draggable={canReorder}
      onDragStart={(event) => {
        setDraggedIndex(index)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
      }}
      onDragOver={(event) => { if (canReorder) event.preventDefault() }}
      onDrop={() => move(draggedIndex, index)}
      onDragEnd={() => setDraggedIndex(null)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" />
      <button type="button" onClick={() => choose(index)}>Byt bild</button>
      {hasCustom ? <button type="button" onClick={() => {
        const fallback = defaults[index] ?? ''
        onPreview(url, fallback)
        set(index, '')
      }}>Ta bort</button> : null}
      {canReorder ? <div className={styles.imageOrder}>
        <button type="button" aria-label={`Flytta bild ${index + 1} upp`} disabled={index === 0}
          onClick={() => move(index, index - 1)}>Upp</button>
        <button type="button" aria-label={`Flytta bild ${index + 1} ner`} disabled={index === visibleValues.length - 1}
          onClick={() => move(index, index + 1)}>Ner</button>
      </div> : null}
      <button type="button" className={styles.showButton} data-accept={`show-field-${slot}-${index}`} onClick={() => onShow(`${slot}.${index}`, url)}>Visa var</button>
    </div>)}
    {multiple && visibleValues.length < limit ? <button type="button" className={styles.textButton} onClick={() => choose(visibleValues.length)}>+ Lägg till bild</button> : null}
    {!visibleValues.length && !multiple ? <button type="button" className={styles.textButton} onClick={() => choose(0)}>Byt bild</button> : null}
    {crop ? <div className={styles.cropEditor} data-accept="image-crop">
      <div className={styles.cropViewport} style={{ aspectRatio: String(slotRatio(slot)) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crop.url} alt="Beskärningsförhandsvisning"
          style={{ objectPosition: `${crop.x * 100}% ${crop.y * 100}%` }} />
      </div>
      <label>Fokus vågrätt<input type="range" min="0" max="1" step="0.01" value={crop.x}
        onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) })} /></label>
      <label>Fokus lodrätt<input type="range" min="0" max="1" step="0.01" value={crop.y}
        onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) })} /></label>
      <div className={styles.cropActions}><button type="button" className={styles.primary} disabled={uploading} onClick={() => void upload()}>
        {uploading ? 'Laddar upp…' : 'Beskär och använd'}
      </button><button type="button" className={styles.secondary} disabled={uploading} onClick={() => setCrop(null)}>Avbryt</button></div>
    </div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <p className={styles.cardNote}>Egna bilder ersätter standardens.{canReorder ? ' Dra för att ändra ordning.' : ''}</p>
  </div>
}

function StatsFields({ snapshot, defaults, update, onShow }: {
  snapshot: SiteSnapshot; defaults: [string, string][]
  update: (recipe: (snapshot: SiteSnapshot) => void) => void
  onShow: (field: string, value: string) => void
}) {
  const custom = Array.isArray(snapshot.branding.stats) && snapshot.branding.stats.length > 0
  const rows = custom ? snapshot.branding.stats! : defaults
  const set = (index: number, part: 0 | 1, value: string) => update((next) => {
    if (!value.trim()) return
    const nextRows = rows.map((row) => [...row] as [string, string])
    nextRows[index]![part] = value
    next.branding.stats = JSON.stringify(nextRows) !== JSON.stringify(defaults)
      ? nextRows
      : null
  })
  return <div className={styles.stats}>
    <span className={custom ? styles.customChip : styles.standardChip}>{custom ? 'EGEN TEXT' : 'STANDARD'}</span>
    <p className={styles.cardNote}>Värdet visas stort och etiketten direkt under.</p>
    {rows.map(([value, label], index) => <div className={styles.statRow} key={index}>
      <PlainField label={`Värde ${index + 1}`} field={`stats.${index}.value`} value={value} onShow={onShow}
        onChange={(next) => set(index, 0, next)} />
      <PlainField label={`Etikett ${index + 1}`} field={`stats.${index}.label`} value={label} onShow={onShow}
        onChange={(next) => set(index, 1, next)} />
    </div>)}
  </div>
}

function ContactFields({ snapshot, scheduleHours, update, onShow }: {
  snapshot: SiteSnapshot; scheduleHours: { day: string; time: string }[] | null
  update: (recipe: (snapshot: SiteSnapshot) => void) => void
  onShow: (field: string, value: string) => void
}) {
  const entries: [string, string, string, (next: SiteSnapshot, value: string) => void][] = [
    ['E-post', 'contact.email', snapshot.settings.contact.email ?? '', (n, v) => { n.settings.contact.email = v || null }],
    ['Telefon', 'contact.phone', snapshot.settings.contact.phone ?? '', (n, v) => { n.settings.contact.phone = v || null }],
    ['Adress', 'location.address', snapshot.location.address ?? '', (n, v) => {
      n.location.address = v || null
      n.settings.map = null
    }],
    ['Instagram', 'social.instagram', snapshot.settings.social.instagram ?? '', (n, v) => { n.settings.social.instagram = v || null }],
    ['Facebook', 'social.facebook', snapshot.settings.social.facebook ?? '', (n, v) => { n.settings.social.facebook = v || null }],
    ['TikTok', 'social.tiktok', snapshot.settings.social.tiktok ?? '', (n, v) => { n.settings.social.tiktok = v || null }],
  ]
  const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
  const manualHours = snapshot.settings.opening_hours
  const hours = manualHours ?? scheduleHours ?? []
  return <>
    <EditorCard title="Kontakt, adress & sociala medier">{entries.map(([label, field, value, assign]) =>
      <PlainField key={field} label={label} field={field} value={value} onShow={onShow} onChange={(next) => update((draft) => assign(draft, next))} />)}</EditorCard>
    <EditorCard title="Öppettider"><span className={manualHours?.length ? styles.customChip : styles.standardChip}>{manualHours?.length ? 'EGNA TIDER' : 'FRÅN SCHEMAN'}</span>
      <div className={styles.hours}>{days.map((day, index) => <PlainField key={day} label={day} field={`opening_hours.${index}.time`}
        value={hours.find((row) => row.day === day)?.time ?? ''} onShow={onShow} onChange={(value) => update((next) => {
          const source = next.settings.opening_hours ?? scheduleHours ?? []
          const list = days.map((name) => ({ day: name, time: source.find((row) => row.day === name)?.time ?? '' }))
          list[index] = { day, time: value }
          next.settings.opening_hours = list.some((row) => row.time.trim()) ? list.filter((row) => row.time.trim()) : null
        })} />)}</div></EditorCard>
  </>
}

function BookingFields({ snapshot, published, update, onShow }: {
  snapshot: SiteSnapshot; published: SiteSnapshot
  update: (recipe: (snapshot: SiteSnapshot) => void) => void
  onShow: (field: string, value: string) => void
}) {
  return <EditorCard title="Bokningsflödet">
    <SelectField label="Presentation" field="booking.variant" value={snapshot.settings.booking.variant}
      options={[['wizard', 'Steg för steg'], ['compact', 'Snabbboka'], ['drawer', 'Panel'], ['inline', 'Inbyggd']]}
      custom={snapshot.settings.booking.variant !== published.settings.booking.variant}
      onShow={onShow} onChange={(value) => update((next) => { next.settings.booking.variant = value as SiteSnapshot['settings']['booking']['variant'] })} />
    <SelectField label="Datumväljare" field="booking.pickerMode" value={snapshot.settings.booking.pickerMode}
      options={[['calendar', 'Kalender'], ['strip', 'Dagremsa']]}
      custom={snapshot.settings.booking.pickerMode !== published.settings.booking.pickerMode} onShow={onShow}
      onChange={(value) => update((next) => { next.settings.booking.pickerMode = value as SiteSnapshot['settings']['booking']['pickerMode'] })} />
    <SelectField label="Personalbilder" field="booking.staffAvatars" value={snapshot.settings.booking.staffAvatars}
      options={[['foto', 'Foto'], ['initialer', 'Initialer'], ['namn', 'Namn']]}
      custom={snapshot.settings.booking.staffAvatars !== published.settings.booking.staffAvatars} onShow={onShow}
      onChange={(value) => update((next) => { next.settings.booking.staffAvatars = value as SiteSnapshot['settings']['booking']['staffAvatars'] })} />
  </EditorCard>
}

function SelectField({ label, field, value, options, custom, onChange, onShow }: {
  label: string; field: string; value: string; options: [string, string][]; custom: boolean
  onChange: (value: string) => void; onShow: (field: string, value: string) => void
}) {
  return <label className={styles.field}><span className={styles.fieldHead}><b>{label}</b>
    <i className={custom ? styles.customChip : styles.standardChip}>{custom ? 'EGEN TEXT' : 'STANDARD'}</i></span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select>
    <button type="button" className={styles.showButton} data-accept={`show-field-${field}`} onClick={(e) => { e.preventDefault(); onShow(field, value) }}>Visa var</button>
  </label>
}
