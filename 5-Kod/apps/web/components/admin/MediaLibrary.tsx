'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { MediaAssetRow, StorageUsage } from '@/lib/admin/media/types'
import { MEDIA_ACCEPT, formatBytes, usagePercent } from '@/lib/admin/media/types'
import { uploadMediaAssets, deleteMediaAsset, updateMediaAlt } from '@/lib/admin/media/actions'
import type { ActionState } from '@/lib/admin/actions'
import {
  Button,
  Card,
  Callout,
  Drawer,
  Icon,
  PageHead,
  useToast,
} from '@/components/portal/ui'

// ── Shared input style (mirrors PresentkortAdmin) ───────────────────────────
const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  width: '100%',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

// useActionState wants a (prevState, formData) reducer, but the server actions are
// single-arg administrative writes (take only FormData). Thin adapters bridge the
// two without changing the action exports (mirrors PresentkortAdmin).
const uploadAction = (_prev: ActionState, fd: FormData) => uploadMediaAssets(fd)
const deleteAction = (_prev: ActionState, fd: FormData) => deleteMediaAsset(fd)
const altAction = (_prev: ActionState, fd: FormData) => updateMediaAlt(fd)

// ── Root component ──────────────────────────────────────────────────────────
export function MediaLibrary({
  assets,
  usage,
  tenantName,
}: {
  assets: MediaAssetRow[]
  usage: StorageUsage
  tenantName: string
}) {
  const [uploading, setUploading] = useState(false)

  const pct = usagePercent(usage)

  return (
    <div>
      <PageHead eyebrow={tenantName} title="Bildbibliotek">
        <Button variant="primary" icon="upload" onClick={() => setUploading(true)}>
          Ladda upp
        </Button>
      </PageHead>

      <Callout tone="info" icon="info">
        Ditt bildbibliotek. Ladda upp egna bilder och återanvänd dem på din sida. Max 8 MB
        per bild.
      </Callout>

      {/* ── Lagringsmätare (read-only) ── */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span className="eyebrow">Lagring</span>
          <span className="num" style={{ fontSize: 13, color: 'var(--c-ink-2)' }}>
            {formatBytes(usage.usedBytes)} av {formatBytes(usage.quotaBytes)} använt
          </span>
        </div>
        <div
          aria-hidden="true"
          style={{
            height: 6,
            borderRadius: 999,
            background: 'var(--c-line)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 999,
              background: 'var(--c-ink)',
              transition: 'width .2s ease',
            }}
          />
        </div>
      </div>

      {/* ── Bilder ── */}
      <div style={{ marginTop: 24 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Dina bilder
        </h2>

        {assets.length === 0 ? (
          <Card>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Inga bilder än
            </p>
            <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
              Ladda upp din första bild med <strong>Ladda upp</strong> — den dyker upp här och
              kan återanvändas på din sida.
            </p>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            {assets.map((a) => (
              <AssetCard key={a.id} asset={a} />
            ))}
          </div>
        )}
      </div>

      {uploading && <UploadDrawer onClose={() => setUploading(false)} />}
    </div>
  )
}

// ── Asset card ──────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: MediaAssetRow }) {
  const [editingAlt, setEditingAlt] = useState(false)

  return (
    <div
      style={{
        border: '1px solid var(--c-line)',
        borderRadius: 12,
        background: 'var(--c-paper)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--c-cream)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.alt ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--c-ink-3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={asset.alt ?? undefined}
        >
          {asset.alt?.trim() ? asset.alt : 'Ingen alt-text'}
        </span>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Storlek bara när den är KÄND — legacy/importerade rader saknar
              size_bytes och renderade "0 B" (death metric). */}
          <span className="num" style={{ fontSize: 11.5, color: 'var(--c-ink-3)' }}>
            {asset.sizeBytes > 0 ? formatBytes(asset.sizeBytes) : ''}
          </span>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <IconButton
              label="Redigera alt-text"
              icon="edit"
              onClick={() => setEditingAlt(true)}
            />
            <DeleteButton asset={asset} />
          </span>
        </div>
      </div>

      {editingAlt && <AltDrawer asset={asset} onClose={() => setEditingAlt(false)} />}
    </div>
  )
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: 'edit'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--c-line)',
        background: 'transparent',
        color: 'var(--c-ink-2)',
        cursor: 'pointer',
        borderRadius: 7,
        padding: 5,
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

function DeleteButton({ asset }: { asset: MediaAssetRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteAction, {})
  // Tvåstegsbekräftelse i stället för window.confirm (samma mönster som tjänsternas
  // EditDrawer): klick 1 armerar — papperskorgen blir en "Säker? Ta bort"-knapp i
  // varningston + Avbryt — klick 2 raderar.
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (state.success) {
      notify('Bild borttagen.', 'success')
      router.refresh()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  const baseBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--c-line)',
    background: 'transparent',
    color: 'var(--c-ink-2)',
    cursor: 'pointer',
    borderRadius: 7,
    padding: 5,
  }

  if (!armed) {
    return (
      <button
        type="button"
        aria-label="Ta bort bild"
        title="Ta bort bild"
        onClick={() => setArmed(true)}
        style={baseBtn}
      >
        <Icon name="trash" size={14} />
      </button>
    )
  }

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="id" value={asset.id} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Säker? Ta bort bilden permanent"
        style={{
          ...baseBtn,
          borderColor: 'var(--c-danger)',
          color: 'var(--c-danger)',
          fontSize: 11,
          fontWeight: 600,
          padding: '4px 7px',
          whiteSpace: 'nowrap',
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? '…' : 'Säker? Ta bort'}
      </button>
      <button
        type="button"
        aria-label="Avbryt borttagning"
        title="Avbryt"
        onClick={() => setArmed(false)}
        style={baseBtn}
      >
        <Icon name="x" size={14} />
      </button>
    </form>
  )
}

// ── Alt-text drawer ─────────────────────────────────────────────────────────

function AltDrawer({ asset, onClose }: { asset: MediaAssetRow; onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(altAction, {})

  useEffect(() => {
    if (state.success) {
      notify('Alt-text sparad.', 'success')
      router.refresh()
      onClose()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  const formId = 'edit-media-alt'

  return (
    <Drawer
      title="Alt-text"
      sub="Beskriv bilden för skärmläsare och bättre tillgänglighet."
      onClose={onClose}
      ariaLabel="Redigera alt-text"
      footer={
        <form
          action={formAction}
          id={formId}
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Alt-text">
          <input
            form={formId}
            name="alt"
            defaultValue={asset.alt ?? ''}
            placeholder="t.ex. Frisör klipper en kund"
            style={inputStyle}
          />
        </Field>
        <input form={formId} type="hidden" name="id" value={asset.id} />
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

// ── Upload drawer ───────────────────────────────────────────────────────────

function UploadDrawer({ onClose }: { onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadAction, {})
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
      onClose()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  // Revoke any local object-URLs when the drawer unmounts (leak-free previews).
  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [previews])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    previews.forEach((u) => URL.revokeObjectURL(u))
    const files = Array.from(e.target.files ?? [])
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const formId = 'upload-media'

  return (
    <Drawer
      title="Ladda upp bilder"
      sub="PNG, JPG, WEBP, SVG eller GIF. Max 8 MB per bild."
      onClose={onClose}
      ariaLabel="Ladda upp bilder"
      footer={
        <form
          action={formAction}
          id={formId}
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="upload" disabled={pending}>
            {pending ? 'Laddar upp…' : 'Ladda upp'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Bilder">
          <input
            form={formId}
            name="files"
            type="file"
            multiple
            accept={MEDIA_ACCEPT}
            onChange={onPick}
            style={inputStyle}
          />
        </Field>

        {previews.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 8,
            }}
          >
            {previews.map((src) => (
              <div
                key={src}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--c-line)',
                  background: 'var(--c-cream)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            ))}
          </div>
        )}

        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}
