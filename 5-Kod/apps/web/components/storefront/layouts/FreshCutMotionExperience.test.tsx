/** @vitest-environment happy-dom */

import React, { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRESHCUT_MOTION_SCENES, motionSceneForProgress } from './freshcut-motion-scenes'

const experienceGlobalDescriptors = [
  [window, 'matchMedia'],
  [window, 'scrollTo'],
  [window, 'requestAnimationFrame'],
  [window, 'cancelAnimationFrame'],
  [window, 'innerWidth'],
  [navigator, 'connection'],
  [navigator, 'deviceMemory'],
  [globalThis, 'CSSStyleSheet'],
  [document, 'adoptedStyleSheets'],
  [globalThis, 'IS_REACT_ACT_ENVIRONMENT'],
] as const
const experienceOriginalDescriptors = experienceGlobalDescriptors.map(([target, key]) => ({
  descriptor: Object.getOwnPropertyDescriptor(target, key),
  key,
  target,
}))

function restoreExperienceGlobalDescriptors() {
  for (const { descriptor, key, target } of experienceOriginalDescriptors) {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
  }
}

const frameHarness = vi.hoisted(() => {
  let nextId = 1
  let paintPasses = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => callbacks.delete(id))

  return {
    cancel,
    request,
    get paintPasses() {
      return paintPasses
    },
    get pendingCount() {
      return callbacks.size
    },
    flush() {
      paintPasses += 1
      const frameCallbacks = Array.from(callbacks.values())
      callbacks.clear()
      for (const callback of frameCallbacks) callback(paintPasses * 16)
    },
    reset() {
      nextId = 1
      paintPasses = 0
      callbacks.clear()
      request.mockClear()
      cancel.mockClear()
    },
  }
})

const gsapHarness = vi.hoisted(() => {
  type TimelineRecord = {
    options: Record<string, unknown>
    progressValue: number
    killed: boolean
    set: ReturnType<typeof vi.fn>
    to: ReturnType<typeof vi.fn>
    fromTo: ReturnType<typeof vi.fn>
    progress: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    kill: ReturnType<typeof vi.fn>
  }

  type TriggerRecord = {
    config: {
      onUpdate: (self: TriggerRecord) => void
      onToggle?: (self: TriggerRecord) => void
      [key: string]: unknown
    }
    progress: number
    direction: 1 | -1
    isActive: boolean
    velocity: number
    start: number
    end: number
    killed: boolean
    measuredHeightAtCreate: number | undefined
    motionModeAtCreate: string | undefined
    paintPassesAtCreate: number
    getVelocity: ReturnType<typeof vi.fn>
    kill: ReturnType<typeof vi.fn>
  }

  type ContextRecord = {
    reverted: boolean
    revert: ReturnType<typeof vi.fn>
  }

  const timelines: TimelineRecord[] = []
  const triggers: TriggerRecord[] = []
  const contexts: ContextRecord[] = []
  const moduleLoads = { gsap: 0, scrollTrigger: 0 }
  let progressAtCreate: number | null = null
  let moduleGate: Promise<void> | null = null
  let releaseModuleGate: (() => void) | null = null
  let triggerFailure: Error | null = null

  const timeline = vi.fn((options: Record<string, unknown>) => {
    const record = {} as TimelineRecord
    record.options = options
    record.progressValue = 0
    record.killed = false
    record.set = vi.fn(() => record)
    record.to = vi.fn(() => record)
    record.fromTo = vi.fn(() => record)
    record.progress = vi.fn((value?: number) => {
      if (typeof value === 'number') {
        record.progressValue = value
        return record
      }
      return record.progressValue
    })
    record.pause = vi.fn(() => record)
    record.kill = vi.fn(() => {
      record.killed = true
      return record
    })
    timelines.push(record)
    return record
  })

  const context = vi.fn((setup: () => void) => {
    const record = {} as ContextRecord
    record.reverted = false
    record.revert = vi.fn(() => {
      record.reverted = true
    })
    contexts.push(record)
    setup()
    return record
  })

  const createTrigger = vi.fn((config: TriggerRecord['config']) => {
    if (triggerFailure) {
      const error = triggerFailure
      triggerFailure = null
      throw error
    }
    const record = {} as TriggerRecord
    record.config = config
    record.progress = progressAtCreate ?? 0
    record.direction = 1
    record.isActive = true
    record.velocity = 0
    record.start = 400
    record.end = 1600
    record.killed = false
    record.measuredHeightAtCreate =
      config.trigger instanceof HTMLElement
        ? config.trigger.getBoundingClientRect().height
        : undefined
    record.motionModeAtCreate =
      config.trigger instanceof HTMLElement ? config.trigger.dataset.motionMode : undefined
    record.paintPassesAtCreate = frameHarness.paintPasses
    record.getVelocity = vi.fn(() => record.velocity)
    record.kill = vi.fn(() => {
      record.killed = true
    })
    triggers.push(record)
    if (progressAtCreate !== null) config.onUpdate(record)
    return record
  })

  return {
    contexts,
    context,
    createTrigger,
    moduleLoads,
    timeline,
    timelines,
    triggers,
    holdModuleLoad() {
      if (moduleGate) return
      moduleGate = new Promise<void>((resolve) => {
        releaseModuleGate = () => {
          moduleGate = null
          releaseModuleGate = null
          resolve()
        }
      })
    },
    releaseModuleLoad() {
      releaseModuleGate?.()
    },
    waitForModuleLoad() {
      return moduleGate ?? Promise.resolve()
    },
    emitProgress(
      record: TriggerRecord,
      progress: number,
      overrides: Partial<Pick<TriggerRecord, 'direction' | 'isActive' | 'velocity'>> = {},
    ) {
      record.progress = progress
      Object.assign(record, overrides)
      record.config.onUpdate(record)
    },
    setProgressAtCreate(progress: number | null) {
      progressAtCreate = progress
    },
    failNextTriggerCreate(error = new Error('ScrollTrigger construction failed')) {
      triggerFailure = error
    },
    resetResources() {
      contexts.length = 0
      timelines.length = 0
      triggers.length = 0
      context.mockClear()
      createTrigger.mockClear()
      timeline.mockClear()
      progressAtCreate = null
      triggerFailure = null
    },
  }
})

const mediaHarness = vi.hoisted(() => {
  type MediaControllerRecord = {
    root: HTMLElement
    scenes: readonly unknown[]
    sync: ReturnType<typeof vi.fn>
    setPaused: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }

  const controllers: MediaControllerRecord[] = []
  let materializeApprovedFixture = false
  const create = vi.fn((root: HTMLElement, scenes: readonly unknown[]) => {
    let ownedVideo: HTMLVideoElement | null = null
    let ownedSource: HTMLSourceElement | null = null
    if (materializeApprovedFixture) {
      const host = root.querySelector<HTMLElement>('[data-motion-media-host]')
      if (host) {
        const family = '/media/freshcut-motion/hero-v1-a1b2c3d4e5f6'
        ownedVideo = document.createElement('video')
        ownedSource = document.createElement('source')
        ownedSource.dataset.motionMediaSrc = `${family}/hero-v1-a1b2c3d4e5f6-desktop.webm`
        ownedVideo.append(ownedSource)
        host.append(ownedVideo)
      }
    }
    const record: MediaControllerRecord = {
      root,
      scenes,
      sync: vi.fn(() => {
        if (!ownedVideo || !ownedSource || ownedSource.hasAttribute('src')) return
        ownedSource.src = ownedSource.dataset.motionMediaSrc ?? ''
        ownedVideo.load()
      }),
      setPaused: vi.fn(),
      destroy: vi.fn(() => ownedVideo?.remove()),
    }
    controllers.push(record)
    return record
  })

  return {
    controllers,
    create,
    useApprovedFixture() {
      materializeApprovedFixture = true
    },
    reset() {
      controllers.length = 0
      create.mockClear()
      materializeApprovedFixture = false
    },
  }
})

vi.mock('gsap', async () => {
  await gsapHarness.waitForModuleLoad()
  gsapHarness.moduleLoads.gsap += 1
  const gsap = {
    context: gsapHarness.context,
    registerPlugin: vi.fn(),
    timeline: gsapHarness.timeline,
  }
  return { default: gsap, gsap }
})

vi.mock('gsap/ScrollTrigger', async () => {
  await gsapHarness.waitForModuleLoad()
  gsapHarness.moduleLoads.scrollTrigger += 1
  return {
    ScrollTrigger: {
      create: gsapHarness.createTrigger,
    },
  }
})

vi.mock('./FreshCutMotionMediaController', () => ({
  createFreshCutMotionMediaController: mediaHarness.create,
}))

import { FreshCutMotionExperience, motionScrollPositionForScene } from './FreshCutMotionExperience'
import {
  applyFreshCutMotionPrepaintCapability,
  clearFreshCutMotionPrepaintCapability,
} from './freshcut-motion-capability'

const BOOKING_HREF = 'https://booking.example/freshcut'

class TestStyleSheet {
  replaceSync(_cssText: string) {}
}

function completeExperience() {
  return (
    <>
      {FRESHCUT_MOTION_SCENES.map((scene) => (
        <section key={scene.id} id={scene.anchorId} data-motion-scene={scene.id}>
          {scene.layers.map((rawLayer, index) => {
            const layer =
              typeof rawLayer === 'string'
                ? {
                    token: rawLayer,
                    kind: index === 0 ? 'media' : 'side-scrim',
                    depthFactor: [0.5, 0.2, 0.8, 0.9][index] ?? 0.5,
                  }
                : rawLayer
            return (
              <div
                key={layer.token}
                data-motion-layer={layer.token}
                data-motion-layer-kind={layer.kind}
                data-motion-depth-factor={layer.depthFactor}
                data-motion-media-host={layer.kind === 'media' ? scene.id : undefined}
              />
            )
          })}
          <h2 id={scene.headingId} tabIndex={-1}>
            {scene.label}
          </h2>
        </section>
      ))}
      <aside data-motion-business-panel="true">
        Boka och hitta hit
        <a href="#motion-scene-entrance">Upplev FreshCut</a>
      </aside>
    </>
  )
}

async function settleEnhancement() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
  await act(async () => frameHarness.flush())
  await act(async () => frameHarness.flush())
}

describe('FreshCut master motion experience', () => {
  it('renders all stable scene destinations and useful controls before enhancement', () => {
    const html = renderToStaticMarkup(
      <FreshCutMotionExperience bookingControl={<a href={BOOKING_HREF}>Boka nu</a>}>
        <section id="motion-scene-hero">Hero</section>
        <section id="motion-scene-entrance">Entrance</section>
        <section id="motion-scene-chair">Chair</section>
        <section id="motion-scene-craft">Craft</section>
        <section id="motion-scene-range">Range</section>
        <section id="motion-scene-return">Return</section>
        <section id="motion-scene-mirror">Mirror</section>
        <section id="motion-scene-team">Team</section>
      </FreshCutMotionExperience>,
    )

    expect(html).toContain('data-motion-mode="static"')
    expect(html).toContain('data-motion-scene="hero"')
    expect(html).toContain('data-motion-mobile-phase="enter"')
    expect(html).toContain('data-motion-paused="false"')
    expect(html).toContain('data-motion-released="false"')
    expect(html).toContain('href="#motion-scene-hero"')
    expect(html).toContain('href="#motion-scene-entrance"')
    expect(html).toContain('href="#motion-scene-chair"')
    expect(html).toContain('href="#motion-scene-craft"')
    expect(html).toContain('href="#motion-scene-range"')
    expect(html).toContain('href="#motion-scene-return"')
    expect(html).toContain('href="#motion-scene-mirror"')
    expect(html).toContain('href="#motion-scene-team"')
    expect(html).toContain('Hoppa till resultat')
    expect(html).toContain('Se tjänster')
    expect(html).toContain(`href="${BOOKING_HREF}"`)
    expect(html).toContain('Boka nu')
    expect(html).toContain('Pausa rörelse')
  })

  it('places every non-hero checkpoint inside its half-open scene at integer boundaries', () => {
    const checkpoints = [
      { sceneId: 'entrance', scrollTop: 545 },
      { sceneId: 'chair', scrollTop: 737 },
      { sceneId: 'craft', scrollTop: 917 },
      { sceneId: 'range', scrollTop: 1121 },
      { sceneId: 'return', scrollTop: 1313 },
      { sceneId: 'mirror', scrollTop: 1457 },
      { sceneId: 'team', scrollTop: 1541 },
    ] as const

    expect(motionScrollPositionForScene(400, 1600, 'hero')).toBe(400)
    for (const checkpoint of checkpoints) {
      const scrollTop = motionScrollPositionForScene(400, 1600, checkpoint.sceneId)

      expect(scrollTop).toBe(checkpoint.scrollTop)
      expect(motionSceneForProgress((scrollTop - 400) / 1200).id).toBe(checkpoint.sceneId)
    }
  })

  it('normalises an inverted or empty master range rather than navigating backwards', () => {
    expect(motionScrollPositionForScene(800, 800, 'mirror')).toBe(800)
    expect(motionScrollPositionForScene(800, 200, 'team')).toBe(800)
  })

  it('caps an inward-quantized checkpoint at the end of a subpixel master range', () => {
    expect(motionScrollPositionForScene(400, 400.5, 'mirror')).toBe(400.5)
  })

  it('rounds every non-hero browser checkpoint upward across fractional scene boundaries', () => {
    expect(motionScrollPositionForScene(101, 1181, 'hero')).toBe(101)
    expect(motionScrollPositionForScene(101, 1181, 'entrance')).toBe(231)
    expect(motionScrollPositionForScene(101, 1181, 'chair')).toBe(404)
    expect(motionScrollPositionForScene(101, 1181, 'craft')).toBe(566)
    expect(motionScrollPositionForScene(101, 1181, 'range')).toBe(750)
    expect(motionScrollPositionForScene(101, 1181, 'return')).toBe(922)
    expect(motionScrollPositionForScene(101, 1181, 'mirror')).toBe(1052)
    expect(motionScrollPositionForScene(101, 1181, 'team')).toBe(1128)
  })
})

describe('FreshCut master motion enhancement', () => {
  let container: HTMLDivElement
  let compactQuery: MediaQueryList & { emit: (matches: boolean) => void }
  let reducedQuery: MediaQueryList & { emit: (matches: boolean) => void }
  let connection: {
    readonly effectiveType: string
    readonly saveData: boolean
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    emit: () => void
  }
  let root: Root | null
  let deviceMemory: number
  let effectiveType: string
  let reducedMotion: boolean
  let saveData: boolean

  beforeEach(() => {
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
      configurable: true,
      value: true,
      writable: true,
    })
    frameHarness.reset()
    gsapHarness.resetResources()
    mediaHarness.reset()
    deviceMemory = 8
    effectiveType = '4g'
    reducedMotion = false
    saveData = false
    window.history.replaceState(null, '', '/')
    const compactListeners = new Set<(event: MediaQueryListEvent) => void>()
    const reducedListeners = new Set<(event: MediaQueryListEvent) => void>()
    const connectionListeners = new Set<(event: Event) => void>()
    compactQuery = {
      matches: false,
      media: '(max-width: 1023px)',
      onchange: null,
      addEventListener: vi.fn((_type, listener) => {
        compactListeners.add(listener as (event: MediaQueryListEvent) => void)
      }),
      removeEventListener: vi.fn((_type, listener) => {
        compactListeners.delete(listener as (event: MediaQueryListEvent) => void)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      emit(matches) {
        Object.defineProperty(this, 'matches', { configurable: true, value: matches })
        const event = { matches, media: this.media } as MediaQueryListEvent
        for (const listener of compactListeners) listener(event)
      },
    }
    reducedQuery = {
      get matches() {
        return reducedMotion
      },
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn((_type, listener) => {
        reducedListeners.add(listener as (event: MediaQueryListEvent) => void)
      }),
      removeEventListener: vi.fn((_type, listener) => {
        reducedListeners.delete(listener as (event: MediaQueryListEvent) => void)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      emit(matches) {
        reducedMotion = matches
        const event = { matches, media: this.media } as MediaQueryListEvent
        for (const listener of reducedListeners) listener(event)
      },
    }
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => (query === compactQuery.media ? compactQuery : reducedQuery)),
    })
    connection = {
      get effectiveType() {
        return effectiveType
      },
      get saveData() {
        return saveData
      },
      addEventListener: vi.fn((_type, listener) => {
        connectionListeners.add(listener as (event: Event) => void)
      }),
      removeEventListener: vi.fn((_type, listener) => {
        connectionListeners.delete(listener as (event: Event) => void)
      }),
      emit() {
        for (const listener of connectionListeners) listener(new Event('change'))
      },
    }
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: connection,
    })
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      get() {
        return deviceMemory
      },
    })
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: frameHarness.request,
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: frameHarness.cancel,
    })
    Object.defineProperty(globalThis, 'CSSStyleSheet', {
      configurable: true,
      value: TestStyleSheet,
    })
    Object.defineProperty(document, 'adoptedStyleSheets', {
      configurable: true,
      value: [],
      writable: true,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const isExperienceRoot = this.hasAttribute('data-motion-mode')
      const preparedAndPainted =
        this.dataset.motionMode === 'preparing' && frameHarness.paintPasses >= 2
      const height = isExperienceRoot ? (preparedAndPainted ? 1980 : 7200) : 0
      return {
        bottom: 101 + height,
        height,
        left: 0,
        right: 1440,
        top: 101,
        width: 1440,
        x: 0,
        y: 101,
        toJSON: () => ({}),
      } as DOMRect
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    gsapHarness.releaseModuleLoad()
    if (root) await act(async () => root?.unmount())
    clearFreshCutMotionPrepaintCapability()
    vi.useRealTimers()
    container.remove()
    vi.restoreAllMocks()
    restoreExperienceGlobalDescriptors()
  })

  async function renderExperience(strict = false) {
    applyFreshCutMotionPrepaintCapability()
    const experience = (
      <FreshCutMotionExperience bookingControl={<a href={BOOKING_HREF}>Boka nu</a>}>
        {completeExperience()}
      </FreshCutMotionExperience>
    )
    await act(async () => root?.render(strict ? <StrictMode>{experience}</StrictMode> : experience))
    await settleEnhancement()
    return container.querySelector<HTMLElement>('[data-motion-mode]')!
  }

  it.each([
    ['reduced motion', true, false, 8, '4g'],
    ['save-data', false, true, 8, '4g'],
    ['low memory', false, false, 2, '4g'],
    ['a slow connection', false, false, 8, '2g'],
  ])(
    'keeps every scene static and does not load GSAP for %s',
    async (_label, reduced, saving, memory, connectionType) => {
      reducedMotion = reduced
      saveData = saving
      deviceMemory = memory
      effectiveType = connectionType

      const experience = await renderExperience()
      const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!
      const mirrorHeading = stage.querySelector<HTMLElement>('#motion-scene-mirror-title')!
      const focus = vi.spyOn(mirrorHeading, 'focus')
      const mirrorLink = experience.querySelector<HTMLAnchorElement>(
        'nav a[href="#motion-scene-mirror"]',
      )!

      expect(experience.dataset.motionMode).toBe('static')
      expect(stage.querySelectorAll(':scope > [data-motion-scene]')).toHaveLength(8)
      expect(stage.querySelector(':scope > [data-motion-business-panel]')).not.toBeNull()
      expect(gsapHarness.moduleLoads).toEqual({ gsap: 0, scrollTrigger: 0 })
      expect(gsapHarness.timelines).toHaveLength(0)
      expect(gsapHarness.triggers).toHaveLength(0)
      expect(mediaHarness.controllers).toHaveLength(0)

      await act(async () => {
        mirrorLink.click()
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })

      expect(window.location.hash).toBe('#motion-scene-mirror')
      expect(document.activeElement).toBe(mirrorHeading)
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    },
  )

  it('leaves an initial manifest hash to native anchors when motion stays static', async () => {
    reducedMotion = true
    window.history.replaceState(null, '', '/#motion-scene-mirror')

    const experience = await renderExperience()

    expect(experience.dataset.motionMode).toBe('static')
    expect(window.location.hash).toBe('#motion-scene-mirror')
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
  })

  it('fails static closed at the absolute bootstrap deadline and ignores a late runtime', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    gsapHarness.holdModuleLoad()
    applyFreshCutMotionPrepaintCapability()

    await act(async () => {
      root?.render(
        <FreshCutMotionExperience bookingControl={<a href={BOOKING_HREF}>Boka nu</a>}>
          {completeExperience()}
        </FreshCutMotionExperience>,
      )
    })
    const experience = container.querySelector<HTMLElement>('[data-motion-mode]')!

    expect(document.adoptedStyleSheets).toHaveLength(1)
    await act(async () => vi.advanceTimersByTimeAsync(4_000))
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(experience.dataset.motionMode).toBe('static')

    await act(async () => {
      gsapHarness.releaseModuleLoad()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => frameHarness.flush())
    await act(async () => frameHarness.flush())

    expect(experience.dataset.motionMode).toBe('static')
    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
    expect(frameHarness.pendingCount).toBe(0)
  })

  it('keeps 3g static and does not load the motion runtime', async () => {
    effectiveType = '3g'

    const experience = await renderExperience()

    expect(experience.dataset.motionMode).toBe('static')
    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
    expect(mediaHarness.controllers).toHaveLength(0)
  })

  it('tears down the enhanced owner when reduced motion becomes preferred', async () => {
    const experience = await renderExperience()
    const timeline = gsapHarness.timelines[0]!
    const trigger = gsapHarness.triggers[0]!
    const media = mediaHarness.controllers[0]!

    await act(async () => reducedQuery.emit(true))

    expect(experience.dataset.motionMode).toBe('static')
    expect(timeline.killed).toBe(true)
    expect(trigger.killed).toBe(true)
    expect(media.destroy).toHaveBeenCalledOnce()
  })

  it('does not rebuild after runtime capability disables enhanced motion', async () => {
    const experience = await renderExperience()

    await act(async () => reducedQuery.emit(true))
    await act(async () => compactQuery.emit(true))
    await act(async () => frameHarness.flush())
    await act(async () => frameHarness.flush())

    expect(experience.dataset.motionMode).toBe('static')
    expect(gsapHarness.timelines).toHaveLength(1)
    expect(gsapHarness.triggers).toHaveLength(1)
    expect(mediaHarness.controllers).toHaveLength(1)
    expect(frameHarness.pendingCount).toBe(0)
  })

  it('tears down the enhanced owner when the connection becomes constrained', async () => {
    const experience = await renderExperience()
    const timeline = gsapHarness.timelines[0]!
    const trigger = gsapHarness.triggers[0]!
    const media = mediaHarness.controllers[0]!

    effectiveType = '3g'
    await act(async () => connection.emit())

    expect(experience.dataset.motionMode).toBe('static')
    expect(timeline.killed).toBe(true)
    expect(trigger.killed).toBe(true)
    expect(media.destroy).toHaveBeenCalledOnce()
  })

  it('does not materialize approved media when ScrollTrigger construction fails', async () => {
    mediaHarness.useApprovedFixture()
    gsapHarness.failNextTriggerCreate()
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})

    const experience = await renderExperience()
    const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!

    expect(experience.dataset.motionMode).toBe('static')
    expect(mediaHarness.create).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(stage.querySelectorAll('video')).toHaveLength(0)
    expect(stage.querySelectorAll('source')).toHaveLength(0)
  })

  it('keeps approved media dormant when a post-trigger bootstrap step fails', async () => {
    mediaHarness.useApprovedFixture()
    window.history.replaceState(null, '', '/#motion-scene-mirror')
    vi.mocked(window.scrollTo).mockImplementation(() => {
      throw new Error('post-trigger bootstrap failed')
    })
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})

    const experience = await renderExperience()
    const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!

    expect(experience.dataset.motionMode).toBe('static')
    expect(gsapHarness.triggers).toHaveLength(1)
    expect(mediaHarness.create).toHaveBeenCalledOnce()
    expect(mediaHarness.controllers[0]!.sync).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(stage.querySelectorAll('video')).toHaveLength(0)
    expect(stage.querySelectorAll('source')).toHaveLength(0)
  })

  it('consumes an exact initial manifest hash through the stable jump after enhancement', async () => {
    window.history.replaceState(null, '', '/#motion-scene-mirror')

    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    const timeline = gsapHarness.timelines[0]!
    const media = mediaHarness.controllers[0]!
    const mirrorHeading = experience.querySelector<HTMLElement>('#motion-scene-mirror-title')!
    const focus = vi.spyOn(mirrorHeading, 'focus')

    expect(experience.dataset.motionMode).toBe('enhanced')
    expect(window.location.hash).toBe('#motion-scene-mirror')
    expect(window.scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 1457 })
    expect(timeline.progressValue).toBe(0.88)
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'mirror',
      progress: 0.88,
      direction: 1,
      visible: true,
      paused: false,
      fast: true,
      checkpoint: true,
    })
    expect(experience.dataset.motionScene).toBe('hero')
    expect(document.activeElement).not.toBe(mirrorHeading)

    await act(async () => gsapHarness.emitProgress(trigger, 0.88))

    expect(experience.dataset.motionScene).toBe('mirror')
    expect(document.activeElement).toBe(mirrorHeading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('focuses an initial manifest hash when native restoration already made its scene current', async () => {
    window.history.replaceState(null, '', '/#motion-scene-mirror')
    gsapHarness.setProgressAtCreate(0.88)

    const experience = await renderExperience()
    const mirrorHeading = experience.querySelector<HTMLElement>('#motion-scene-mirror-title')!

    expect(experience.dataset.motionScene).toBe('mirror')
    expect(window.scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 1457 })

    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)))

    expect(document.activeElement).toBe(mirrorHeading)
  })

  it('does not consume an unknown initial hash after enhancement', async () => {
    window.history.replaceState(null, '', '/#outside-motion-manifest')

    const experience = await renderExperience()

    expect(experience.dataset.motionMode).toBe('enhanced')
    expect(window.location.hash).toBe('#outside-motion-manifest')
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(gsapHarness.timelines[0]!.progressValue).toBe(0)
    expect(experience.dataset.motionScene).toBe('hero')
  })

  it('cancels an eligible setup that unmounts while the preparing layout is pending', async () => {
    applyFreshCutMotionPrepaintCapability()
    const experience = (
      <FreshCutMotionExperience bookingControl={<a href={BOOKING_HREF}>Boka nu</a>}>
        {completeExperience()}
      </FreshCutMotionExperience>
    )

    await act(async () => {
      root?.render(experience)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    const experienceRoot = container.querySelector<HTMLElement>('[data-motion-mode]')!

    expect(experienceRoot.dataset.motionMode).toBe('preparing')
    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
    expect(frameHarness.pendingCount).toBe(1)

    await act(async () => frameHarness.flush())
    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
    expect(frameHarness.pendingCount).toBe(1)

    await act(async () => root?.unmount())
    root = null
    await act(async () => frameHarness.flush())
    await act(async () => frameHarness.flush())

    expect(gsapHarness.timelines).toHaveLength(0)
    expect(gsapHarness.triggers).toHaveLength(0)
    expect(frameHarness.pendingCount).toBe(0)
    expect(frameHarness.cancel).toHaveBeenCalled()
    expect(compactQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('uses one paused timeline and one unpinned ScrollTrigger without app-owned observers', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const experience = await renderExperience()
    const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!

    expect(experience.dataset.motionMode).toBe('enhanced')
    expect(gsapHarness.timelines).toHaveLength(1)
    expect(gsapHarness.timelines[0]!.options).toMatchObject({ paused: true })
    expect(gsapHarness.triggers).toHaveLength(1)
    expect(gsapHarness.triggers[0]!.motionModeAtCreate).toBe('preparing')
    expect(gsapHarness.triggers[0]!.paintPassesAtCreate).toBe(2)
    expect(gsapHarness.triggers[0]!.measuredHeightAtCreate).toBe(1980)
    const triggerConfig = gsapHarness.triggers[0]!.config
    expect(triggerConfig.trigger).toBe(experience)
    expect(triggerConfig.start).toBe('top top')
    expect(triggerConfig.end).toBe('bottom bottom')
    expect(triggerConfig).not.toHaveProperty('pin')
    expect(triggerConfig).not.toHaveProperty('animation')
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'scroll' || type === 'resize'),
    ).toHaveLength(0)
    expect(frameHarness.request).toHaveBeenCalledTimes(2)
    expect(frameHarness.pendingCount).toBe(0)
    expect(stage.children).toHaveLength(9)
    expect(stage.querySelectorAll(':scope > [data-motion-scene]')).toHaveLength(8)
    expect(stage.querySelector(':scope > [data-motion-business-panel]')).not.toBeNull()
  })

  it('updates the logical scene while paused and catches the visual timeline up on resume', async () => {
    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    const timeline = gsapHarness.timelines[0]!
    const pause = experience.querySelector<HTMLButtonElement>('button[aria-pressed]')!

    await act(async () => gsapHarness.emitProgress(trigger, 0.3))
    expect(experience.dataset.motionScene).toBe('chair')
    expect(experience.dataset.motionMobilePhase).toBe('enter')
    expect(experience.style.getPropertyValue('--motion-progress')).toBe('0.3')
    expect(experience.style.getPropertyValue('--motion-visual-progress')).toBe('0.3')
    expect(timeline.progressValue).toBe(0.3)

    await act(async () => pause.click())
    expect(experience.dataset.motionPaused).toBe('true')

    await act(async () => gsapHarness.emitProgress(trigger, 0.65))
    expect(experience.dataset.motionScene).toBe('range')
    expect(experience.dataset.motionMobilePhase).toBe('craft')
    expect(experience.style.getPropertyValue('--motion-progress')).toBe('0.65')
    expect(experience.style.getPropertyValue('--motion-visual-progress')).toBe('0.3')
    expect(timeline.progressValue).toBe(0.3)

    await act(async () => pause.click())
    expect(experience.dataset.motionPaused).toBe('false')
    expect(experience.style.getPropertyValue('--motion-visual-progress')).toBe('0.65')
    expect(timeline.progressValue).toBe(0.65)

    await act(async () => gsapHarness.emitProgress(trigger, 1))
    expect(experience.dataset.motionScene).toBe('team')
    expect(experience.dataset.motionMobilePhase).toBe('result')
    expect(experience.dataset.motionReleased).toBe('true')
  })

  it('schedules directional scene and camera layer transitions on the canonical ranges', async () => {
    const experience = await renderExperience()
    const timeline = gsapHarness.timelines[0]!
    const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!
    const entrance = stage.querySelector<HTMLElement>('[data-motion-scene="entrance"]')!
    const chair = stage.querySelector<HTMLElement>('[data-motion-scene="chair"]')!
    const craft = stage.querySelector<HTMLElement>('[data-motion-scene="craft"]')!
    const range = stage.querySelector<HTMLElement>('[data-motion-scene="range"]')!
    const chairMediaLayer = chair.querySelector<HTMLElement>('[data-motion-layer-kind="media"]')!
    const chairSideScrim = chair.querySelector<HTMLElement>(
      '[data-motion-layer-kind="side-scrim"]',
    )!

    expect(entrance.dataset.motionEntryDirection).toBe('forward')
    expect(chair.dataset.motionEntryDirection).toBe('left')
    expect(craft.dataset.motionEntryDirection).toBe('right')
    expect(range.dataset.motionEntryDirection).toBe('centre')

    const chairSceneTransition = timeline.fromTo.mock.calls.find(([target]) => target === chair)
    expect(chairSceneTransition).toBeUndefined()
    const entranceHardCut = timeline.set.mock.calls.find(
      ([target, state]) => target === entrance && state.autoAlpha === 0,
    )
    const chairHardCut = timeline.set.mock.calls.find(
      ([target, state]) => target === chair && state.autoAlpha === 1,
    )
    expect(entranceHardCut?.[1]).toMatchObject({
      autoAlpha: 0,
      pointerEvents: 'none',
      xPercent: 0,
    })
    expect(entranceHardCut?.[2]).toBe(0.28)
    expect(chairHardCut?.[1]).toMatchObject({
      autoAlpha: 1,
      pointerEvents: 'auto',
      scale: 1,
      xPercent: 0,
    })
    expect(chairHardCut?.[2]).toBe(0.28)

    const chairMediaTransition = timeline.fromTo.mock.calls.find(
      ([target]) => target === chairMediaLayer,
    )
    const chairScrimTransition = timeline.fromTo.mock.calls.find(
      ([target]) => target === chairSideScrim,
    )
    expect(chairMediaTransition?.[1]).toMatchObject({
      x: -9,
      y: 0,
      z: 12,
      rotationY: -2,
    })
    expect(chairMediaTransition?.[2]).toMatchObject({
      x: 6,
      y: -0.5,
      z: 15,
      rotationY: 2.5,
    })
    expect(chairScrimTransition?.[1].x).toBeCloseTo(-3.6)
    expect(chairScrimTransition?.[1].y).toBeCloseTo(0)
    expect(chairScrimTransition?.[1].z).toBeCloseTo(4.8)
    expect(chairScrimTransition?.[1].rotationY).toBeCloseTo(-0.8)
    expect(chairScrimTransition?.[2].x).toBeCloseTo(2.4)
    expect(chairScrimTransition?.[2].y).toBeCloseTo(-0.2)
    expect(chairScrimTransition?.[2].z).toBeCloseTo(6)
    expect(chairScrimTransition?.[2].rotationY).toBeCloseTo(1)
    expect(chairMediaTransition?.[2].duration).toBeCloseTo(0.15)
    expect(chairMediaTransition?.[3]).toBe(0.28)
    expect(chairMediaTransition?.[1]).not.toEqual(chairScrimTransition?.[1])
  })

  it('keeps every compact media owner visible inside the three mobile phases', async () => {
    Object.defineProperty(compactQuery, 'matches', { configurable: true, value: true })
    const experience = await renderExperience()
    const timeline = gsapHarness.timelines[0]!
    const businessPanel = experience.querySelector<HTMLElement>('[data-motion-business-panel]')!
    const chair = experience.querySelector<HTMLElement>('[data-motion-scene="chair"]')!
    const sceneTransitions = timeline.fromTo.mock.calls.filter(
      ([target]) => target instanceof HTMLElement && target.hasAttribute('data-motion-scene'),
    )
    const layerTransitions = timeline.fromTo.mock.calls.filter(
      ([target]) => target instanceof HTMLElement && target.hasAttribute('data-motion-layer'),
    )
    const panelMoves = timeline.to.mock.calls.filter(([target]) => target === businessPanel)

    expect(gsapHarness.timelines).toHaveLength(1)
    expect(gsapHarness.triggers).toHaveLength(1)
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 1023px)')
    expect(sceneTransitions.map(([target]) => (target as HTMLElement).dataset.motionScene)).toEqual(
      ['entrance', 'craft', 'range', 'return', 'mirror', 'team'],
    )
    expect(
      timeline.set.mock.calls.find(
        ([target, state, at]) => target === chair && state.autoAlpha === 1 && at === 0.28,
      ),
    ).toBeDefined()
    expect(layerTransitions.length).toBeGreaterThan(0)
    for (const [, entryState, stableState] of sceneTransitions) {
      expect(entryState.xPercent).toBe(0)
      expect(entryState.scale).toBeLessThanOrEqual(1.02)
      expect(stableState.xPercent).toBe(0)
    }
    for (const [, fromState, toState] of layerTransitions) {
      expect(fromState).toMatchObject({ rotationY: 0, x: 0 })
      expect(toState).toMatchObject({ rotationY: 0, x: 0 })
      expect(Math.abs(fromState.z)).toBeLessThanOrEqual(7.5)
      expect(Math.abs(toState.z)).toBeLessThanOrEqual(7.5)
    }
    expect(panelMoves).toHaveLength(1)
    expect(panelMoves[0]?.[1]).toMatchObject({
      autoAlpha: 0,
      pointerEvents: 'none',
      xPercent: 0,
      scale: 1,
    })
  })

  it('rebuilds transactionally across the compact breakpoint without duplicate owners', async () => {
    Object.defineProperty(compactQuery, 'matches', { configurable: true, value: true })
    const experience = await renderExperience()
    const compactTimeline = gsapHarness.timelines[0]!
    const compactTrigger = gsapHarness.triggers[0]!
    const compactContext = gsapHarness.contexts[0]!
    const compactMedia = mediaHarness.controllers[0]!

    await act(async () => compactQuery.emit(false))
    expect(gsapHarness.timelines).toHaveLength(1)
    expect(gsapHarness.triggers).toHaveLength(1)
    await act(async () => frameHarness.flush())
    await act(async () => frameHarness.flush())

    expect(gsapHarness.timelines).toHaveLength(2)
    expect(gsapHarness.triggers).toHaveLength(2)
    expect(gsapHarness.contexts).toHaveLength(2)
    expect(mediaHarness.controllers).toHaveLength(2)
    expect(compactTimeline.killed).toBe(true)
    expect(compactTrigger.killed).toBe(true)
    expect(compactContext.reverted).toBe(true)
    expect(compactMedia.destroy).toHaveBeenCalledOnce()
    expect(gsapHarness.timelines.filter((timeline) => !timeline.killed)).toHaveLength(1)
    expect(gsapHarness.triggers.filter((trigger) => !trigger.killed)).toHaveLength(1)

    const desktopTimeline = gsapHarness.timelines[1]!
    const chair = experience.querySelector<HTMLElement>('[data-motion-scene="chair"]')!
    const chairTransition = desktopTimeline.fromTo.mock.calls.find(([target]) => target === chair)
    expect(chairTransition).toBeUndefined()
    expect(
      desktopTimeline.set.mock.calls.find(
        ([target, state, at]) => target === chair && state.autoAlpha === 1 && at === 0.28,
      )?.[1],
    ).toMatchObject({ xPercent: 0 })

    await act(async () => root?.unmount())
    root = null
    expect(compactQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(gsapHarness.timelines.filter((timeline) => !timeline.killed)).toHaveLength(0)
    expect(gsapHarness.triggers.filter((trigger) => !trigger.killed)).toHaveLength(0)
  })

  it.each([
    ['compact to desktop', true, false],
    ['desktop to compact', false, true],
  ] as const)(
    'lets the latest viewport own a pending two-frame preparation: %s',
    async (_label, initialCompact, finalCompact) => {
      Object.defineProperty(compactQuery, 'matches', {
        configurable: true,
        value: initialCompact,
      })
      applyFreshCutMotionPrepaintCapability()
      const experience = (
        <FreshCutMotionExperience bookingControl={<a href={BOOKING_HREF}>Boka nu</a>}>
          {completeExperience()}
        </FreshCutMotionExperience>
      )
      await act(async () => {
        root?.render(experience)
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })

      const experienceRoot = container.querySelector<HTMLElement>('[data-motion-mode]')!
      expect(experienceRoot.dataset.motionMode).toBe('preparing')
      expect(gsapHarness.timelines).toHaveLength(0)
      await act(async () => frameHarness.flush())
      expect(frameHarness.pendingCount).toBe(1)

      await act(async () => compactQuery.emit(finalCompact))
      await act(async () => frameHarness.flush())

      expect(experienceRoot.dataset.motionMode).toBe('enhanced')
      expect(gsapHarness.timelines).toHaveLength(1)
      expect(gsapHarness.triggers).toHaveLength(1)
      expect(gsapHarness.contexts).toHaveLength(1)
      expect(mediaHarness.controllers).toHaveLength(1)

      const sceneTransitions = gsapHarness.timelines[0]!.fromTo.mock.calls.filter(
        ([target]) => target instanceof HTMLElement && target.hasAttribute('data-motion-scene'),
      )
      const transitionedScenes = sceneTransitions.map(
        ([target]) => (target as HTMLElement).dataset.motionScene,
      )
      expect(transitionedScenes).toEqual(['entrance', 'craft', 'range', 'return', 'mirror', 'team'])
      const chair = experienceRoot.querySelector<HTMLElement>('[data-motion-scene="chair"]')!
      expect(
        gsapHarness.timelines[0]!.set.mock.calls.find(
          ([target, state, at]) => target === chair && state.autoAlpha === 1 && at === 0.28,
        )?.[1],
      ).toMatchObject({ xPercent: 0 })
    },
  )

  it('withdraws and repositions the same business panel inside the master timeline', async () => {
    const experience = await renderExperience()
    const timeline = gsapHarness.timelines[0]!
    const businessPanel = experience.querySelector<HTMLElement>('[data-motion-business-panel]')!
    const panelSets = timeline.set.mock.calls.filter(([target]) => target === businessPanel)
    const panelMoves = timeline.to.mock.calls.filter(([target]) => target === businessPanel)

    expect(experience.querySelectorAll('[data-motion-business-panel]')).toHaveLength(1)
    expect(panelSets).toContainEqual([
      businessPanel,
      expect.objectContaining({ autoAlpha: 1, xPercent: 0, scale: 1 }),
      0,
    ])
    expect(panelMoves).toHaveLength(3)
    const [, withdrawState, withdrawStart] = panelMoves[0]!
    const [, mirrorState, mirrorStart] = panelMoves[1]!
    const [, teamState, teamStart] = panelMoves[2]!
    expect(withdrawState).toMatchObject({
      autoAlpha: 0,
      duration: 0.04,
      pointerEvents: 'none',
    })
    expect(withdrawStart + withdrawState.duration).toBeCloseTo(0.12)
    expect(mirrorState).toMatchObject({
      autoAlpha: 1,
      duration: 0.035,
      xPercent: 44,
      scale: 0.82,
    })
    expect(mirrorStart + mirrorState.duration).toBeCloseTo(0.88)
    expect(teamState).toMatchObject({
      autoAlpha: 1,
      duration: 0.025,
      xPercent: -28,
      scale: 0.78,
    })
    expect(teamStart + teamState.duration).toBeCloseTo(0.95)
  })

  it('feeds media from the existing ScrollTrigger and follows pause and cleanup lifecycle', async () => {
    const experience = await renderExperience()
    const stage = experience.querySelector<HTMLElement>('[data-motion-stage]')!
    const trigger = gsapHarness.triggers[0]!
    const media = mediaHarness.controllers[0]!
    const pause = experience.querySelector<HTMLButtonElement>('button[aria-pressed]')!

    expect(mediaHarness.controllers).toHaveLength(1)
    expect(media.root).toBe(stage)
    expect(media.scenes).toBe(FRESHCUT_MOTION_SCENES)

    await act(async () =>
      gsapHarness.emitProgress(trigger, 0.3, {
        direction: 1,
        isActive: true,
        velocity: 400,
      }),
    )
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'chair',
      progress: 0.3,
      direction: 1,
      visible: true,
      paused: false,
      fast: false,
      checkpoint: false,
    })

    expect(trigger.config.onToggle).toEqual(expect.any(Function))
    trigger.isActive = false
    await act(async () => trigger.config.onToggle?.(trigger))
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'chair',
      progress: 0.3,
      direction: 1,
      visible: false,
      paused: false,
      fast: false,
      checkpoint: false,
    })

    await act(async () => pause.click())
    expect(media.setPaused).toHaveBeenLastCalledWith(true)

    await act(async () =>
      gsapHarness.emitProgress(trigger, 0.45, {
        direction: -1,
        isActive: true,
        velocity: 2800,
      }),
    )
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'craft',
      progress: 0.45,
      direction: -1,
      visible: true,
      paused: true,
      fast: true,
      checkpoint: false,
    })

    await act(async () => pause.click())
    expect(media.setPaused).toHaveBeenLastCalledWith(false)

    await act(async () => root?.unmount())
    root = null
    expect(media.destroy).toHaveBeenCalledOnce()
  })

  it('scrolls a direct checkpoint to its stable state and focuses after ScrollTrigger updates', async () => {
    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    trigger.start = 101
    trigger.end = 1181
    const timeline = gsapHarness.timelines[0]!
    const media = mediaHarness.controllers[0]!
    const mirrorHeading = experience.querySelector<HTMLElement>('#motion-scene-mirror-title')!
    const focus = vi.spyOn(mirrorHeading, 'focus')
    const mirrorLink = experience.querySelector<HTMLAnchorElement>(
      'nav a[href="#motion-scene-mirror"]',
    )!

    await act(async () => mirrorLink.click())

    expect(window.location.hash).toBe('#motion-scene-mirror')
    expect(window.scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 1052 })
    expect(timeline.progressValue).toBe(0.88)
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'mirror',
      progress: 0.88,
      direction: 1,
      visible: true,
      paused: false,
      fast: true,
      checkpoint: true,
    })
    expect(experience.dataset.motionScene).toBe('hero')
    expect(focus).not.toHaveBeenCalled()

    await act(async () => gsapHarness.emitProgress(trigger, 0.88))

    expect(experience.dataset.motionScene).toBe('mirror')
    expect(document.activeElement).toBe(mirrorHeading)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('delegates a manifest anchor inside the business panel to the same stable jump owner', async () => {
    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    const timeline = gsapHarness.timelines[0]!
    const media = mediaHarness.controllers[0]!
    const entranceHeading = experience.querySelector<HTMLElement>('#motion-scene-entrance-title')!
    const entranceLink = experience.querySelector<HTMLAnchorElement>(
      '[data-motion-business-panel] a[href="#motion-scene-entrance"]',
    )!

    await act(async () => entranceLink.click())

    expect(window.location.hash).toBe('#motion-scene-entrance')
    expect(window.scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 545 })
    expect(timeline.progressValue).toBe(0.12)
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'entrance',
      progress: 0.12,
      direction: 1,
      visible: true,
      paused: false,
      fast: true,
      checkpoint: true,
    })

    await act(async () => gsapHarness.emitProgress(trigger, 0.12))

    expect(experience.dataset.motionScene).toBe('entrance')
    expect(
      experience
        .querySelector('nav a[href="#motion-scene-entrance"]')
        ?.getAttribute('aria-current'),
    ).toBe('step')
    expect(document.activeElement).toBe(entranceHeading)
  })

  it('keeps reverse direction while quantizing a backward direct checkpoint upward', async () => {
    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    trigger.start = 101
    trigger.end = 1181
    const timeline = gsapHarness.timelines[0]!
    const media = mediaHarness.controllers[0]!
    const craftLink = experience.querySelector<HTMLAnchorElement>(
      'nav a[href="#motion-scene-craft"]',
    )!

    await act(async () => gsapHarness.emitProgress(trigger, 0.9))
    await act(async () => craftLink.click())

    expect(window.scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 566 })
    expect(timeline.progressValue).toBe(0.43)
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'craft',
      progress: 0.43,
      direction: -1,
      visible: true,
      paused: false,
      fast: true,
      checkpoint: true,
    })
  })

  it('moves a paused checkpoint to its stable visual and media state without resuming', async () => {
    const experience = await renderExperience()
    const trigger = gsapHarness.triggers[0]!
    const timeline = gsapHarness.timelines[0]!
    const media = mediaHarness.controllers[0]!
    const pause = experience.querySelector<HTMLButtonElement>('button[aria-pressed]')!
    const mirrorHeading = experience.querySelector<HTMLElement>('#motion-scene-mirror-title')!
    const focus = vi.spyOn(mirrorHeading, 'focus')
    const mirrorLink = experience.querySelector<HTMLAnchorElement>(
      'nav a[href="#motion-scene-mirror"]',
    )!

    await act(async () => gsapHarness.emitProgress(trigger, 0.45))
    await act(async () => pause.click())
    await act(async () => mirrorLink.click())

    expect(experience.dataset.motionPaused).toBe('true')
    expect(timeline.progressValue).toBe(0.88)
    expect(experience.style.getPropertyValue('--motion-visual-progress')).toBe('0.88')
    expect(media.sync).toHaveBeenLastCalledWith({
      sceneId: 'mirror',
      progress: 0.88,
      direction: 1,
      visible: true,
      paused: true,
      fast: true,
      checkpoint: true,
    })
    expect(focus).not.toHaveBeenCalled()

    await act(async () => gsapHarness.emitProgress(trigger, 0.88))

    expect(experience.dataset.motionScene).toBe('mirror')
    expect(experience.dataset.motionPaused).toBe('true')
    expect(timeline.progressValue).toBe(0.88)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('keeps one active owner in StrictMode and kills every GSAP resource on cleanup', async () => {
    await renderExperience(true)
    await vi.waitFor(() => expect(gsapHarness.contexts).toHaveLength(1))
    await act(async () => undefined)

    expect(gsapHarness.timelines).toHaveLength(1)
    expect(gsapHarness.triggers).toHaveLength(1)
    expect(gsapHarness.contexts).toHaveLength(1)
    expect(mediaHarness.controllers).toHaveLength(1)
    expect(gsapHarness.timelines.filter((timeline) => !timeline.killed)).toHaveLength(1)
    expect(gsapHarness.triggers.filter((trigger) => !trigger.killed)).toHaveLength(1)

    await act(async () => root?.unmount())
    root = null

    expect(gsapHarness.timelines[0]!.killed).toBe(true)
    expect(gsapHarness.triggers[0]!.killed).toBe(true)
    expect(gsapHarness.contexts[0]!.reverted).toBe(true)
    expect(mediaHarness.controllers[0]!.destroy).toHaveBeenCalledOnce()
    expect(gsapHarness.timelines.filter((timeline) => !timeline.killed)).toHaveLength(0)
    expect(gsapHarness.triggers.filter((trigger) => !trigger.killed)).toHaveLength(0)
  })
})

describe('FreshCut motion experience test isolation', () => {
  it('leaves every overwritten global descriptor at its file-entry sentinel', () => {
    for (const { descriptor, key, target } of experienceOriginalDescriptors) {
      expect(Object.getOwnPropertyDescriptor(target, key), String(key)).toEqual(descriptor)
    }
  })
})
