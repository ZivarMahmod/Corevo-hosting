/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFreshCutMotionMediaController,
  type MotionMediaCommand,
} from './FreshCutMotionMediaController'
import {
  FRESHCUT_MOTION_SCENES,
  type FreshCutMotionScene,
  type FreshCutMotionSceneId,
} from './freshcut-motion-scenes'

type VideoRecord = {
  element: HTMLVideoElement
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

const FAMILY_HASH = 'a1b2c3d4e5f6'

let root: HTMLElement
let loadCounts: WeakMap<HTMLMediaElement, number>
let hiddenDescriptor: PropertyDescriptor | undefined

function approvedScene(scene: FreshCutMotionScene): FreshCutMotionScene {
  const family = `${scene.id}-v1-${FAMILY_HASH}`
  const base = `/media/freshcut-motion/${family}/${family}`
  return {
    ...scene,
    media: {
      ...scene.media,
      poster: `${base}-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      desktopMp4: `${base}-desktop.mp4`,
      mobileWebm: `${base}-mobile.webm`,
      mobileMp4: `${base}-mobile.mp4`,
      sourceStatus: 'approved-final',
      rightsStatus: 'approved-for-ai-transformation',
    },
  } as FreshCutMotionScene
}

function approvedScenes(): readonly FreshCutMotionScene[] {
  return FRESHCUT_MOTION_SCENES.map((scene) => approvedScene(scene))
}

function generatedDemoScene(scene: FreshCutMotionScene): FreshCutMotionScene {
  const family = `${scene.id}-v1-${FAMILY_HASH}`
  const base = `/media/freshcut-motion/${family}/${family}`
  return {
    ...scene,
    media: {
      ...scene.media,
      poster: `${base}-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      desktopMp4: `${base}-desktop.mp4`,
      mobileWebm: `${base}-mobile.webm`,
      mobileMp4: `${base}-mobile.mp4`,
      sourceStatus: 'generated-demo',
      rightsStatus: 'synthetic-text-only',
    },
  } as unknown as FreshCutMotionScene
}

function command(
  sceneId: MotionMediaCommand['sceneId'],
  overrides: Partial<MotionMediaCommand> = {},
): MotionMediaCommand {
  return {
    sceneId,
    progress: 0,
    direction: 1,
    visible: true,
    paused: false,
    fast: false,
    checkpoint: false,
    ...overrides,
  }
}

function setDuration(element: HTMLVideoElement, duration: number): void {
  Object.defineProperty(element, 'duration', { configurable: true, value: duration })
}

function setReadyState(element: HTMLVideoElement, readyState: number): void {
  Object.defineProperty(element, 'readyState', { configurable: true, value: readyState })
}

function setMediaError(element: HTMLVideoElement): void {
  Object.defineProperty(element, 'error', {
    configurable: true,
    value: { code: 3, message: 'decode failed' },
  })
}

function mediaHost(sceneId: FreshCutMotionSceneId): HTMLElement {
  return root.querySelector<HTMLElement>(`[data-motion-media-host="${sceneId}"]`)!
}

function videoRecord(sceneId: FreshCutMotionSceneId): VideoRecord {
  const element = mediaHost(sceneId).querySelector<HTMLVideoElement>(
    `video[data-motion-media-scene="${sceneId}"]`,
  )
  expect(element, `controller-owned video for ${sceneId}`).not.toBeNull()
  if (!element) throw new Error(`controller-owned video for ${sceneId} is missing`)
  const play = vi.fn(() => Promise.resolve())
  const pause = vi.fn()
  Object.defineProperty(element, 'play', { configurable: true, value: play })
  Object.defineProperty(element, 'pause', { configurable: true, value: pause })
  return { element, play, pause }
}

function sourceUrls(element: HTMLVideoElement): Array<string | null> {
  return Array.from(element.querySelectorAll('source')).map((source) => source.getAttribute('src'))
}

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('FreshCutMotionMediaController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    loadCounts = new WeakMap()
    hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')

    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function () {
      loadCounts.set(this, (loadCounts.get(this) ?? 0) + 1)
    })

    for (const scene of FRESHCUT_MOTION_SCENES) {
      const host = document.createElement('div')
      host.dataset.motionMediaHost = scene.id
      root.append(host)
    }
  })

  afterEach(() => {
    if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor)
    else delete (document as Document & { hidden?: boolean }).hidden
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('materializes one owned video and four ordered sources only for approved cloned scenes', () => {
    const scenes = approvedScenes()
    const entrance = scenes.find((scene) => scene.id === 'entrance')!
    const controller = createFreshCutMotionMediaController(root, [entrance])
    const video = videoRecord('entrance').element
    const sources = Array.from(video.querySelectorAll('source'))

    expect(mediaHost('entrance').children).toHaveLength(1)
    expect(video.dataset.motionMediaOwned).toBe('freshcut-controller')
    expect(video.poster).toContain(entrance.media.poster)
    expect(sources).toHaveLength(4)
    expect(
      sources.map((source) => [
        source.media,
        source.type,
        source.dataset.motionMediaSrc,
        source.getAttribute('src'),
      ]),
    ).toEqual([
      ['(max-width: 1023px)', 'video/webm', entrance.media.mobileWebm, null],
      ['(max-width: 1023px)', 'video/mp4', entrance.media.mobileMp4, null],
      ['(min-width: 1024px)', 'video/webm', entrance.media.desktopWebm, null],
      ['(min-width: 1024px)', 'video/mp4', entrance.media.desktopMp4, null],
    ])
    expect(loadCounts.get(video)).toBeUndefined()

    controller.destroy()
    expect(mediaHost('entrance').querySelector('video')).toBeNull()
    expect(loadCounts.get(video)).toBeUndefined()
  })

  it('does not load or enter fallback before a preload policy selects sources', () => {
    const entrance = approvedScenes().find((scene) => scene.id === 'entrance')!
    const controller = createFreshCutMotionMediaController(root, [entrance])
    const video = videoRecord('entrance').element

    expect(video.preload).toBe('none')
    expect(sourceUrls(video)).toEqual([null, null, null, null])
    expect(loadCounts.get(video)).toBeUndefined()

    video.dispatchEvent(new Event('error'))
    video.dispatchEvent(new Event('loadeddata'))

    expect(video.dataset.motionMediaState).toBe('idle')
    expect(video.dataset.motionMediaReady).toBeUndefined()
    expect(loadCounts.get(video)).toBeUndefined()
    controller.destroy()
  })

  it('never materializes video or source elements for repository fallback scenes', () => {
    const controller = createFreshCutMotionMediaController(root, FRESHCUT_MOTION_SCENES)

    expect(root.querySelectorAll('video')).toHaveLength(0)
    expect(root.querySelectorAll('source')).toHaveLength(0)

    controller.sync(command('entrance'))
    expect(root.querySelectorAll('video')).toHaveLength(0)
  })

  it('materializes generated demo media only when its synthetic provenance pair is complete', () => {
    const entrance = generatedDemoScene(FRESHCUT_MOTION_SCENES[1])
    const controller = createFreshCutMotionMediaController(root, [entrance])

    expect(videoRecord('entrance').element.querySelectorAll('source')).toHaveLength(4)

    controller.destroy()
  })

  it('keeps eager media network-inert until the first explicit sync selects sources', () => {
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const scenes = approvedScenes()

    const controller = createFreshCutMotionMediaController(root, scenes)
    const hero = videoRecord('hero').element
    const entrance = videoRecord('entrance').element

    expect(hero.preload).toBe('none')
    expect(sourceUrls(hero)).toEqual([null, null, null, null])
    expect(loadCounts.get(hero)).toBeUndefined()
    expect(entrance.preload).toBe('none')
    expect(sourceUrls(entrance)).toEqual([null, null, null, null])

    controller.sync(command('hero'))

    expect(hero.preload).toBe('auto')
    expect(sourceUrls(hero).every(Boolean)).toBe(true)
    expect(loadCounts.get(hero)).toBe(1)
  })

  it('projects eager, directed next, and adjacent nearby preload policies from the manifest', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const videos = new Map(scenes.map((scene) => [scene.id, videoRecord(scene.id)] as const))

    controller.sync(command('chair', { progress: 0.3 }))

    expect(videos.get('hero')!.element.preload).toBe('auto')
    expect(videos.get('chair')!.element.preload).toBe('auto')
    expect(videos.get('craft')!.element.preload).toBe('auto')
    expect(videos.get('entrance')!.element.preload).toBe('none')
    expect(videos.get('range')!.element.preload).toBe('none')

    controller.sync(command('return', { progress: 0.8 }))

    expect(videos.get('hero')!.element.preload).toBe('auto')
    expect(videos.get('return')!.element.preload).toBe('auto')
    expect(videos.get('range')!.element.preload).toBe('metadata')
    expect(videos.get('mirror')!.element.preload).toBe('auto')
    expect(videos.get('craft')!.element.preload).toBe('none')
    expect(videos.get('team')!.element.preload).toBe('none')
  })

  it('warms the previous active-and-next scene while scrolling backward', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    const craft = videoRecord('craft')

    controller.sync(command('craft', { direction: -1, progress: 0.5 }))

    expect(craft.element.preload).toBe('auto')
    expect(chair.element.preload).toBe('auto')
  })

  it('loads exactly when preload changes and unloads every source while offscreen', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    const initialLoads = loadCounts.get(chair.element) ?? 0

    controller.sync(command('chair'))
    const activeLoads = loadCounts.get(chair.element) ?? 0
    expect(activeLoads).toBe(initialLoads + 1)
    expect(sourceUrls(chair.element).every(Boolean)).toBe(true)

    controller.sync(command('chair', { progress: 0.31 }))
    expect(loadCounts.get(chair.element)).toBe(activeLoads)

    controller.sync(command('chair', { visible: false }))
    expect(chair.element.preload).toBe('none')
    expect(sourceUrls(chair.element)).toEqual([null, null, null, null])
    expect(loadCounts.get(chair.element)).toBe(activeLoads + 1)
  })

  it('destroys and rebuilds owned media so the browser must select sources again', () => {
    const scenes = approvedScenes()
    const firstController = createFreshCutMotionMediaController(root, scenes)
    const firstVideo = videoRecord('entrance').element
    firstController.sync(command('entrance', { progress: 0.2 }))
    expect(sourceUrls(firstVideo).every(Boolean)).toBe(true)
    expect(loadCounts.get(firstVideo)).toBe(1)

    firstController.destroy()
    expect(mediaHost('entrance').querySelector('video')).toBeNull()
    expect(sourceUrls(firstVideo)).toEqual([null, null, null, null])
    expect(loadCounts.get(firstVideo)).toBe(2)

    const secondController = createFreshCutMotionMediaController(root, scenes)
    const secondVideo = videoRecord('entrance').element
    secondController.sync(command('entrance', { progress: 0.2 }))

    expect(secondVideo).not.toBe(firstVideo)
    expect(sourceUrls(secondVideo).every(Boolean)).toBe(true)
    expect(loadCounts.get(secondVideo)).toBe(1)
    secondController.destroy()
  })

  it('clears stale ready and fallback state when a source is unloaded and selected again', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const craft = videoRecord('craft')

    controller.sync(command('craft'))
    setReadyState(craft.element, 2)
    craft.element.dispatchEvent(new Event('loadeddata'))
    expect(craft.element.dataset.motionMediaReady).toBe('true')
    setMediaError(craft.element)
    craft.element.dispatchEvent(new Event('error'))
    expect(craft.element.dataset.motionMediaState).toBe('fallback')

    controller.sync(command('team'))
    controller.sync(command('craft'))

    expect(craft.element.dataset.motionMediaReady).toBeUndefined()
    expect(craft.element.dataset.motionMediaState).not.toBe('fallback')
  })

  it('ignores a delayed rejection from a play attempt invalidated by unload and re-entry', async () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    let rejectOldPlay: ((reason: Error) => void) | undefined
    setDuration(chair.element, 10)
    chair.play
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectOldPlay = reject
          }),
      )
      .mockResolvedValueOnce(undefined)

    controller.sync(command('chair'))
    controller.sync(command('craft'))
    controller.sync(command('chair'))
    chair.element.currentTime = 3
    rejectOldPlay?.(new Error('old play rejected late'))
    await Promise.resolve()
    await Promise.resolve()

    expect(chair.element.dataset.motionMediaState).toBe('playing')
    expect(chair.element.currentTime).toBe(3)
    expect(sourceUrls(chair.element).every(Boolean)).toBe(true)
  })

  it('ignores the previous selection callbacks even when the current element satisfies them', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    const addEventListener = vi.spyOn(chair.element, 'addEventListener')
    setDuration(chair.element, 10)

    controller.sync(command('chair'))
    const oldListeners = new Map(
      addEventListener.mock.calls.flatMap(([type, listener]) =>
        typeof listener === 'function' && ['loadeddata', 'error', 'ended'].includes(type)
          ? [[type, listener] as const]
          : [],
      ),
    )
    const invokeOldListener = (type: 'loadeddata' | 'error' | 'ended') => {
      const listener = oldListeners.get(type)
      if (!listener) throw new Error(`Missing captured ${type} listener`)
      listener.call(chair.element, new Event(type))
    }

    controller.sync(command('craft'))
    controller.sync(command('chair'))
    setReadyState(chair.element, 2)
    setMediaError(chair.element)
    Object.defineProperty(chair.element, 'ended', { configurable: true, value: true })
    chair.element.currentTime = 3
    chair.pause.mockClear()

    invokeOldListener('loadeddata')
    expect(chair.element.dataset.motionMediaReady).toBeUndefined()
    expect(chair.element.dataset.motionMediaState).toBe('playing')
    expect(chair.element.currentTime).toBe(3)
    expect(chair.pause).not.toHaveBeenCalled()

    invokeOldListener('error')
    expect(chair.element.dataset.motionMediaState).toBe('playing')
    expect(chair.element.dataset.motionMediaReady).toBeUndefined()
    expect(chair.element.currentTime).toBe(3)
    expect(chair.pause).not.toHaveBeenCalled()

    invokeOldListener('ended')
    expect(chair.element.dataset.motionMediaState).toBe('playing')
    expect(chair.element.dataset.motionMediaReady).toBeUndefined()
    expect(chair.element.currentTime).toBe(3)
    expect(chair.pause).not.toHaveBeenCalled()
  })

  it('plays forward human action once per entry and never reverses it', async () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    setDuration(chair.element, 10)

    controller.sync(command('chair', { progress: 0.3 }))
    controller.sync(command('chair', { progress: 0.35 }))
    await Promise.resolve()

    expect(chair.play).toHaveBeenCalledOnce()
    expect(chair.element.dataset.motionMediaState).toBe('playing')

    chair.element.currentTime = 4
    controller.sync(command('chair', { direction: -1, progress: 0.35 }))
    expect(chair.play).toHaveBeenCalledOnce()
    expect(chair.pause).toHaveBeenCalled()
    expect(chair.element.dataset.motionMediaState).toBe('stable')
    expect(chair.element.currentTime).toBe(10)
    expect(chair.element.dataset.motionMediaFrame).toBe('end')
  })

  it('restarts a forward human action from its stable start on a real re-entry', async () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    const craft = videoRecord('craft')
    setDuration(chair.element, 10)
    setDuration(craft.element, 10)

    chair.element.currentTime = 6
    controller.sync(command('chair', { progress: 0.3 }))
    await Promise.resolve()
    expect(chair.element.currentTime).toBe(0)

    controller.sync(command('craft', { checkpoint: true, fast: true, progress: 0.43 }))
    chair.element.currentTime = 10
    controller.sync(command('chair', { progress: 0.3 }))
    await Promise.resolve()

    expect(chair.play).toHaveBeenCalledTimes(2)
    expect(chair.element.currentTime).toBe(0)
    expect(chair.element.loop).toBe(false)
  })

  it('scrubs environment media without playback and times out while active loading', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes, {
      loadingTimeoutMs: 500,
    })
    const entrance = videoRecord('entrance')
    setDuration(entrance.element, 16)

    controller.sync(command('entrance', { progress: 0.2 }))
    expect(entrance.play).not.toHaveBeenCalled()
    expect(entrance.element.currentTime).toBeCloseTo(8, 5)
    expect(entrance.element.dataset.motionMediaFrame).toBe('scrub')

    vi.advanceTimersByTime(500)
    expect(entrance.element.dataset.motionMediaState).toBe('fallback')
    expect(entrance.element.dataset.motionMediaFrame).toBe('poster')
  })

  it('pauses and unloads on document hide, then restores the latest visible command', async () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes)
    const chair = videoRecord('chair')
    setDuration(chair.element, 10)

    controller.sync(command('chair'))
    await Promise.resolve()
    expect(chair.play).toHaveBeenCalledOnce()

    setDocumentHidden(true)
    expect(chair.pause).toHaveBeenCalled()
    expect(chair.element.preload).toBe('none')
    expect(sourceUrls(chair.element)).toEqual([null, null, null, null])

    setDocumentHidden(false)
    await Promise.resolve()
    expect(chair.element.preload).toBe('auto')
    expect(sourceUrls(chair.element).every(Boolean)).toBe(true)
    expect(chair.play).toHaveBeenCalledTimes(2)
  })

  it('falls back on playback rejection, media errors, and loading timeout', async () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes, {
      loadingTimeoutMs: 500,
    })
    const chair = videoRecord('chair')
    const craft = videoRecord('craft')
    const mirror = videoRecord('mirror')
    setDuration(chair.element, 10)
    chair.play.mockImplementationOnce(() => Promise.reject(new Error('decode failed')))

    controller.sync(command('chair'))
    await Promise.resolve()
    await Promise.resolve()
    expect(chair.element.dataset.motionMediaState).toBe('fallback')

    controller.sync(command('craft'))
    setMediaError(craft.element)
    craft.element.dispatchEvent(new Event('error'))
    expect(craft.element.dataset.motionMediaState).toBe('fallback')

    controller.sync(command('mirror'))
    vi.advanceTimersByTime(500)
    expect(mirror.element.dataset.motionMediaState).toBe('fallback')
  })

  it('cleans up visibility listeners, timers, owned media, and later commands', () => {
    const scenes = approvedScenes()
    const controller = createFreshCutMotionMediaController(root, scenes, {
      loadingTimeoutMs: 500,
    })
    const chair = videoRecord('chair')
    controller.sync(command('chair'))
    controller.destroy()
    const loadsAfterDestroy = loadCounts.get(chair.element)

    setDocumentHidden(true)
    setDocumentHidden(false)
    controller.sync(command('craft'))
    vi.advanceTimersByTime(500)

    expect(root.querySelectorAll('video')).toHaveLength(0)
    expect(loadCounts.get(chair.element)).toBe(loadsAfterDestroy)
  })
})
