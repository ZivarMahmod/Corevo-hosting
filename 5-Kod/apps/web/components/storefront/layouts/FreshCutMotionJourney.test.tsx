/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FreshCutMotionJourney, motionPhaseForProgress } from './FreshCutMotionJourney'
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type ObserverRecord = {
  callback: IntersectionObserverCallback
  disconnect: ReturnType<typeof vi.fn>
  target?: Element
}

type ResizeObserverRecord = {
  callback: ResizeObserverCallback
  disconnect: ReturnType<typeof vi.fn>
  target?: Element
}

let container: HTMLDivElement
let root: Root
let reducedMotion = false
let saveData = false
let nextFrame = 1
let frames: Map<number, FrameRequestCallback>
let observers: ObserverRecord[]
let resizeObservers: ResizeObserverRecord[]
let viewportHeight = 400
let visualViewport: VisualViewport

function posters() {
  return [
    <section
      key="threshold"
      aria-labelledby="motion-threshold-title"
      data-poster-composition="threshold"
    >
      <h1 id="motion-threshold-title" tabIndex={-1}>
        Entrérubrik
      </h1>
      <a href="https://booking.example/">Boka entré</a>
    </section>,
    <section key="craft" aria-labelledby="motion-craft-title" data-poster-composition="craft">
      <h2 id="motion-craft-title" tabIndex={-1}>
        Hantverksrubrik
      </h2>
      <a href="https://booking.example/">Boka hantverk</a>
    </section>,
    <section key="mirror" aria-labelledby="motion-mirror-title" data-poster-composition="mirror">
      <h2 id="motion-mirror-title" tabIndex={-1}>
        Resultatrubrik
      </h2>
      <a href="https://booking.example/">Boka resultat</a>
    </section>,
  ]
}

async function renderJourney() {
  await act(async () => root.render(<FreshCutMotionJourney>{posters()}</FreshCutMotionJourney>))
  return container.querySelector<HTMLElement>('[data-motion-mode]')!
}

function flushFrames() {
  const queued = [...frames.values()]
  frames.clear()
  for (const callback of queued) callback(0)
}

describe('FreshCutMotionJourney', () => {
  beforeEach(() => {
    reducedMotion = false
    saveData = false
    nextFrame = 1
    frames = new Map()
    observers = []
    resizeObservers = []
    viewportHeight = 400

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 })
    visualViewport = new EventTarget() as VisualViewport
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      get: () => viewportHeight,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: reducedMotion,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    })
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: {
        get saveData() {
          return saveData
        },
      },
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrame++
        frames.set(id, callback)
        return id
      }),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn((id: number) => frames.delete(id)),
    })
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        readonly root = null
        readonly rootMargin = '0px'
        readonly thresholds = [0]
        private readonly record: ObserverRecord

        constructor(callback: IntersectionObserverCallback) {
          this.record = { callback, disconnect: vi.fn() }
          observers.push(this.record)
        }

        observe = (target: Element) => {
          this.record.target = target
        }
        unobserve = vi.fn()
        disconnect = () => this.record.disconnect()
        takeRecords = () => []
      },
    })
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        private readonly record: ResizeObserverRecord

        constructor(callback: ResizeObserverCallback) {
          this.record = { callback, disconnect: vi.fn() }
          resizeObservers.push(this.record)
        }

        observe = (target: Element) => {
          this.record.target = target
        }
        unobserve = vi.fn()
        disconnect = () => this.record.disconnect()
      },
    })

    window.history.replaceState(null, '', '/')
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it.each([
    [-1, 'threshold'],
    [0, 'threshold'],
    [0.599999, 'threshold'],
    [0.6, 'craft'],
    [0.869999, 'craft'],
    [0.87, 'mirror'],
    [1, 'mirror'],
    [2, 'mirror'],
  ] as const)('maps clamped progress %s to %s', (progress, expected) => {
    expect(motionPhaseForProgress(progress)).toBe(expected)
  })

  it.each([
    ['reduced motion', true, false],
    ['save-data', false, true],
  ])('keeps the complete journey sequential for %s', async (_label, reduced, saving) => {
    reducedMotion = reduced
    saveData = saving

    const journey = await renderJourney()

    expect(journey.dataset.motionMode).toBe('static')
    expect(journey.querySelectorAll('[data-poster-composition]')).toHaveLength(3)
    expect(journey.querySelectorAll('a[href="https://booking.example/"]')).toHaveLength(3)
    expect(observers).toHaveLength(0)
    expect(frames).toHaveLength(0)
  })

  it('keeps one queued frame, gates offscreen work, and updates progress while paused', async () => {
    const journey = await renderJourney()
    let top = -360
    vi.spyOn(journey, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: top,
      top,
      right: 100,
      bottom: top + 1000,
      left: 0,
      width: 100,
      height: 1000,
      toJSON: () => ({}),
    }))

    expect(journey.dataset.motionMode).toBe('static')
    expect(observers).toHaveLength(1)
    window.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(0)

    observers[0]!.callback(
      [{ isIntersecting: true, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(1)

    await act(async () => flushFrames())
    expect(journey.dataset.motionMode).toBe('enhanced')
    expect(journey.style.getPropertyValue('--motion-progress')).toBe('0.6')

    const pause = journey.querySelector<HTMLButtonElement>('button[aria-pressed]')!
    await act(async () => pause.click())
    expect(pause.getAttribute('aria-pressed')).toBe('true')

    top = -522
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(1)
    await act(async () => flushFrames())
    expect(journey.style.getPropertyValue('--motion-progress')).toBe('0.87')
    expect(journey.dataset.motionPhase).toBe('mirror')
    expect(journey.dataset.motionPaused).toBe('true')
    expect(journey.querySelector('a[aria-current="step"]')?.textContent).toBe('Resultatet')
  })

  it('keeps static anchors until the first intersection measurement completes', async () => {
    const journey = await renderJourney()
    vi.spyOn(journey, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 1000,
      left: 0,
      width: 100,
      height: 1000,
      toJSON: () => ({}),
    })
    const anchors = [...journey.querySelectorAll<HTMLElement>('[data-motion-checkpoint]')]

    expect(journey.dataset.motionMode).toBe('static')
    expect(journey.dataset.motionEnhanced).toBeUndefined()
    expect(anchors.map((anchor) => anchor.style.getPropertyValue('--motion-checkpoint-top'))).toEqual([
      '',
      '',
      '',
    ])

    observers[0]!.callback(
      [{ isIntersecting: false, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(frames).toHaveLength(0)
    expect(journey.dataset.motionMode).toBe('static')

    observers[0]!.callback(
      [{ isIntersecting: true, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(frames).toHaveLength(1)
    expect(journey.dataset.motionMode).toBe('static')

    await act(async () => flushFrames())

    expect(journey.dataset.motionMode).toBe('enhanced')
    expect(anchors.map((anchor) => anchor.style.getPropertyValue('--motion-checkpoint-top'))).toEqual([
      '0px',
      '360px',
      '522px',
    ])
  })

  it('waits for the clicked checkpoint phase to render before focusing its heading', async () => {
    const journey = await renderJourney()
    vi.spyOn(journey, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: -522,
      top: -522,
      right: 100,
      bottom: 478,
      left: 0,
      width: 100,
      height: 1000,
      toJSON: () => ({}),
    })

    const heading = journey.querySelector<HTMLElement>('#motion-mirror-title')!
    const focus = vi.spyOn(heading, 'focus')
    const link = [...journey.querySelectorAll<HTMLAnchorElement>('nav a')].find(
      (candidate) => candidate.textContent === 'Resultatet',
    )!

    await act(async () => {
      link.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(window.location.hash).toBe('#motion-checkpoint-mirror')
    expect(focus).not.toHaveBeenCalled()
    expect(journey.dataset.motionPhase).toBe('threshold')

    observers[0]!.callback(
      [{ isIntersecting: true, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await act(async () => flushFrames())

    expect(journey.dataset.motionPhase).toBe('mirror')
    expect(document.activeElement).toBe(heading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('focuses an already-current checkpoint after preserving native hash navigation', async () => {
    const journey = await renderJourney()
    const heading = journey.querySelector<HTMLElement>('#motion-threshold-title')!
    const focus = vi.spyOn(heading, 'focus')
    const link = [...journey.querySelectorAll<HTMLAnchorElement>('nav a')].find(
      (candidate) => candidate.textContent === 'Entré',
    )!

    await act(async () => {
      link.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(window.location.hash).toBe('#motion-checkpoint-threshold')
    expect(document.activeElement).toBe(heading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('focuses any checkpoint in static mode after preserving native hash navigation', async () => {
    reducedMotion = true
    const journey = await renderJourney()
    const heading = journey.querySelector<HTMLElement>('#motion-mirror-title')!
    const focus = vi.spyOn(heading, 'focus')
    const link = [...journey.querySelectorAll<HTMLAnchorElement>('nav a')].find(
      (candidate) => candidate.textContent === 'Resultatet',
    )!

    await act(async () => {
      link.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(journey.dataset.motionMode).toBe('static')
    expect(window.location.hash).toBe('#motion-checkpoint-mirror')
    expect(document.activeElement).toBe(heading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('shares measured travel with checkpoint anchors and coalesces every resize source', async () => {
    viewportHeight = 500
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const journey = await renderJourney()
    let top = -300
    let height = 1000
    vi.spyOn(journey, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: top,
      top,
      right: 100,
      bottom: top + height,
      left: 0,
      width: 100,
      height,
      toJSON: () => ({}),
    }))

    observers[0]!.callback(
      [{ isIntersecting: true, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await act(async () => flushFrames())

    expect(journey.style.getPropertyValue('--motion-progress')).toBe('0.6')
    expect(
      journey
        .querySelector<HTMLElement>('[data-motion-checkpoint="craft"]')!
        .style.getPropertyValue('--motion-checkpoint-top'),
    ).toBe('300px')
    expect(
      journey
        .querySelector<HTMLElement>('[data-motion-checkpoint="mirror"]')!
        .style.getPropertyValue('--motion-checkpoint-top'),
    ).toBe('435px')

    viewportHeight = 450
    height = 1050
    top = -300
    window.dispatchEvent(new Event('resize'))
    visualViewport.dispatchEvent(new Event('resize'))
    resizeObservers[0]!.callback([], {} as ResizeObserver)

    expect(frames).toHaveLength(1)
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'scroll'),
    ).toHaveLength(1)
    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })

    await act(async () => flushFrames())

    expect(journey.style.getPropertyValue('--motion-progress')).toBe('0.5')
    expect(
      journey
        .querySelector<HTMLElement>('[data-motion-checkpoint="craft"]')!
        .style.getPropertyValue('--motion-checkpoint-top'),
    ).toBe('360px')
    expect(
      journey
        .querySelector<HTMLElement>('[data-motion-checkpoint="mirror"]')!
        .style.getPropertyValue('--motion-checkpoint-top'),
    ).toBe('522px')
  })

  it('remains active without observer or visual viewport support', async () => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined })
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
    const journey = await renderJourney()
    vi.spyOn(journey, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: -522,
      top: -522,
      right: 100,
      bottom: 478,
      left: 0,
      width: 100,
      height: 1000,
      toJSON: () => ({}),
    })
    await act(async () => flushFrames())
    expect(journey.dataset.motionPhase).toBe('mirror')

    const heading = journey.querySelector<HTMLElement>('#motion-mirror-title')!
    const focus = vi.spyOn(heading, 'focus')
    const link = [...journey.querySelectorAll<HTMLAnchorElement>('nav a')].find(
      (candidate) => candidate.textContent === 'Resultatet',
    )!
    let defaultPrevented = true
    link.addEventListener('click', (event) => {
      defaultPrevented = event.defaultPrevented
    })

    await act(async () => {
      link.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(defaultPrevented).toBe(false)
    expect(window.location.hash).toBe('#motion-checkpoint-mirror')
    expect(document.activeElement).toBe(heading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('cleans up the observer, scroll listener, and queued frame', async () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const removeViewportListener = vi.spyOn(visualViewport, 'removeEventListener')
    await renderJourney()
    observers[0]!.callback(
      [{ isIntersecting: true, target: observers[0]!.target } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    window.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(1)

    await act(async () => root.unmount())

    expect(observers[0]!.disconnect).toHaveBeenCalledOnce()
    expect(resizeObservers[0]!.disconnect).toHaveBeenCalledOnce()
    expect(window.cancelAnimationFrame).toHaveBeenCalledOnce()
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeViewportListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
