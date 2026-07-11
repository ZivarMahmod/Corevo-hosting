// Offert-status-FSM (goal-54 körning 3, A4): övergångsmatrisen är enda sanningen —
// action + UI filtrerar båda genom offertTransitionAllowed.

import { describe, expect, it } from 'vitest'
import { OFFERT_STATUSES, OFFERT_ALLOWED_FROM, offertTransitionAllowed } from './types'

describe('offertTransitionAllowed', () => {
  it('same status is always a no-op (allowed)', () => {
    for (const s of OFFERT_STATUSES) expect(offertTransitionAllowed(s, s)).toBe(true)
  })

  it('follows the matrix exactly', () => {
    for (const from of OFFERT_STATUSES) {
      for (const to of OFFERT_STATUSES) {
        if (from === to) continue
        expect(offertTransitionAllowed(from, to)).toBe(OFFERT_ALLOWED_FROM[from].includes(to))
      }
    }
  })

  it('terminal: closed allows nothing new', () => {
    expect(offertTransitionAllowed('closed', 'new')).toBe(false)
    expect(offertTransitionAllowed('closed', 'quoted')).toBe(false)
  })

  it('happy path new → reviewing → quoted → accepted → closed', () => {
    expect(offertTransitionAllowed('new', 'reviewing')).toBe(true)
    expect(offertTransitionAllowed('reviewing', 'quoted')).toBe(true)
    expect(offertTransitionAllowed('quoted', 'accepted')).toBe(true)
    expect(offertTransitionAllowed('accepted', 'closed')).toBe(true)
  })

  it('no backwards moves', () => {
    expect(offertTransitionAllowed('quoted', 'new')).toBe(false)
    expect(offertTransitionAllowed('accepted', 'reviewing')).toBe(false)
  })

  it('unknown/legacy current status may only be closed', () => {
    expect(offertTransitionAllowed('legacy-weird', 'closed')).toBe(true)
    expect(offertTransitionAllowed('legacy-weird', 'quoted')).toBe(false)
  })
})
