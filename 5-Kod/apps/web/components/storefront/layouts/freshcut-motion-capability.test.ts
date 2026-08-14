// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as capability from './freshcut-motion-capability'

type CapabilityModule = typeof capability & {
  claimFreshCutMotionPrepaintCapability: () => boolean
  releaseFreshCutMotionPrepaintCapability: () => void
}

class TestStyleSheet {
  cssText = ''

  replaceSync(cssText: string) {
    this.cssText = cssText
  }
}

const motionCapability = capability as CapabilityModule
const capabilityGlobalDescriptors = [
  [globalThis, 'CSSStyleSheet'],
  [document, 'adoptedStyleSheets'],
  [window, 'requestAnimationFrame'],
  [window, 'matchMedia'],
  [navigator, 'connection'],
  [navigator, 'deviceMemory'],
] as const
const capabilityOriginalDescriptors = capabilityGlobalDescriptors.map(([target, key]) => ({
  descriptor: Object.getOwnPropertyDescriptor(target, key),
  key,
  target,
}))

function restoreCapabilityGlobalDescriptors() {
  for (const { descriptor, key, target } of capabilityOriginalDescriptors) {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
  }
}

describe('FreshCut motion prepaint capability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(globalThis, 'CSSStyleSheet', {
      configurable: true,
      value: TestStyleSheet,
    })
    Object.defineProperty(document, 'adoptedStyleSheets', {
      configurable: true,
      value: [],
      writable: true,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    })
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', saveData: false },
    })
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 8,
    })
  })

  afterEach(() => {
    capability.clearFreshCutMotionPrepaintCapability()
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreCapabilityGlobalDescriptors()
  })

  it('removes the prepaint sheet when hydration never claims it', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()

    expect(document.adoptedStyleSheets).toHaveLength(1)
    vi.advanceTimersByTime(5_000)

    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(false)
  })

  it('keeps the absolute watchdog after hydration claims the sheet', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()

    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(true)
    vi.advanceTimersByTime(3_999)
    expect(document.adoptedStyleSheets).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(false)
  })

  it('grants the prepaint claim to only one concurrent runtime owner', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()

    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(true)
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(false)
    expect(document.adoptedStyleSheets).toHaveLength(1)
  })

  it('lets a StrictMode remount reclaim a pending release without losing prepaint', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(true)

    motionCapability.releaseFreshCutMotionPrepaintCapability()
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(true)
    vi.advanceTimersByTime(0)

    expect(document.adoptedStyleSheets).toHaveLength(1)
  })

  it('keeps the ready owner token until cleanup blocks late duplicate prepaint', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(true)

    capability.markFreshCutMotionPrepaintReady()
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(capability.getFreshCutMotionPrepaintDeadline()).toBeNull()

    expect(capability.applyFreshCutMotionPrepaintCapability()).toBe(false)
    expect(motionCapability.claimFreshCutMotionPrepaintCapability()).toBe(false)
    expect(document.adoptedStyleSheets).toHaveLength(0)

    motionCapability.releaseFreshCutMotionPrepaintCapability()
    vi.advanceTimersByTime(0)
    expect(capability.applyFreshCutMotionPrepaintCapability()).toBe(true)
    expect(document.adoptedStyleSheets).toHaveLength(1)
  })

  it('prepaints compact travel through 1023px without forcing the tablet panel to one column', () => {
    new Function(capability.FRESHCUT_MOTION_PREPAINT_SCRIPT)()

    const cssText = (document.adoptedStyleSheets[0] as unknown as TestStyleSheet).cssText
    const compactStart = cssText.indexOf('@media (max-width: 1023px)')
    const phoneStart = cssText.indexOf('@media (max-width: 767px)')

    expect(compactStart).toBeGreaterThanOrEqual(0)
    expect(phoneStart).toBeGreaterThan(compactStart)
    expect(cssText.slice(compactStart, phoneStart)).toContain(
      'var(--motion-scroll-distance-mobile)',
    )
    expect(cssText.slice(compactStart, phoneStart)).not.toContain('[data-motion-business-panel]')
    expect(cssText.slice(phoneStart)).toContain('[data-motion-business-panel]')
  })
})

describe('FreshCut motion capability test isolation', () => {
  it('leaves every overwritten global descriptor at its file-entry sentinel', () => {
    for (const { descriptor, key, target } of capabilityOriginalDescriptors) {
      expect(Object.getOwnPropertyDescriptor(target, key), String(key)).toEqual(descriptor)
    }
  })
})
