import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(__dirname, '..', '..')
const components = path.join(WEB_ROOT, 'components/platform')

describe('Goal 88 legacy site editor retirement', () => {
  it('keeps only the routed V2 assembly while preserving the live booking styles', () => {
    expect(existsSync(path.join(components, 'SidaStudio.tsx'))).toBe(false)
    expect(existsSync(path.join(components, 'SidaStudioLazy.tsx'))).toBe(false)
    expect(existsSync(path.join(components, 'SidaStudio.module.css'))).toBe(true)
    expect(readFileSync(path.join(components, 'BookingSettings.tsx'), 'utf8'))
      .toContain("import studio from './SidaStudio.module.css'")

    const productionSources = ['app', 'components', 'lib'].flatMap((directory) =>
      readdirSync(path.join(WEB_ROOT, directory), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.includes('.test.'))
        .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8')),
    )

    expect(productionSources.some((source) => /(?:from|import\()\s*['"][^'"]*SidaStudio(?:Lazy)?['"]/.test(source)))
      .toBe(false)
  })
})
