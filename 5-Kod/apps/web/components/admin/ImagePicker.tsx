'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import { Button, Icon } from '@/components/portal/ui'

/**
 * Reusable image picker for admin module forms (webshop product image, blogg
 * cover). Used by ShopAdmin + BloggAdmin. The customer picks ONE image from
 * their own bildbibliotek (media_assets); the selection is carried into the
 * surrounding form via a hidden <input name={name}> whose value is the chosen
 * media_assets.id (empty string = no image → the server action persists null).
 *
 * CLIENT-SAFE BY CONSTRUCTION (the next-build fence that bit K10): this 'use
 * client' component imports ONLY react, next/link, the PURE media types
 * (lib/admin/media/types.ts — zero server imports) and the portal/ui client
 * primitives. It NEVER pulls a 'server-only' module (data.ts / supabase/server)
 * into the client graph. The tenant's assets are loaded server-side in the page
 * (listMediaAssets) and passed down as a prop — the picker does no I/O.
 *
 * NO NESTED DRAWER: the portal Drawer locks document.body scroll on mount and
 * restores it on unmount, so mounting a second Drawer inside the open product/
 * post Drawer would fight over the scroll lock. The library grid is therefore an
 * inline, toggle-able panel inside the existing Drawer — never a second Drawer.
 *
 * VOCABULARY: every <Icon> name used here is a real member of the IconName union
 * (plus, grid). Buttons are text-driven to avoid inventing icon names.
 */
export function ImagePicker({
  name,
  assets,
  defaultAssetId = null,
  formId,
  label = 'Bild',
  emptyHref = '/admin/media',
}: {
  /** Form field name the server action reads (e.g. "image_asset_id"). */
  name: string
  /** The tenant's image library (loaded server-side, passed as a prop). */
  assets: MediaAssetRow[]
  /** Currently-bound asset id (product.image_asset_id / post.cover_asset_id). */
  defaultAssetId?: string | null
  /** id of the <form> this picker's hidden input belongs to (drawer forms use
   *  the form="" attribute association, so the hidden input must carry it too). */
  formId?: string
  /** Field label shown above the control. */
  label?: string
  /** Where "Ladda upp i Bildbibliotek" links when the library is empty. */
  emptyHref?: string
}) {
  // Only honour a default that still exists in the tenant's library.
  const [selectedId, setSelectedId] = useState<string | null>(
    defaultAssetId && assets.some((a) => a.id === defaultAssetId) ? defaultAssetId : null,
  )
  const [open, setOpen] = useState(false)

  const selected = selectedId ? assets.find((a) => a.id === selectedId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="eyebrow">{label}</span>

      {/* The value the surrounding form submits. '' → server persists null. */}
      <input type="hidden" name={name} value={selectedId ?? ''} form={formId} />

      {assets.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: 0 }}>
          Du har inga bilder än.{' '}
          <Link
            href={emptyHref}
            style={{ color: 'var(--c-forest)', textDecoration: 'underline' }}
          >
            Ladda upp i Bildbibliotek
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Current selection + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                border: '1px solid var(--c-line)',
                background: 'var(--c-cream)',
                overflow: 'hidden',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              {selected ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.url}
                  alt={selected.alt ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Icon name="plus" size={18} />
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" type="button" onClick={() => setOpen((v) => !v)}>
                {selected ? 'Byt bild' : 'Välj bild'}
              </Button>
              {selected && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setSelectedId(null)
                    setOpen(false)
                  }}
                >
                  Ta bort
                </Button>
              )}
            </div>
          </div>

          {/* Inline library grid (toggled — no nested Drawer) */}
          {open && (
            <div
              role="listbox"
              aria-label="Välj bild ur bildbiblioteket"
              style={{
                marginTop: 4,
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid var(--c-line)',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                gap: 8,
              }}
            >
              {assets.map((a) => {
                const isSel = a.id === selectedId
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    aria-label={a.alt?.trim() ? a.alt : 'Bild'}
                    title={a.alt?.trim() ? a.alt : undefined}
                    onClick={() => {
                      setSelectedId(a.id)
                      setOpen(false)
                    }}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: isSel ? '2px solid var(--c-forest)' : '1px solid var(--c-line)',
                      background: 'var(--c-cream)',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.alt ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
