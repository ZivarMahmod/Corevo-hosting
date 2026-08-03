import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('superadmin module toggle', () => {
  it('is one auto-saving on/off switch', () => {
    const source = readFileSync(__dirname + '/ModulesCard.tsx', 'utf8')

    expect(source).toContain('className="pswitch"')
    expect(source).toContain('name="binary"')
    expect(source).toContain('name="enabled"')
    expect(source).toContain('formRef.current?.requestSubmit()')
    expect(source).toContain("module.state === 'live'")
    expect(source).not.toContain('<select')
  })
})
