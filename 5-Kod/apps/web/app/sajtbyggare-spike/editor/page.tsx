// S0 F2a — flag-gated GrapesJS editor surface.
// Production placement is the salon-admin door (booking.corevo.se /admin/sajtbyggare);
// for the spike it sits here flag-gated only (off in prod → never public) so the
// round-trip can be exercised live on the staging Workers surface without auth.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { GrapesEditor } from '@/components/sajtbyggare/GrapesEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare S0 — GrapesJS editor' }

export default function SajtbyggareEditorPage() {
  if (!sajtbyggareEnabled()) notFound()
  return (
    <main data-world="sajtbyggare-editor" style={{ padding: 16 }}>
      <h1>Sajtbyggare — GrapesJS-editor (S0-spike)</h1>
      <p style={{ maxWidth: 720 }}>
        Importerad <strong>restoran</strong>-mall i GrapesJS. Redigera text/bild → klicka
        Exportera → <code>&lt;corevo-module&gt;</code>-markören bevaras (round-trip), så
        F1-bron kan väva in den riktiga modulen vid render. Produktionsplacering:
        admin-dörren (booking.corevo.se). Här en flagg-gatad spike-yta.
      </p>
      <GrapesEditor />
    </main>
  )
}
