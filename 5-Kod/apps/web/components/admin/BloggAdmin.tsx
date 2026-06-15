'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { BlogPostRow } from '@/lib/admin/blogg/types'
import { BLOG_STATUSES, BLOG_STATUS_LABELS } from '@/lib/admin/blogg/types'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import { ImagePicker } from './ImagePicker'
import {
  createBlogPost,
  updateBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
} from '@/lib/admin/blogg/actions'
import type { ActionState } from '@/lib/admin/actions'
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  Icon,
  PageHead,
  Table,
  useToast,
} from '@/components/portal/ui'

// ── Shared input styles (mirrors ServicesManager) ────────────────────────────
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 80,
}

const bodyStyle: CSSProperties = {
  ...textareaStyle,
  minHeight: 180,
}

// ── Field wrapper (mirrors ServicesManager) ───────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

// ── Status badge tone mapping ─────────────────────────────────────────────────
function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'neutral'
  return 'warning'
}

// ── Formatted publish date ────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ── Quick-publish/unpublish toggle button ─────────────────────────────────────
function StatusToggle({ post }: { post: BlogPostRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBlogPostStatus, {})

  const isPublished = post.status === 'published'
  const nextStatus = isPublished ? 'draft' : 'published'
  const label = isPublished ? 'Avpublicera' : 'Publicera'

  useEffect(() => {
    if (state.success) {
      notify(
        isPublished ? `"${post.title}" satt till utkast` : `"${post.title}" publicerad`,
        'success',
      )
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <form action={formAction} style={{ display: 'inline-flex' }}>
      <input type="hidden" name="id" value={post.id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${label}: ${post.title}`}
        style={{
          border: '1px solid var(--c-line)',
          background: 'var(--c-paper)',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: pending ? 'default' : 'pointer',
          color: isPublished ? 'var(--c-ink-2)' : 'var(--c-forest)',
          opacity: pending ? 0.5 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {pending ? '…' : label}
      </button>
    </form>
  )
}

// ── Main exported component ───────────────────────────────────────────────────
export function BloggAdmin({
  posts,
  tenantName,
  layoutVariant,
  assets,
}: {
  posts: BlogPostRow[]
  tenantName: string
  layoutVariant: string | null
  assets: MediaAssetRow[]
}) {
  const [editing, setEditing] = useState<BlogPostRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Blogg"
        lede="Skapa och hantera blogginlägg för din salong. Ändringar slår igenom utan kod eller deploy."
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Nytt inlägg
        </Button>
      </PageHead>

      {layoutVariant && (
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--c-ink-3)',
            margin: '0 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="info" size={13} style={{ color: 'var(--c-gold-600)' }} />
          Layout: <strong style={{ color: 'var(--c-ink-2)' }}>{layoutVariant}</strong>
        </p>
      )}

      <Callout tone="gold" icon="link">
        Publicerade inlägg syns på sajongens blogg-sida. Utkast är bara synliga här — gäster ser
        dem inte. Ändringar slår igenom utan kod eller deploy.
      </Callout>

      <Card pad={0} style={{ marginTop: 16 }}>
        {posts.length === 0 ? (
          <div style={{ padding: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Inga inlägg ännu
            </p>
            <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
              Skapa ditt första blogginlägg med <strong>Nytt inlägg</strong> — rubrik, ingress och
              brödtext. Publicera direkt eller spara som utkast.
            </p>
          </div>
        ) : (
          <Table
            cols={['Rubrik', 'Status', 'Publicerad', 'Ordning', '', '']}
            rows={posts.map((p) => [
              <PostTitleCell
                key="title"
                post={p}
                imageUrl={assets.find((a) => a.id === p.cover_asset_id)?.url ?? null}
              />,
              <Badge key="status" tone={statusTone(p.status)}>
                {BLOG_STATUS_LABELS[p.status as keyof typeof BLOG_STATUS_LABELS] ?? p.status}
              </Badge>,
              <span key="date" className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
                {fmtDate(p.published_at)}
              </span>,
              <span key="sort" className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
                {p.sort_order}
              </span>,
              <StatusToggle key="toggle" post={p} />,
              <button
                key="edit"
                type="button"
                onClick={() => setEditing(p)}
                aria-label={`Redigera ${p.title}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--c-ink-3)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'inline-grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="edit" size={17} />
              </button>,
            ])}
          />
        )}
      </Card>

      {creating && <CreateDrawer assets={assets} onClose={() => setCreating(false)} />}
      {editing && (
        <EditDrawer key={editing.id} post={editing} assets={assets} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

// ── Post title cell ───────────────────────────────────────────────────────────
function PostTitleCell({ post, imageUrl }: { post: BlogPostRow; imageUrl?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{
            width: 36,
            height: 36,
            objectFit: 'cover',
            border: '1px solid var(--c-line)',
            borderRadius: 8,
            flex: 'none',
          }}
        />
      )}
      <div>
        <b style={{ fontWeight: 600 }}>{post.title}</b>
        {post.slug && (
          <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>
            /{post.slug}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Create drawer ─────────────────────────────────────────────────────────────
function CreateDrawer({ assets, onClose }: { assets: MediaAssetRow[]; onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createBlogPost, {})

  useEffect(() => {
    if (state.success) {
      notify('Inlägg skapat', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title="Nytt inlägg"
      sub="Rubrik krävs — slug, ingress och brödtext är valfria."
      onClose={onClose}
      ariaLabel="Nytt blogginlägg"
      footer={
        <form
          action={formAction}
          id="create-blog-post"
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Skapa inlägg'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Rubrik">
          <input form="create-blog-post" name="title" required style={inputStyle} />
        </Field>
        <Field label="Slug">
          <input
            form="create-blog-post"
            name="slug"
            placeholder="auto från rubrik"
            style={inputStyle}
          />
        </Field>
        <Field label="Ingress">
          <textarea form="create-blog-post" name="excerpt" style={textareaStyle} />
        </Field>
        <Field label="Brödtext">
          <textarea form="create-blog-post" name="body" style={bodyStyle} />
        </Field>
        <Field label="Status">
          <select form="create-blog-post" name="status" defaultValue="draft" style={inputStyle}>
            {BLOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BLOG_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ordning">
          <input
            form="create-blog-post"
            name="sort_order"
            type="number"
            defaultValue={0}
            className="num"
            style={inputStyle}
          />
        </Field>
        <ImagePicker name="cover_asset_id" assets={assets} formId="create-blog-post" label="Omslagsbild" />
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

// ── Edit drawer ───────────────────────────────────────────────────────────────
function EditDrawer({
  post,
  assets,
  onClose,
}: {
  post: BlogPostRow
  assets: MediaAssetRow[]
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(updateBlogPost, {})
  const [del, delAction, deleting] = useActionState<ActionState, FormData>(deleteBlogPost, {})

  useEffect(() => {
    if (save.success) {
      notify('Inlägg uppdaterat', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.success])

  useEffect(() => {
    if (del.success) {
      notify('Inlägg borttaget', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [del.success])

  const formId = `edit-blog-post-${post.id}`

  return (
    <Drawer
      title={post.title}
      sub={post.slug ? `/${post.slug}` : 'Inget slug ännu'}
      accent={
        <Badge tone={statusTone(post.status)}>
          {BLOG_STATUS_LABELS[post.status as keyof typeof BLOG_STATUS_LABELS] ?? post.status}
        </Badge>
      }
      onClose={onClose}
      ariaLabel={`Redigera ${post.title}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
          <form action={delAction}>
            <input type="hidden" name="id" value={post.id} />
            <Button variant="ghost" type="submit" icon="trash" disabled={deleting}>
              {deleting ? '…' : 'Ta bort'}
            </Button>
          </form>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="pbtn pbtn--primary pbtn--md"
          >
            <Icon name="check" size={17} />
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      }
    >
      <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
        <input type="hidden" name="id" value={post.id} />
        <Field label="Rubrik">
          <input name="title" defaultValue={post.title} required style={inputStyle} />
        </Field>
        <Field label="Slug">
          <input
            name="slug"
            defaultValue={post.slug ?? ''}
            placeholder="auto från rubrik"
            style={inputStyle}
          />
        </Field>
        <Field label="Ingress">
          <textarea name="excerpt" defaultValue={post.excerpt ?? ''} style={textareaStyle} />
        </Field>
        <Field label="Brödtext">
          <textarea name="body" defaultValue={post.body ?? ''} style={bodyStyle} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={post.status} style={inputStyle}>
            {BLOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BLOG_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ordning">
          <input
            name="sort_order"
            type="number"
            defaultValue={post.sort_order}
            className="num"
            style={inputStyle}
          />
        </Field>
        <ImagePicker
          name="cover_asset_id"
          assets={assets}
          formId={formId}
          defaultAssetId={post.cover_asset_id}
          label="Omslagsbild"
        />
      </form>

      {(save.error || del.error) && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {save.error || del.error}
        </p>
      )}
    </Drawer>
  )
}
