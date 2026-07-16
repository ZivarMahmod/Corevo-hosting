import { describe, expect, it } from 'vitest'
import { distributePreviewLines } from './SidaPreviewBridge'

describe('SidaPreviewBridge segmented copy', () => {
  it('keeps the accent tail on the last line when a multiline hero is shortened', () => {
    expect(distributePreviewLines('A\nBBBB', 3)).toEqual([
      { text: 'A', visible: true },
      { text: '', visible: false },
      { text: 'BBBB', visible: true },
    ])
  })
})
