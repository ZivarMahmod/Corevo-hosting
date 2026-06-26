// goal-50 / LÅST + LIVE-BEVIS #3 — "3 olika mall-val = 3 SYNLIGT olika previews
// (computed-style/screenshot-diff, aldrig bara olika namn)". The old bug: every look
// fell back to ONE React layout → identical preview, only the name changed. This guard
// proves the BOX renders DISTINCT looks via real HTML, at the render + palette level.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from './render-bridge'
import { LOOKS } from './look-registry'

const renderLook = (key: string) => {
  const look = LOOKS.find((l) => l.key === key)!
  return renderToStaticMarkup(
    createElement(Fragment, null, renderTemplate(look.html, { booking: createElement('div') })),
  )
}

const firstText = (key: string) =>
  LOOKS.find((l) => l.key === key)!.manifest.regions.find((r) => r.type === 'text' && r.default)!.default!

const primary = (key: string) =>
  LOOKS.find((l) => l.key === key)!.manifest.regions.find((r) => r.key === 'color.primary')?.default ?? null

describe('the box renders DISTINCT looks (not one theme behind different names)', () => {
  const keys = LOOKS.map((l) => l.key)

  it('every look renders a substantial, non-empty page', () => {
    for (const k of keys) expect(renderLook(k).length, k).toBeGreaterThan(1000)
  })

  it('no two looks render the same HTML (pairwise-distinct output)', () => {
    const outs = keys.map(renderLook)
    for (let i = 0; i < outs.length; i++) {
      for (let j = i + 1; j < outs.length; j++) {
        expect(outs[i] === outs[j], `${keys[i]} vs ${keys[j]} identical`).toBe(false)
      }
    }
  })

  it('each look declares DISTINCT hero copy (different content, not just different names)', () => {
    const texts = keys.map(firstText)
    expect(new Set(texts).size, 'two looks share hero copy').toBe(texts.length)
  })

  it("each look actually renders its own copy (a plain word from its hero appears)", () => {
    // a single 5+ letter word stays inside one text node → escape/tag-split-safe,
    // unlike the full string which the vendor markup may wrap or HTML-escape.
    for (const k of keys) {
      const word = firstText(k).match(/[A-Za-zÀ-ÿ]{5,}/)?.[0]
      expect(word, `${k} hero copy has no plain word`).toBeTruthy()
      expect(renderLook(k), `${k} did not render its hero copy`).toContain(word!)
    }
  })

  it('the looks declare distinct colour palettes (≥3 distinct color.primary)', () => {
    const primaries = keys.map(primary).filter((p): p is string => !!p)
    expect(new Set(primaries.map((p) => p.toLowerCase())).size).toBeGreaterThanOrEqual(3)
  })
})
