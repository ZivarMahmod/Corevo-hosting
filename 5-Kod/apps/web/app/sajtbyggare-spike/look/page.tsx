// goal-36 — look INDEX: a flag-gated, login-less grid of EVERY registered look so the
// whole box can be browsed on localhost in one place. Each card links to the look's
// own preview route (/sajtbyggare-spike/look/<key>), optionally with ?modules=… to see
// modules woven in. Display/dev convenience — robots noindex, notFound() in prod.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { lookMetaList } from '@/lib/sajtbyggare/look-registry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare — alla mallar', robots: { index: false } }

export default function LookIndexPage() {
  if (!sajtbyggareEnabled()) notFound()
  const looks = lookMetaList()
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: '40px 24px', color: '#1e293b' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Sajtbyggare — alla mallar i boxen</h1>
      <p style={{ color: '#64748b', margin: '0 0 28px', fontSize: 14 }}>
        {looks.length} looks. Klicka en för att se den på riktigt (render-bron). Lägg till <code>?modules=shop,offert,lojalitet,presentkort,blogg&amp;branch=frisor</code> i URL:en för att se moduler invävda i lookens egna färger/typsnitt.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
        {looks.map((l) => (
          <Link
            key={l.key}
            href={`/sajtbyggare-spike/look/${encodeURIComponent(l.key)}`}
            style={{ display: 'block', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: '#fff' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.thumbnail} alt={l.name} style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover', background: '#f1f5f9' }} />
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{l.name}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>{l.vibeTags.join(' · ')}</div>
              <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 6 }}>{l.key}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
