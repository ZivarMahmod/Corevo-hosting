'use client'

import { useActionState, useState } from 'react'
import {
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  type ActionState,
} from '@/lib/platform/actions'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import styles from './platform.module.css'

/**
 * GALLERIET i kundkortet (goal-64). Alla 12 Claude Design-paket har en galleri-sida —
 * den måste alltså gå att FYLLA, annars är sidan en mock och inte en produkt.
 *
 * BILDEN KOMMER UR BILDBIBLIOTEKET (media_assets), aldrig en ny uppladdning här: EN
 * sanning för kundens foton. Är biblioteket tomt säger kortet det rakt ut i stället för
 * att visa ett formulär som inte kan lyckas.
 *
 * Kompakt <details>-mönster som resten av kundkortet (ServicesCard): en rad per bild,
 * öppna för att redigera.
 */

/** En galleri-rad som kundkortet redigerar (platt vy av gallery_items + dess foto). */
export type GalleryAdminRow = {
  id: string
  assetId: string | null
  imageUrl: string | null
  caption: string | null
  tag: string | null
  yearLabel: string | null
  aspectRatio: string | null
  sortOrder: number
  active: boolean
}

/** Ratio-valen mallarna faktiskt ritar (masonry-rytmen i .dc.html-paketen). */
const RATIOS = ['3/2', '4/5', '3/4', '1/1', '16/9'] as const

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <span className={`${styles.feedback} auth-error`} role="alert">
        {state.error}
      </span>
    )
  if (state.success)
    return (
      <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
        {state.success}
      </span>
    )
  return null
}

/** Bildväljare + text-fälten. Delas av lägg-till-formuläret och redigeringen. */
function ItemFields({
  assets,
  item,
  withAsset,
}: {
  assets: MediaAssetRow[]
  item?: GalleryAdminRow
  /** Lägg-till-läget väljer bild; redigeringen byter inte bild (ta bort + lägg till nytt). */
  withAsset: boolean
}) {
  return (
    <>
      {withAsset ? (
        <label className={styles.field}>
          <span>Bild (ur bildbiblioteket)</span>
          <select name="assetId" required defaultValue="">
            <option value="" disabled>
              Välj bild…
            </option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.alt?.trim() || a.r2Key.split('/').pop() || a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={styles.field}>
        <span>Bildtext</span>
        <input
          type="text"
          name="caption"
          maxLength={240}
          defaultValue={item?.caption ?? ''}
          placeholder="samling nr 13 — ranunkel, sju stjälkar"
        />
      </label>
      <label className={styles.field}>
        <span>Tagg</span>
        <input
          type="text"
          name="tag"
          maxLength={60}
          defaultValue={item?.tag ?? ''}
          placeholder="Klipp"
        />
      </label>
      <label className={styles.field}>
        <span>År / datum</span>
        <input
          type="text"
          name="year_label"
          maxLength={40}
          defaultValue={item?.yearLabel ?? ''}
          placeholder="juni 2026"
        />
      </label>
      <label className={styles.field}>
        <span>Bildformat</span>
        <select name="aspect_ratio" defaultValue={item?.aspectRatio ?? ''}>
          <option value="">Mallens standard</option>
          {RATIOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className={styles.hint}>Styr bildens höjd i galleriets rutnät.</span>
      </label>
      <label className={styles.field}>
        <span>Ordning</span>
        <input
          type="number"
          name="sort_order"
          min={0}
          defaultValue={item?.sortOrder ?? 0}
          style={{ maxWidth: 110 }}
        />
      </label>
    </>
  )
}

function GalleryRow({
  tenantId,
  item,
  assets,
}: {
  tenantId: string
  item: GalleryAdminRow
  assets: MediaAssetRow[]
}) {
  const [saveState, saveAction, savePending] = useActionState<ActionState, FormData>(
    updateGalleryItem,
    {},
  )
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(
    deleteGalleryItem,
    {},
  )
  // Tvåstegsbekräftelse (samma mönster som ServicesManager/StaffTeamCard): en radering
  // på ETT klick är hur en operatör raderar fel bild.
  const [armed, setArmed] = useState(false)

  return (
    <details
      style={{
        border: '1px solid var(--c-line, #e2e7de)',
        borderRadius: 9,
        padding: 10,
        opacity: item.active ? 1 : 0.7,
      }}
    >
      <summary style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            style={{
              width: 48,
              height: 48,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid var(--c-line)',
            }}
          />
        ) : (
          <span className={styles.hint} style={{ margin: 0 }}>
            (bild saknas)
          </span>
        )}
        <strong style={{ fontSize: 13.5 }}>{item.caption || item.tag || 'Utan bildtext'}</strong>
        <span className={styles.hint} style={{ margin: 0 }}>
          #{item.sortOrder}
          {item.active ? '' : ' · dold'}
        </span>
      </summary>

      <form action={saveAction} className={styles.form} style={{ gap: 6, marginTop: 10 }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="itemId" value={item.id} />
        <ItemFields assets={assets} item={item} withAsset={false} />
        <label className={styles.field} style={{ flexDirection: 'row', gap: 8 }}>
          <input type="checkbox" name="active" defaultChecked={item.active} />
          <span>Visas i galleriet</span>
        </label>
        <div className={styles.actions}>
          <button type="submit" className="btn-primary" disabled={savePending}>
            {savePending ? 'Sparar…' : 'Spara'}
          </button>
          <Feedback state={saveState} />
        </div>
      </form>

      <form action={delAction} className={styles.actions} style={{ marginTop: 6 }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="itemId" value={item.id} />
        {armed ? (
          <>
            <button type="submit" className={styles.btnDanger} disabled={delPending}>
              {delPending ? '…' : 'Säker? Ta bort ur galleriet'}
            </button>
            <button type="button" className={styles.btn} onClick={() => setArmed(false)}>
              Ångra
            </button>
          </>
        ) : (
          <button type="button" className={styles.btnDanger} onClick={() => setArmed(true)}>
            Ta bort
          </button>
        )}
        <Feedback state={delState} />
      </form>
      <p className={styles.hint}>Fotot finns kvar i bildbiblioteket även om raden tas bort.</p>
    </details>
  )
}

export function GalleriCard({
  tenantId,
  items,
  assets,
}: {
  tenantId: string
  items: GalleryAdminRow[]
  /** Kundens bildbibliotek (media_assets). Tomt → inget att lägga till ännu. */
  assets: MediaAssetRow[]
}) {
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(
    createGalleryItem,
    {},
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {items.length === 0 ? (
        <p className={styles.hint}>
          Galleriet är tomt. Lägg till bilder ur kundens bildbibliotek — de visas på
          /galleri.
        </p>
      ) : (
        items.map((i) => <GalleryRow key={i.id} tenantId={tenantId} item={i} assets={assets} />)
      )}

      {assets.length === 0 ? (
        <p className={styles.hint}>
          Kundens bildbibliotek är tomt. Ladda upp bilder i Bildbiblioteket först — galleriet
          visar kundens EGNA foton, aldrig stock.
        </p>
      ) : (
        <details
          style={{ border: '1px solid var(--c-line, #e2e7de)', borderRadius: 9, padding: 10 }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
            Lägg till bild i galleriet
          </summary>
          <form action={addAction} className={styles.form} style={{ gap: 6, marginTop: 10 }}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <ItemFields assets={assets} withAsset />
            <div className={styles.actions}>
              <button type="submit" className="btn-primary" disabled={addPending}>
                {addPending ? 'Lägger till…' : 'Lägg till'}
              </button>
              <Feedback state={addState} />
            </div>
          </form>
        </details>
      )}
    </div>
  )
}
