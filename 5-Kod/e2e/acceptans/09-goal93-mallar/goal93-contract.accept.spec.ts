import { expect, test } from '@playwright/test'
import path from 'node:path'

import {
  AXE_GATE,
  assertBaselineInventory,
  assertSafeBrowserTarget,
  expectedDesignBaselines,
  loadGoal93Matrix,
  wrapperInventory,
} from './runner'

const goalDir = path.resolve(__dirname)

test.describe('Goal 93 mallacceptans — contract @goal93-contract', () => {
  test('93-C01 matrix count and central FSM coverage are exact', () => {
    const payload = loadGoal93Matrix()
    expect(payload.themeCount).toBe(12)
    expect(payload.routeCount).toBe(174)
    expect(payload.matrixCount).toBe(362)
    expect(payload.matrix).toHaveLength(362)
    expect(payload.matrix.filter((row) => row.state === 'full')).toHaveLength(348)
    expect(payload.matrix.filter((row) => row.state !== 'full')).toHaveLength(14)
    expect(new Set(payload.matrix.map((row) => row.id)).size).toBe(payload.matrix.length)
    expect(payload.legacyCount).toBe(8)
    expect(payload.legacyKeys).toEqual([
      'edit',
      'flora',
      'freshcut',
      'leander',
      'linnea',
      'salvia',
      'zentum',
      'zigge',
    ])
  })

  test('93-C02 every catalog key owns one tiny spec/probe pair', () => {
    const payload = loadGoal93Matrix()
    const inventory = wrapperInventory(goalDir, payload.keys)
    expect(inventory.missing).toEqual([])
    expect(inventory.extra).toEqual([])
    expect(inventory.pairs).toHaveLength(12)
  })

  test('93-C03 missing design-source baselines fail closed', () => {
    const baselines = expectedDesignBaselines(loadGoal93Matrix().matrix)
    expect(baselines).toHaveLength(348)
    expect(() => assertBaselineInventory(baselines, [])).toThrow(/baseline-missing/)
  })

  test('93-C04 production target is rejected', () => {
    expect(() =>
      assertSafeBrowserTarget({
        projectRef: 'clylvowtowbtotrahuad',
        url: 'https://clylvowtowbtotrahuad.supabase.co',
      }),
    ).toThrow(/production-ref/)
    expect(
      assertSafeBrowserTarget({
        projectRef: 'cwnhpesrgolflkmyjbrm',
        url: 'http://127.0.0.1:41793',
      }).projectRef,
    ).toBe('cwnhpesrgolflkmyjbrm')
  })

  test('93-C05 every row is executable and Axe is available', () => {
    const payload = loadGoal93Matrix()
    expect(payload.matrix.every((row) => row.id && row.viewport.width > 0)).toBe(true)
    expect(AXE_GATE).toBe('AVAILABLE')
  })
})
