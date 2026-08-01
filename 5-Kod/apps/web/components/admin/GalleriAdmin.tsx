'use client'

import { useActionState, useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import type { ActionState } from '@/lib/admin/actions'
import type { GalleryAdminRow } from '@/lib/admin/galleri/types'
import { GALLERY_RATIOS } from '@/lib/admin/galleri/types'
import {
  createGalleryItem,
  deleteGalleryItem,
  reorderGalleryItems,
  updateGalleryItem,
} from '@/lib/admin/galleri/actions'
import {
  Button,
  Callout,
  Drawer,
  EmptyState,
  Field,
  PageHead,
  inputStyle,
  selectStyle,
  textareaStyle,
  useToast,
} from '@/components/portal/ui'
import { ImagePicker } from './ImagePicker'
import styles from './galleri-admin.module.css'

function AccessibilityFields({
  formId,
  item,
}: {
  formId: string
  item?: GalleryAdminRow
}) {
  const [decorative, setDecorative] = useState(item?.decorative ?? false)
  return (
    <div className={styles.accessibility}>
      <label className={styles.check}>
        <input
          form={formId}
          type="checkbox"
          name="decorative"
          defaultChecked={decorative}
          onChange={(event) => setDecorative(event.currentTarget.checked)}
        />
        <span>
          <strong>Dekorativ bild</strong>
          <small>Markera bara när bilden inte tillför information.</small>
        </span>
      </label>
      <Field label="Bildbeskrivning">
        <input
          form={formId}
          name="alt_override"
          maxLength={500}
          defaultValue={item?.altOverride ?? ''}
          disabled={decorative}
          required={!decorative}
          placeholder="Beskriv det viktiga i just det här gallerisammanhanget"
          style={inputStyle}
        />
      </Field>
    </div>
  )
}

function GalleryDrawer({
  assets,
  item,
  onClose,
}: {
  assets: MediaAssetRow[]
  item?: GalleryAdminRow
  onClose: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const action = item ? updateGalleryItem : createGalleryItem
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})
  const reactId = useId()
  const formId = `gallery-${item?.id ?? reactId.replaceAll(':', '')}`

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
      onClose()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  return (
    <Drawer
      title={item ? 'Redigera galleribild' : 'Lägg till i galleriet'}
      sub="Bilden kommer från ditt Bildbibliotek. Text och tillgänglighet gäller den här användningen."
      ariaLabel={item ? 'Redigera galleribild' : 'Lägg till galleribild'}
      onClose={onClose}
      footer={
        <form id={formId} action={formAction} className={styles.drawerFooter}>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara'}
          </Button>
        </form>
      }
    >
      <div className={styles.drawerGrid}>
        <ImagePicker
          name="asset_id"
          assets={assets}
          defaultAssetId={item?.assetId}
          formId={formId}
          label="Bild"
        />
        <AccessibilityFields formId={formId} item={item} />
        <Field label="Bildtext">
          <textarea
            form={formId}
            name="caption"
            maxLength={240}
            defaultValue={item?.caption ?? ''}
            style={textareaStyle}
          />
        </Field>
        <div className={styles.twoColumns}>
          <Field label="Tagg">
            <input
              form={formId}
              name="tag"
              maxLength={60}
              defaultValue={item?.tag ?? ''}
              style={inputStyle}
            />
          </Field>
          <Field label="År eller datum">
            <input
              form={formId}
              name="year_label"
              maxLength={40}
              defaultValue={item?.yearLabel ?? ''}
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label="Bildformat">
          <select
            form={formId}
            name="aspect_ratio"
            defaultValue={item?.aspectRatio ?? ''}
            style={selectStyle}
          >
            <option value="">Mallens standard</option>
            {GALLERY_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </Field>
        <label className={styles.check}>
          <input
            form={formId}
            type="checkbox"
            name="active"
            defaultChecked={item?.active ?? true}
          />
          <span>
            <strong>Visa i galleriet</strong>
            <small>Avmarkerad bild finns kvar i admin men döljs publikt.</small>
          </span>
        </label>
        {state.error ? (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </Drawer>
  )
}

function DeleteGalleryButton({ item }: { item: GalleryAdminRow }) {
  const router = useRouter()
  const { notify } = useToast()
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteGalleryItem,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  if (!armed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        icon="trash"
        onClick={() => setArmed(true)}
        style={{ minHeight: 44 }}
      >
        Ta bort
      </Button>
    )
  }

  return (
    <form action={formAction} className={styles.confirmDelete}>
      <input type="hidden" name="id" value={item.id} />
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        disabled={pending}
        style={{ minHeight: 44, color: 'var(--c-danger)' }}
      >
        {pending ? 'Tar bort…' : 'Säker? Ta bort'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => setArmed(false)}
        style={{ minHeight: 44 }}
      >
        Ångra
      </Button>
    </form>
  )
}

export function GalleriAdmin({
  items,
  assets,
  tenantName,
  previewHref,
  readOnly = false,
}: {
  items: GalleryAdminRow[]
  assets: MediaAssetRow[]
  tenantName: string
  previewHref: string
  readOnly?: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [drawerItem, setDrawerItem] = useState<GalleryAdminRow | null | 'new'>(null)
  const [moving, startMove] = useTransition()

  function move(index: number, step: -1 | 1) {
    const target = index + step
    if (readOnly || target < 0 || target >= items.length) return
    const ordered = [...items]
    ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
    const fd = new FormData()
    for (const item of ordered) fd.append('ids', item.id)
    startMove(async () => {
      const result = await reorderGalleryItems({}, fd)
      if (result.error) notify(result.error, 'warning')
      else {
        notify(result.success ?? 'Ordningen är sparad.', 'success')
        router.refresh()
      }
    })
  }

  return (
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Galleri"
        lede="Välj bilder, skriv beskrivningar och bestäm ordningen på gallerisidan."
      >
        <Button variant="ghost" href={previewHref} target="_blank" rel="noreferrer">
          Förhandsgranska
        </Button>
        <Button
          variant="primary"
          icon="plus"
          disabled={readOnly || assets.length === 0}
          onClick={() => setDrawerItem('new')}
        >
          Lägg till bild
        </Button>
      </PageHead>

      {readOnly ? (
        <Callout tone="info" icon="info">
          Galleriet är pausat. Innehållet visas som skrivskyddat tills modulen är aktiv igen.
        </Callout>
      ) : null}

      {assets.length === 0 ? (
        <Callout tone="info" icon="upload">
          Bildbiblioteket är tomt. Ladda upp bilder där innan du bygger galleriet.
        </Callout>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="grid"
          title="Galleriet är tomt"
          text="Lägg till en bild från Bildbiblioteket. Samma ordning används i preview och på den publika sidan."
        />
      ) : (
        <ul className={styles.list} aria-label="Galleribilder i visningsordning">
          {items.map((item, index) => (
            <li key={item.id} className={styles.card}>
              <div className={styles.thumb}>
                {item.imageUrl ? (
                  // Adminens miniatyr har sin synliga text bredvid sig.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" />
                ) : (
                  <span>Bild saknas</span>
                )}
              </div>
              <div className={styles.meta}>
                <strong>{item.caption || item.tag || 'Utan bildtext'}</strong>
                <span>{item.decorative ? 'Dekorativ' : item.altOverride}</span>
                <div className={styles.badges}>
                  <span>{item.active ? 'Synlig' : 'Dold'}</span>
                  <span>Position {index + 1}</span>
                </div>
              </div>
              <div className={styles.controls}>
                <div
                  className={styles.moveControls}
                  role="group"
                  aria-label={`Ändra ordning för ${item.caption || 'bild'}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={readOnly || moving || index === 0}
                    onClick={() => move(index, -1)}
                    style={{ minHeight: 44 }}
                  >
                    Flytta upp
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={readOnly || moving || index === items.length - 1}
                    onClick={() => move(index, 1)}
                    style={{ minHeight: 44 }}
                  >
                    Flytta ned
                  </Button>
                </div>
                {!readOnly ? (
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      icon="edit"
                      onClick={() => setDrawerItem(item)}
                      style={{ minHeight: 44 }}
                    >
                      Redigera
                    </Button>
                    <DeleteGalleryButton item={item} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {drawerItem ? (
        <GalleryDrawer
          assets={assets}
          item={drawerItem === 'new' ? undefined : drawerItem}
          onClose={() => setDrawerItem(null)}
        />
      ) : null}
    </div>
  )
}
