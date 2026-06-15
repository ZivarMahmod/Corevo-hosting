'use client'

// Super-admin VISUAL HUB (multi-bransch spår 4) — v1 fundament.
//
// Shows a tenant's REAL live storefront in an <iframe> on /salonger/[id], plus the
// slot-overlay scaffold: an edit-mode toggle, a postMessage listener for slot clicks
// coming from the (future-instrumented) storefront, and a SlotEditDrawer that does
// the v1 write — IMAGE SLOT SWAP (upload a new image or pick an existing one →
// content_slots). Text/module slots are listed read-only; the full page-builder is a
// later wave. This component is the seam everything later hangs off.
//
// BOUNDARY (next build, not tsc): this is a 'use client' file. It imports ONLY
// client-safe types/helpers from ./preview-slots and CALLS the server actions in
// @/lib/platform/preview-admin (a 'use server' module — calling it from the client
// is the supported pattern, exactly like ModulesCard → setModuleState). It never
// imports a `server-only` module (that is what breaks the build).
//
// Today's prod reality: template_slots is EMPTY, so the drawer shows an honest "no
// editable slots yet" state and the iframe still renders the live page. As soon as a
// template is seeded (Wave A mall-import), slots light up with no change here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/portal/ui'
import {
  listTenantSlots,
  listTenantAssets,
  saveImageSlot,
  saveTextSlot,
} from '@/lib/platform/preview-admin'
import {
  parseInboundMessage,
  PREVIEW_MESSAGE_SOURCE,
  PREVIEW_IMAGE_ACCEPT,
  PREVIEW_IMAGE_MAX_BYTES,
  PREVIEW_TEXT_MAX,
  type PreviewSlot,
  type PreviewAsset,
  type PreviewOutboundMessage,
} from '@/lib/platform/preview-slots'
import styles from './TenantPreviewFrame.module.css'

// Short one-line preview of a text slot's current value for the slot list.
function truncateText(s: string, max = 40): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

type Props = {
  tenantId: string
  /** The tenant's REAL public storefront origin (https://<slug>.corevo.se or custom
   *  domain) — the iframe src and the "open in new tab" target. */
  storefrontUrl: string
  /** Bare host for display, e.g. "freshcut.corevo.se". */
  storefrontHost: string
  /** Active template key (settings.theme, fenced) — which template's slots we edit. */
  templateKey: string
  /** Whether the salon is active. A suspended salon's storefront is blocked, so we
   *  show a notice instead of an iframe that would render the paused banner. */
  isActive: boolean
}

export function TenantPreviewFrame({
  tenantId,
  storefrontUrl,
  storefrontHost,
  templateKey,
  isActive,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null)

  const [slots, setSlots] = useState<PreviewSlot[] | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Cache-bust token: bumping it forces the iframe to reload after a save so the new
  // image shows (the storefront cache was already revalidated server-side).
  const [reloadToken, setReloadToken] = useState(0)

  const iframeSrc = useMemo(() => {
    const sep = storefrontUrl.includes('?') ? '&' : '?'
    return reloadToken > 0 ? `${storefrontUrl}${sep}_p=${reloadToken}` : storefrontUrl
  }, [storefrontUrl, reloadToken])

  // ── load editable slots (lazy: first time the drawer is opened) ────────────────
  const loadSlots = useCallback(async () => {
    setLoadingSlots(true)
    setSlotError(null)
    const res = await listTenantSlots(tenantId, templateKey)
    if (res.ok) setSlots(res.slots)
    else setSlotError(res.error)
    setLoadingSlots(false)
  }, [tenantId, templateKey])

  // ── postMessage → storefront (edit-mode + slot-updated). Best-effort: the
  //    storefront may not be instrumented yet, so we targetOrigin to the storefront
  //    origin and never assume a reply. ────────────────────────────────────────────
  const postToStorefront = useCallback(
    (msg: PreviewOutboundMessage) => {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      try {
        win.postMessage(msg, new URL(storefrontUrl).origin)
      } catch {
        /* cross-origin frame not ready / blocked — harmless, the drawer is the path */
      }
    },
    [storefrontUrl],
  )

  // ── postMessage ← storefront (slot clicks). SCAFFOLD: when the storefront marks
  //    slot elements and posts a {source:'corevo-preview', type:'slot-click'} the
  //    overlay opens that slot directly. Until then this listener is inert (no such
  //    messages arrive) and editing happens via the drawer's slot list. We strictly
  //    validate source + origin so a foreign message can never drive the UI. ────────
  useEffect(() => {
    const storefrontOrigin = (() => {
      try {
        return new URL(storefrontUrl).origin
      } catch {
        return null
      }
    })()
    function onMessage(e: MessageEvent) {
      if (storefrontOrigin && e.origin !== storefrontOrigin) return
      const msg = parseInboundMessage(e.data)
      if (!msg) return
      if (msg.type === 'slot-click') {
        setActiveSlotKey(msg.slotKey)
        setDrawerOpen(true)
        if (!slots) void loadSlots()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [storefrontUrl, slots, loadSlots])

  function toggleEditMode() {
    const next = !editMode
    setEditMode(next)
    postToStorefront({ source: PREVIEW_MESSAGE_SOURCE, type: 'edit-mode', enabled: next })
    if (next) {
      setDrawerOpen(true)
      if (!slots) void loadSlots()
    } else {
      setDrawerOpen(false)
    }
  }

  function openDrawer() {
    setDrawerOpen(true)
    if (!slots) void loadSlots()
  }

  // After a successful image swap: refresh the slot list, hard-reload the iframe, and
  // nudge the storefront (if instrumented) to soft-update.
  const onSlotSaved = useCallback(
    (slotKey: string) => {
      void loadSlots()
      setReloadToken((t) => t + 1)
      postToStorefront({ source: PREVIEW_MESSAGE_SOURCE, type: 'slot-updated', slotKey })
    },
    [loadSlots, postToStorefront],
  )

  const editableSlots = slots?.filter((s) => s.kind === 'asset' || s.kind === 'text') ?? []

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.host}>{storefrontHost}</span>
          <Badge tone="neutral">mall: {templateKey}</Badge>
          {editMode ? <Badge tone="warning">Redigeringsläge</Badge> : null}
        </div>
        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => setReloadToken((t) => t + 1)}
            title="Ladda om förhandsvisningen"
          >
            Ladda om
          </button>
          <a
            className={styles.tbBtn}
            href={storefrontUrl}
            target="_blank"
            rel="noreferrer"
            title="Öppna live-sidan i ny flik"
          >
            Öppna live ↗
          </a>
          <button
            type="button"
            className={editMode ? styles.tbBtnActive : styles.tbBtnPrimary}
            onClick={toggleEditMode}
          >
            {editMode ? 'Avsluta redigering' : 'Redigera innehåll'}
          </button>
        </div>
      </div>

      <div className={styles.stage}>
        {isActive ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className={styles.frame}
            title={`Förhandsvisning av ${storefrontHost}`}
            // Allow scripts so the live storefront runs; keep same-origin OFF (it is
            // cross-origin anyway) — this is the tenant's own page, sandboxed for safety.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
          />
        ) : (
          <div className={styles.blocked}>
            <strong>Storefronten är pausad</strong>
            <p>
              Salongen är inte aktiv, så den publika sidan är blockerad (RLS). Återaktivera
              salongen i Drift för att förhandsvisa och redigera innehållet.
            </p>
          </div>
        )}

        {editMode && drawerOpen ? (
          <SlotEditDrawer
            tenantId={tenantId}
            templateKey={templateKey}
            slots={editableSlots}
            allSlots={slots}
            loading={loadingSlots}
            error={slotError}
            activeSlotKey={activeSlotKey}
            onPickSlot={setActiveSlotKey}
            onClose={() => setDrawerOpen(false)}
            onSaved={onSlotSaved}
          />
        ) : null}
      </div>

      {!editMode ? (
        <p className={styles.hint}>
          Live-förhandsvisning av kundens skarpa sida. <button type="button" className={styles.linkBtn} onClick={openDrawer}>Redigera innehåll</button> för att
          byta bilder och texter på sidan. Moduler och sektioner kommer härnäst.
        </p>
      ) : null}
    </div>
  )
}

// ── Slot edit drawer — v1: image swap ──────────────────────────────────────────────
function SlotEditDrawer({
  tenantId,
  templateKey,
  slots,
  allSlots,
  loading,
  error,
  activeSlotKey,
  onPickSlot,
  onClose,
  onSaved,
}: {
  tenantId: string
  templateKey: string
  slots: PreviewSlot[]
  allSlots: PreviewSlot[] | null
  loading: boolean
  error: string | null
  activeSlotKey: string | null
  onPickSlot: (slotKey: string) => void
  onClose: () => void
  onSaved: (slotKey: string) => void
}) {
  const active = slots.find((s) => s.slotKey === activeSlotKey) ?? null
  // Now editable = asset + text; only module slots remain un-editable.
  const nonEditableCount = (allSlots?.length ?? 0) - slots.length

  return (
    <aside className={styles.drawer} aria-label="Redigera innehåll">
      <div className={styles.drawerHead}>
        <span className={styles.drawerTitle}>Innehåll</span>
        <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Stäng">
          ✕
        </button>
      </div>

      {loading ? (
        <p className={styles.drawerNote}>Laddar slots…</p>
      ) : error ? (
        <p className={`${styles.drawerNote} ${styles.drawerErr}`}>{error}</p>
      ) : slots.length === 0 ? (
        <div className={styles.drawerEmpty}>
          <p>
            Den här mallen ({templateKey}) har inga redigerbara slots ännu.
          </p>
          <p className={styles.drawerSub}>
            Slots fylls när mallen importeras (token + sektioner). Då dyker bilder och
            texter upp här och kan ändras direkt på den skarpa sidan.
          </p>
          {nonEditableCount > 0 ? (
            <p className={styles.drawerSub}>
              ({nonEditableCount} modul-slot{nonEditableCount === 1 ? '' : 'ar'} finns men
              redigeras inte än.)
            </p>
          ) : null}
        </div>
      ) : active ? (
        active.kind === 'text' ? (
          <TextSlotEditor
            key={active.slotKey}
            tenantId={tenantId}
            templateKey={templateKey}
            slot={active}
            onBack={() => onPickSlot('')}
            onSaved={onSaved}
          />
        ) : (
          <SlotEditor
            key={active.slotKey}
            tenantId={tenantId}
            templateKey={templateKey}
            slot={active}
            onBack={() => onPickSlot('')}
            onSaved={onSaved}
          />
        )
      ) : (
        <ul className={styles.slotList}>
          {slots.map((s) =>
            s.kind === 'text' ? (
              <li key={s.slotKey}>
                <button
                  type="button"
                  className={styles.slotItem}
                  onClick={() => onPickSlot(s.slotKey)}
                >
                  <span className={styles.slotThumb} aria-hidden="true">
                    T
                  </span>
                  <span className={styles.slotMeta}>
                    <span className={styles.slotLabel}>{s.label}</span>
                    <span className={styles.slotSub}>
                      {s.currentText ? truncateText(s.currentText) : 'tom'}
                      {s.hasOverride ? ' · egen text' : ' · standard'}
                    </span>
                  </span>
                  <span className={styles.slotChevron}>›</span>
                </button>
              </li>
            ) : (
              <li key={s.slotKey}>
                <button
                  type="button"
                  className={styles.slotItem}
                  onClick={() => onPickSlot(s.slotKey)}
                >
                  <span
                    className={styles.slotThumb}
                    style={s.currentUrl ? { backgroundImage: `url(${s.currentUrl})` } : undefined}
                    aria-hidden="true"
                  >
                    {s.currentUrl ? null : '🖼'}
                  </span>
                  <span className={styles.slotMeta}>
                    <span className={styles.slotLabel}>{s.label}</span>
                    <span className={styles.slotSub}>
                      {s.sectionKey}
                      {s.aspectHint ? ` · ${s.aspectHint}` : ''}
                      {s.hasOverride ? ' · egen bild' : ' · standard'}
                    </span>
                  </span>
                  <span className={styles.slotChevron}>›</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </aside>
  )
}

// ── Single image-slot editor: upload new OR pick existing → saveImageSlot ───────────
function SlotEditor({
  tenantId,
  templateKey,
  slot,
  onBack,
  onSaved,
}: {
  tenantId: string
  templateKey: string
  slot: PreviewSlot
  onBack: () => void
  onSaved: (slotKey: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(slot.currentUrl)
  const [assets, setAssets] = useState<PreviewAsset[] | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAssets = useCallback(async () => {
    const res = await listTenantAssets(tenantId)
    if (res.ok) setAssets(res.assets)
    else setAssets([])
  }, [tenantId])

  async function doUpload(file: File) {
    if (file.size > PREVIEW_IMAGE_MAX_BYTES) {
      setMsg({ kind: 'err', text: 'Bilden är för stor (max 2 MB).' })
      return
    }
    setSaving(true)
    setMsg(null)
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('templateKey', templateKey)
    fd.set('slotKey', slot.slotKey)
    fd.set('file', file)
    const res = await saveImageSlot(fd)
    setSaving(false)
    if (res.ok) {
      setPreview(res.url)
      setMsg({ kind: 'ok', text: 'Bilden bytt. Förhandsvisningen uppdateras.' })
      onSaved(slot.slotKey)
    } else {
      setMsg({ kind: 'err', text: res.error })
    }
  }

  async function pickExisting(assetId: string) {
    setSaving(true)
    setMsg(null)
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('templateKey', templateKey)
    fd.set('slotKey', slot.slotKey)
    fd.set('assetId', assetId)
    const res = await saveImageSlot(fd)
    setSaving(false)
    if (res.ok) {
      setPreview(res.url)
      setShowLibrary(false)
      setMsg({ kind: 'ok', text: 'Bilden bytt. Förhandsvisningen uppdateras.' })
      onSaved(slot.slotKey)
    } else {
      setMsg({ kind: 'err', text: res.error })
    }
  }

  return (
    <div className={styles.editor}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        ‹ Alla bild-slots
      </button>

      <div className={styles.editorHead}>
        <div className={styles.editorLabel}>{slot.label}</div>
        <div className={styles.editorSub}>
          {slot.sectionKey}
          {slot.aspectHint ? ` · ${slot.aspectHint}` : ''}
          {slot.assetRole ? ` · ${slot.assetRole}` : ''}
        </div>
      </div>

      <div
        className={styles.editorPreview}
        style={preview ? { backgroundImage: `url(${preview})` } : undefined}
      >
        {preview ? null : <span className={styles.editorPlaceholder}>Ingen bild satt</span>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={PREVIEW_IMAGE_ACCEPT}
        className={styles.fileInput}
        disabled={saving}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void doUpload(f)
          e.target.value = ''
        }}
      />

      <div className={styles.editorActions}>
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
        >
          {saving ? 'Laddar upp…' : 'Ladda upp ny bild'}
        </button>
        <button
          type="button"
          className={styles.tbBtn}
          disabled={saving}
          onClick={() => {
            setShowLibrary((v) => !v)
            if (!assets) void loadAssets()
          }}
        >
          {showLibrary ? 'Dölj bibliotek' : 'Välj från bibliotek'}
        </button>
      </div>

      {msg ? (
        <p className={msg.kind === 'ok' ? styles.editorOk : styles.editorErr} role="status">
          {msg.text}
        </p>
      ) : null}

      {showLibrary ? (
        assets === null ? (
          <p className={styles.drawerNote}>Laddar bibliotek…</p>
        ) : assets.length === 0 ? (
          <p className={styles.drawerNote}>
            Inga uppladdade bilder ännu. Ladda upp en ny bild ovan.
          </p>
        ) : (
          <div className={styles.libraryGrid}>
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                className={styles.libraryItem}
                style={{ backgroundImage: `url(${a.url})` }}
                disabled={saving}
                title={a.alt ?? 'Bild'}
                onClick={() => void pickExisting(a.id)}
                aria-label={`Välj ${a.alt ?? 'bild'}`}
              />
            ))}
          </div>
        )
      ) : null}

      <p className={styles.editorFootnote}>
        Bilden sparas på salongens skarpa sida direkt (cache-bustas). PNG/JPG/WEBP/SVG/GIF, max 2 MB.
      </p>
    </div>
  )
}

// ── Single text-slot editor: edit OR reset to default → saveTextSlot ────────────────
function TextSlotEditor({
  tenantId,
  templateKey,
  slot,
  onBack,
  onSaved,
}: {
  tenantId: string
  templateKey: string
  slot: PreviewSlot
  onBack: () => void
  onSaved: (slotKey: string) => void
}) {
  const [value, setValue] = useState<string>(slot.currentText ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Save the current textarea value. Empty/whitespace → server deletes the override
  // (revert to template default); non-empty → upsert the plain string.
  async function save(next: string, okText: string) {
    setSaving(true)
    setMsg(null)
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('templateKey', templateKey)
    fd.set('slotKey', slot.slotKey)
    fd.set('text', next)
    const res = await saveTextSlot(fd)
    setSaving(false)
    if (res.ok) {
      setMsg({ kind: 'ok', text: okText })
      onSaved(slot.slotKey)
    } else {
      setMsg({ kind: 'err', text: res.error })
    }
  }

  function resetToDefault() {
    setValue('')
    void save('', 'Återställd till mallens standard.')
  }

  return (
    <div className={styles.editor}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        ‹ Tillbaka
      </button>

      <div className={styles.editorHead}>
        <div className={styles.editorLabel}>{slot.label}</div>
        <div className={styles.editorSub}>
          {slot.sectionKey}
          {slot.hasOverride ? ' · egen text' : ' · standard'}
        </div>
      </div>

      <textarea
        className={styles.textarea}
        value={value}
        maxLength={PREVIEW_TEXT_MAX}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Text för ${slot.label}`}
      />

      <div className={styles.editorActions}>
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => void save(value, 'Texten sparad. Förhandsvisningen uppdateras.')}
        >
          {saving ? 'Sparar…' : 'Spara text'}
        </button>
        <button
          type="button"
          className={styles.tbBtn}
          disabled={saving}
          onClick={resetToDefault}
        >
          Återställ till standard
        </button>
      </div>

      {msg ? (
        <p className={msg.kind === 'ok' ? styles.editorOk : styles.editorErr} role="status">
          {msg.text}
        </p>
      ) : null}

      <p className={styles.editorFootnote}>
        Texten sparas på salongens skarpa sida direkt.
      </p>
    </div>
  )
}
