'use client'

import { Button, useToast } from '@/components/portal/ui'

/** One exportable customer row — identity-level ONLY (the same masked label the
 *  list shows). NEVER carries the hidden full_name or raw PII. */
export type ExportRow = {
  shownName: string
  tier: string
  visits: number
  lastVisit: string
  favStaff: string
  loyaltyPoints: number
}

/** Quote a CSV cell (RFC 4180): wrap in quotes, double any inner quote. */
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Exportera — real client-side CSV download of the CURRENTLY VISIBLE customer
 * rows (after search). Identity-level columns only: the SHOWN name (privacy-safe,
 * never the hidden full name) + the derived figures already on screen. No raw PII
 * (phone/email) leaves the time-bound RPC, so it is deliberately absent here.
 * Fires the §6 consequence toast on download.
 */
export function CustomerExport({ rows }: { rows: ExportRow[] }) {
  const { notify } = useToast()

  function download() {
    if (rows.length === 0) {
      notify('Inga kunder att exportera.', 'info')
      return
    }
    const header = ['Kund', 'Nivå', 'Besök', 'Senaste besök', 'Frisör', 'Lojalitetspoäng']
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [r.shownName, r.tier, r.visits, r.lastVisit, r.favStaff, r.loyaltyPoints]
          .map(csvCell)
          .join(','),
      ),
    ]
    // BOM so Excel reads åäö correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `kunder-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    notify(`${rows.length} kunder exporterade till CSV.`, 'success')
  }

  return (
    <Button variant="ghost" icon="upload" onClick={download}>
      Exportera
    </Button>
  )
}
