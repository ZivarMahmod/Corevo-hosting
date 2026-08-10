import {
  type FreshCutMotionScene,
  type FreshCutMotionSceneId,
  validatedFreshCutMotionVideoSources,
} from './freshcut-motion-scenes'

export type MotionMediaCommand = {
  sceneId: FreshCutMotionSceneId
  progress: number
  direction: 1 | -1
  visible: boolean
  paused: boolean
  fast: boolean
  checkpoint: boolean
}

export type FreshCutMotionMediaController = {
  sync(command: MotionMediaCommand): void
  setPaused(paused: boolean): void
  destroy(): void
}

type MediaControllerOptions = {
  loadingTimeoutMs?: number
}

type MediaPreload = 'auto' | 'metadata' | 'none'

type MediaRecord = {
  element: HTMLVideoElement
  sources: readonly HTMLSourceElement[]
  scene: FreshCutMotionScene
  removeSelectionListeners: () => void
  hasLoadedSelection: boolean
  loadingTimer: ReturnType<typeof setTimeout> | null
  preload: MediaPreload
  selectionEpoch: number
  playEpoch: number
  pendingPosition:
    | { kind: 'stable'; endpoint: 'start' | 'end' }
    | { kind: 'scrub'; progress: number }
    | null
}

const DEFAULT_LOADING_TIMEOUT_MS = 8_000
const OWNED_MEDIA_VALUE = 'freshcut-controller'
const HAVE_CURRENT_DATA = 2

function setMediaState(
  record: MediaRecord,
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'stable' | 'fallback',
) {
  record.element.dataset.motionMediaState = state
}

function mediaType(source: string): 'video/mp4' | 'video/webm' {
  return source.endsWith('.webm') ? 'video/webm' : 'video/mp4'
}

function appendSource(
  element: HTMLVideoElement,
  sourceUrl: string,
  media: string,
): HTMLSourceElement {
  const source = document.createElement('source')
  source.dataset.motionMediaSrc = sourceUrl
  source.media = media
  source.type = mediaType(sourceUrl)
  element.append(source)
  return source
}

function safeLoad(element: HTMLVideoElement): boolean {
  try {
    element.load()
    return true
  } catch {
    return false
  }
}

export function createFreshCutMotionMediaController(
  root: HTMLElement,
  scenes: readonly FreshCutMotionScene[],
  options: MediaControllerOptions = {},
): FreshCutMotionMediaController {
  const records = new Map<FreshCutMotionSceneId, MediaRecord>()
  const loadingTimeoutMs = options.loadingTimeoutMs ?? DEFAULT_LOADING_TIMEOUT_MS
  let destroyed = false
  let userPaused = false
  let pageHidden = document.hidden
  let activeSceneId: FreshCutMotionSceneId | null = null
  let playedEntry: FreshCutMotionSceneId | null = null
  let lastCommand: MotionMediaCommand | null = null

  const clearLoadingTimer = (record: MediaRecord) => {
    if (record.loadingTimer === null) return
    clearTimeout(record.loadingTimer)
    record.loadingTimer = null
  }

  const setCurrentTime = (element: HTMLVideoElement, currentTime: number): boolean => {
    try {
      element.currentTime = currentTime
      return true
    } catch {
      return false
    }
  }

  const showPoster = (record: MediaRecord) => {
    record.pendingPosition = null
    record.element.loop = false
    setCurrentTime(record.element, 0)
    record.element.dataset.motionMediaFrame = 'poster'
  }

  const applyStablePosition = (record: MediaRecord, endpoint: 'start' | 'end') => {
    const frame =
      endpoint === 'start' ? record.scene.media.stableStart : record.scene.media.stableEnd
    record.pendingPosition = null
    record.element.loop = false

    if (frame === 'poster') {
      showPoster(record)
      return
    }

    if (frame === 'first-frame') {
      if (!setCurrentTime(record.element, 0)) showPoster(record)
      else record.element.dataset.motionMediaFrame = 'start'
      return
    }

    const duration = record.element.duration
    if (!Number.isFinite(duration) || duration <= 0 || !setCurrentTime(record.element, duration)) {
      showPoster(record)
      record.pendingPosition = { kind: 'stable', endpoint }
      return
    }
    record.element.dataset.motionMediaFrame = 'end'
  }

  const applyScrubPosition = (record: MediaRecord, progress: number) => {
    const duration = record.element.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      applyStablePosition(record, 'start')
      record.pendingPosition = { kind: 'scrub', progress }
      return
    }

    const [start, end] = record.scene.range
    const localProgress = Math.min(1, Math.max(0, (progress - start) / (end - start)))
    record.pendingPosition = null
    record.element.loop = false
    if (!setCurrentTime(record.element, duration * localProgress)) {
      showPoster(record)
      record.pendingPosition = { kind: 'scrub', progress }
      return
    }
    record.element.dataset.motionMediaFrame = 'scrub'
  }

  const detachSources = (record: MediaRecord) => {
    for (const source of record.sources) source.removeAttribute('src')
  }

  const attachSources = (record: MediaRecord) => {
    for (const source of record.sources) {
      const sourceUrl = source.dataset.motionMediaSrc
      if (sourceUrl) source.setAttribute('src', sourceUrl)
    }
  }

  const selectionIsCurrent = (record: MediaRecord, selectionEpoch: number) =>
    !destroyed &&
    record.selectionEpoch === selectionEpoch &&
    record.preload !== 'none' &&
    record.element.dataset.motionMediaState !== 'fallback'

  const activateFallback = (record: MediaRecord, selectionEpoch = record.selectionEpoch) => {
    if (!selectionIsCurrent(record, selectionEpoch)) return
    clearLoadingTimer(record)
    record.selectionEpoch += 1
    record.playEpoch += 1
    record.removeSelectionListeners()
    record.removeSelectionListeners = () => {}
    record.element.pause()
    detachSources(record)
    showPoster(record)
    setMediaState(record, 'fallback')
    safeLoad(record.element)
  }

  const bindSelectionListeners = (record: MediaRecord, selectionEpoch: number) => {
    const { element } = record
    const handleLoaded = () => {
      if (!selectionIsCurrent(record, selectionEpoch) || element.readyState < HAVE_CURRENT_DATA) {
        return
      }
      clearLoadingTimer(record)
      element.dataset.motionMediaReady = 'true'
      const pendingPosition = record.pendingPosition
      if (pendingPosition?.kind === 'stable') {
        applyStablePosition(record, pendingPosition.endpoint)
      } else if (pendingPosition?.kind === 'scrub') {
        applyScrubPosition(record, pendingPosition.progress)
      }
      if (element.dataset.motionMediaState === 'loading') setMediaState(record, 'stable')
    }
    const handleError = () => {
      if (!selectionIsCurrent(record, selectionEpoch) || element.error === null) return
      activateFallback(record, selectionEpoch)
    }
    const handleEnded = () => {
      if (
        !selectionIsCurrent(record, selectionEpoch) ||
        !element.ended ||
        element.dataset.motionMediaState !== 'playing'
      ) {
        return
      }
      clearLoadingTimer(record)
      record.playEpoch += 1
      element.pause()
      applyStablePosition(record, 'end')
      setMediaState(record, 'stable')
    }

    element.addEventListener('loadeddata', handleLoaded)
    element.addEventListener('error', handleError)
    element.addEventListener('ended', handleEnded)
    record.removeSelectionListeners = () => {
      element.removeEventListener('loadeddata', handleLoaded)
      element.removeEventListener('error', handleError)
      element.removeEventListener('ended', handleEnded)
    }
  }

  const startLoadingTimer = (record: MediaRecord) => {
    if (record.loadingTimer !== null || record.element.dataset.motionMediaReady === 'true') return
    const selectionEpoch = record.selectionEpoch
    record.loadingTimer = setTimeout(() => {
      record.loadingTimer = null
      activateFallback(record, selectionEpoch)
    }, loadingTimeoutMs)
  }

  const updatePreload = (record: MediaRecord, preload: MediaPreload) => {
    if (record.preload === preload) return

    clearLoadingTimer(record)
    record.selectionEpoch += 1
    record.playEpoch += 1
    const selectionEpoch = record.selectionEpoch
    record.removeSelectionListeners()
    record.removeSelectionListeners = () => {}
    record.element.pause()
    record.element.loop = false
    record.pendingPosition = null
    delete record.element.dataset.motionMediaReady
    record.element.dataset.motionMediaFrame = 'poster'
    record.element.preload = preload
    record.preload = preload

    if (preload === 'none') {
      detachSources(record)
    } else {
      attachSources(record)
      bindSelectionListeners(record, selectionEpoch)
    }

    setMediaState(record, preload === 'none' ? 'idle' : 'loading')
    record.hasLoadedSelection = true
    if (!safeLoad(record.element)) activateFallback(record, selectionEpoch)
  }

  for (const scene of scenes) {
    const validatedSources = validatedFreshCutMotionVideoSources(scene.media, scene.id)
    if (!validatedSources) continue

    const host = root.querySelector<HTMLElement>(`[data-motion-media-host="${scene.id}"]`)
    if (!host) continue

    const element = document.createElement('video')
    const className = host.dataset.motionMediaClass
    if (className) element.className = className
    element.dataset.motionMediaOwned = OWNED_MEDIA_VALUE
    element.dataset.motionMediaScene = scene.id
    element.dataset.motionMediaFrame = 'poster'
    element.dataset.motionMediaState = 'idle'
    element.poster = scene.media.poster
    element.preload = 'none'
    element.muted = true
    element.playsInline = true
    element.loop = false

    const sources = [
      appendSource(element, validatedSources.mobileWebm, '(max-width: 1023px)'),
      appendSource(element, validatedSources.mobileMp4, '(max-width: 1023px)'),
      appendSource(element, validatedSources.desktopWebm, '(min-width: 1024px)'),
      appendSource(element, validatedSources.desktopMp4, '(min-width: 1024px)'),
    ]
    host.append(element)

    records.set(scene.id, {
      element,
      sources,
      scene,
      hasLoadedSelection: false,
      loadingTimer: null,
      pendingPosition: null,
      preload: 'none',
      selectionEpoch: 0,
      playEpoch: 0,
      removeSelectionListeners: () => {},
    })
  }

  const pauseRecord = (record: MediaRecord, state: 'idle' | 'paused' | 'stable' = 'paused') => {
    clearLoadingTimer(record)
    record.playEpoch += 1
    record.element.pause()
    record.element.loop = false
    if (record.element.dataset.motionMediaState !== 'fallback') setMediaState(record, state)
  }

  const resolveStableRecord = (record: MediaRecord, endpoint: 'start' | 'end') => {
    pauseRecord(record, 'stable')
    applyStablePosition(record, endpoint)
  }

  const scrubRecord = (record: MediaRecord, progress: number) => {
    record.playEpoch += 1
    record.element.pause()
    record.element.loop = false
    if (record.element.dataset.motionMediaReady === 'true') setMediaState(record, 'stable')
    else {
      setMediaState(record, 'loading')
      startLoadingTimer(record)
    }
    applyScrubPosition(record, progress)
  }

  const playRecord = (record: MediaRecord, restart: boolean) => {
    if (record.element.dataset.motionMediaState === 'fallback') return
    record.pendingPosition = null
    if (restart) applyStablePosition(record, 'start')
    const loops = record.scene.media.forward === 'micro-loop'
    record.element.loop = loops
    record.element.dataset.motionMediaFrame = loops ? 'loop' : 'action'
    setMediaState(record, 'playing')
    startLoadingTimer(record)
    const selectionEpoch = record.selectionEpoch
    const playEpoch = ++record.playEpoch
    void record.element.play().catch(() => {
      if (
        selectionIsCurrent(record, selectionEpoch) &&
        record.playEpoch === playEpoch &&
        record.element.dataset.motionMediaState === 'playing'
      ) {
        activateFallback(record, selectionEpoch)
      }
    })
  }

  const resolvePreload = (
    record: MediaRecord,
    recordIndex: number,
    activeIndex: number,
    visible: boolean,
    direction: 1 | -1,
  ): MediaPreload => {
    if (!visible || pageHidden || activeIndex < 0) return 'none'
    if (recordIndex === activeIndex || record.scene.media.preload === 'eager') return 'auto'
    if (
      record.scene.media.preload === 'active-and-next' &&
      recordIndex === activeIndex + direction
    ) {
      return 'auto'
    }
    if (record.scene.media.preload === 'nearby' && Math.abs(recordIndex - activeIndex) === 1) {
      return 'metadata'
    }
    return 'none'
  }

  const applyCommand = (command: MotionMediaCommand, resume = false) => {
    if (destroyed) return
    lastCommand = command

    const sceneIndex = scenes.findIndex((scene) => scene.id === command.sceneId)
    const visible = command.visible && !pageHidden
    for (const [recordSceneId, record] of records) {
      const recordIndex = scenes.findIndex((scene) => scene.id === recordSceneId)
      updatePreload(
        record,
        resolvePreload(record, recordIndex, sceneIndex, visible, command.direction),
      )
      if (recordSceneId !== command.sceneId) pauseRecord(record, 'idle')
    }

    const record = records.get(command.sceneId)
    if (!record) {
      activeSceneId = command.sceneId
      playedEntry = null
      return
    }

    const enteredScene = activeSceneId !== command.sceneId
    if (enteredScene) {
      activeSceneId = command.sceneId
      playedEntry = null
    }

    if (!visible) {
      pauseRecord(record)
      return
    }

    if (command.checkpoint) {
      playedEntry = command.sceneId
      resolveStableRecord(record, 'start')
      return
    }

    if (record.scene.media.forward === 'environment-scrub') {
      if (userPaused || command.paused) pauseRecord(record)
      else scrubRecord(record, command.progress)
      return
    }

    if (command.fast || command.direction < 0) {
      playedEntry = command.sceneId
      resolveStableRecord(record, 'end')
      return
    }

    if (userPaused || command.paused) {
      pauseRecord(record)
      return
    }

    const shouldPlay =
      record.scene.media.forward === 'play-on-entry' || record.scene.media.forward === 'micro-loop'
    if (!shouldPlay) {
      playedEntry = command.sceneId
      resolveStableRecord(record, 'start')
      return
    }

    if (resume || enteredScene || playedEntry !== command.sceneId) {
      const restart = !resume && playedEntry !== command.sceneId
      playedEntry = command.sceneId
      playRecord(record, restart)
      return
    }

    if (record.element.dataset.motionMediaState === 'paused') playRecord(record, false)
  }

  const handleVisibilityChange = () => {
    if (destroyed) return
    pageHidden = document.hidden
    if (lastCommand) applyCommand(lastCommand, !pageHidden)
    else if (pageHidden) {
      for (const record of records.values()) {
        updatePreload(record, 'none')
        pauseRecord(record)
      }
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return {
    sync(command) {
      applyCommand(command)
    },
    setPaused(paused) {
      if (destroyed || userPaused === paused) return
      userPaused = paused
      if (paused) {
        const record = activeSceneId ? records.get(activeSceneId) : undefined
        if (record) pauseRecord(record)
        return
      }
      if (lastCommand) applyCommand(lastCommand, true)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      for (const record of records.values()) {
        clearLoadingTimer(record)
        record.selectionEpoch += 1
        record.playEpoch += 1
        record.removeSelectionListeners()
        record.element.pause()
        record.element.loop = false
        record.element.preload = 'none'
        detachSources(record)
        if (record.hasLoadedSelection) safeLoad(record.element)
        record.element.remove()
      }
      records.clear()
      lastCommand = null
    },
  }
}
