import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BOOKING_WIZARD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'BookingWizard.tsx',
)

describe('industry-neutral booking copy', () => {
  it('does not call a primary location a salon', () => {
    const source = readFileSync(BOOKING_WIZARD, 'utf8')

    expect(source).not.toContain('Huvudsalong')
    expect(source).toContain('Huvudplats')
  })
})
