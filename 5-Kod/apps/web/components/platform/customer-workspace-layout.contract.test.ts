import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (name: string) => fs.readFileSync(path.resolve(__dirname, name), 'utf8')

describe('goal-80 superadmin customer workspace design contract', () => {
  it('protects the full-width detail pane and wrapping customer tabs', () => {
    const board = read('kunder-v2.module.css')
    const detail = read('tenant-detail.module.css')

    expect(board).toMatch(/\.pane\s*\{[^}]*min-width:\s*0;/s)
    expect(board).toMatch(/\.paneInner\s*\{[^}]*max-width:\s*1320px;/s)
    expect(detail).toMatch(
      /\.subtabs\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*6px;/s,
    )
    expect(detail).toMatch(
      /\.twoCol\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(0,\s*1fr\);/s,
    )
    expect(detail).toMatch(/\.col\s*\{[^}]*min-width:\s*0;/s)
  })

  it('matches the canonical Sida split, sticky offset and preview height', () => {
    const studio = read('SidaStudio.module.css')
    const component = read('SidaStudio.tsx')

    expect(studio).toMatch(
      /grid-template-columns:\s*minmax\(400px,\s*1fr\)\s+minmax\(480px,\s*1\.15fr\);/,
    )
    expect(studio).toMatch(/\.grid\s*\{[^}]*gap:\s*16px;[^}]*align-items:\s*start;/s)
    expect(studio).toMatch(/\.right\s*\{[^}]*position:\s*sticky;[^}]*top:\s*78px;/s)
    expect(studio).toMatch(
      /\.stage\s*\{[^}]*overflow:\s*auto;[^}]*height:\s*calc\(100vh - 220px\);[^}]*min-height:\s*420px;/s,
    )
    expect(studio).toMatch(/@media\s*\(max-width:\s*991px\)[\s\S]*?\.grid\s*\{[^}]*grid-template-columns:\s*1fr;/)
    expect(component).toContain("const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')")
    expect(component).toContain("const previewWidth = previewDevice === 'desktop' ? 1360 : 390")
    expect(component).toContain("aria-pressed={previewDevice === 'desktop'}")
    expect(component).toContain("aria-pressed={previewDevice === 'mobile'}")
    expect(component).toContain('className={styles.deviceSwitch} role="group" aria-label="Preview-enhet"')
    expect(studio).toMatch(/\.previewViewport\s*\{[^}]*position:\s*absolute;[^}]*transform-origin:\s*top left;/s)
  })
})
