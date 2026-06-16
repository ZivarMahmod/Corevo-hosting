'use client'

// S0 F2a — GrapesJS embedded editor (thin). Imports the restoran template, lets you
// edit, and on Export verifies the <corevo-module type="booking"> marker survived the
// round-trip (the property F1's render-bridge depends on). storageManager:false → no
// autoload of any cached project (a fresh import every mount). grapesjs is loaded via
// dynamic import inside useEffect so it never runs during SSR (it touches window).
import { useEffect, useRef, useState } from 'react'
import type { Editor } from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import { RESTORAN_PAGE_HTML } from '@/lib/sajtbyggare/templates/restoran'

export function GrapesEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [exportedHtml, setExportedHtml] = useState('')
  const [markerSurvived, setMarkerSurvived] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    let editor: Editor | undefined
    void (async () => {
      const grapesjs = (await import('grapesjs')).default
      if (cancelled || !containerRef.current) return
      editor = grapesjs.init({
        container: containerRef.current,
        height: '70vh',
        fromElement: false,
        storageManager: false,
      })
      editor.setComponents(RESTORAN_PAGE_HTML)
      editorRef.current = editor
    })()
    return () => {
      cancelled = true
      editor?.destroy()
    }
  }, [])

  function handleExport() {
    const html = editorRef.current?.getHtml() ?? ''
    setExportedHtml(html)
    setMarkerSurvived(/<corevo-module[^>]*type=["']?booking["']?/i.test(html))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
        <button type="button" onClick={handleExport}>
          Exportera HTML (round-trip)
        </button>
        {markerSurvived !== null && (
          <span data-roundtrip={markerSurvived ? 'ok' : 'lost'}>
            booking-markör bevarad: <strong>{markerSurvived ? 'JA' : 'NEJ'}</strong>
          </span>
        )}
      </div>
      <div ref={containerRef} />
      {exportedHtml && (
        <pre
          data-export-html
          style={{ maxHeight: 220, overflow: 'auto', fontSize: 11, background: '#f6f6f6', padding: 8 }}
        >
          {exportedHtml}
        </pre>
      )}
    </div>
  )
}
