'use client'

import React, {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  FRESHCUT_MATCHED_CHAIR_HARD_CUT,
  FRESHCUT_MOTION_SCENES,
  motionMobilePhaseForScene,
  motionSceneForProgress,
  motionSceneTarget,
  motionScrollDistanceVh,
  type FreshCutMotionSceneId,
} from './freshcut-motion-scenes'
import {
  createFreshCutMotionMediaController,
  type FreshCutMotionMediaController,
  type MotionMediaCommand,
} from './FreshCutMotionMediaController'
import {
  claimFreshCutMotionPrepaintCapability,
  clearFreshCutMotionPrepaintCapability,
  getFreshCutMotionPrepaintDeadline,
  isFreshCutMotionRuntimeEligible,
  markFreshCutMotionPrepaintReady,
  releaseFreshCutMotionPrepaintCapability,
} from './freshcut-motion-capability'
import motion from './freshcut-motion.module.css'

type MotionMode = 'static' | 'preparing' | 'enhanced'

type MasterTimeline = {
  kill: () => unknown
  pause: () => unknown
  progress: (value: number) => unknown
}

type MasterScrollTrigger = {
  direction: number
  end: number
  getVelocity: () => number
  isActive: boolean
  kill: () => unknown
  progress: number
  start: number
}

type MotionContext = {
  revert: () => unknown
}

type MotionStyle = CSSProperties & {
  '--motion-progress': string
  '--motion-scroll-distance-desktop': string
  '--motion-scroll-distance-mobile': string
  '--motion-visual-progress': string
}

type MotionRuntime = {
  gsap: (typeof import('gsap'))['gsap']
  ScrollTrigger: (typeof import('gsap/ScrollTrigger'))['ScrollTrigger']
}

let motionRuntimePromise: Promise<MotionRuntime> | null = null

const FAST_SCROLL_VELOCITY = 2_000
const DESKTOP_VIEWPORT_MIN_WIDTH = 1024
const COMPACT_PARALLAX_FACTOR = 0.25

function loadMotionRuntime(): Promise<MotionRuntime> {
  if (!motionRuntimePromise) {
    let pendingRuntime: Promise<MotionRuntime>
    pendingRuntime = Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => ({ gsap, ScrollTrigger }))
      .catch((error: unknown) => {
        if (motionRuntimePromise === pendingRuntime) motionRuntimePromise = null
        throw error
      })
    motionRuntimePromise = pendingRuntime
  }
  return motionRuntimePromise
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

type SceneEntryDirection = 'forward' | 'left' | 'right' | 'centre'

function sceneEntryDirection(
  scene: (typeof FRESHCUT_MOTION_SCENES)[number],
  previousScene: (typeof FRESHCUT_MOTION_SCENES)[number] | undefined,
): SceneEntryDirection {
  if (scene.camera.x < 0) return 'left'
  if (scene.camera.x > 0) return 'right'
  if (previousScene && scene.camera.z > previousScene.camera.z) return 'forward'
  return 'centre'
}

function sceneEntryState(direction: SceneEntryDirection, compact: boolean) {
  if (compact) return { xPercent: 0, scale: 1.02 }
  if (direction === 'left') return { xPercent: -12, scale: 1.015 }
  if (direction === 'right') return { xPercent: 12, scale: 1.015 }
  if (direction === 'forward') return { xPercent: 0, scale: 1.08 }
  return { xPercent: 0, scale: 1.015 }
}

function cameraState(camera: (typeof FRESHCUT_MOTION_SCENES)[number]['camera'], compact: boolean) {
  if (!compact) return camera
  return {
    rotationY: 0,
    x: 0,
    y: camera.y * COMPACT_PARALLAX_FACTOR,
    z: camera.z * COMPACT_PARALLAX_FACTOR,
  }
}

function cameraStateAtDepth(
  camera: (typeof FRESHCUT_MOTION_SCENES)[number]['camera'],
  compact: boolean,
  depthFactor: number,
) {
  const state = cameraState(camera, compact)
  const depth = Number.isFinite(depthFactor) ? Math.min(1, Math.max(0, depthFactor)) : 0
  return {
    rotationY: state.rotationY * depth,
    x: state.x * depth,
    y: state.y * depth,
    z: state.z * depth,
  }
}

function focusSceneHeading(sceneId: FreshCutMotionSceneId): void {
  const scene = FRESHCUT_MOTION_SCENES.find((candidate) => candidate.id === sceneId)
  if (!scene) return
  document.getElementById(scene.headingId)?.focus({ preventScroll: true })
}

export function motionScrollPositionForScene(
  rangeStart: number,
  rangeEnd: number,
  sceneId: FreshCutMotionSceneId,
): number {
  const start = Number.isFinite(rangeStart) ? rangeStart : 0
  const end = Number.isFinite(rangeEnd) ? rangeEnd : start
  const travel = Math.max(0, end - start)
  const target = start + travel * motionSceneTarget(sceneId)
  return sceneId === 'hero' || travel === 0 ? target : Math.min(end, Math.floor(target) + 1)
}

type FreshCutMotionExperienceProps = {
  bookingControl: ReactNode
  children: ReactNode
}

type StableSceneJumpOptions = {
  focusIfCurrent: boolean
  updateHash: boolean
}

export function FreshCutMotionExperience({
  bookingControl,
  children,
}: FreshCutMotionExperienceProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<MasterTimeline | null>(null)
  const triggerRef = useRef<MasterScrollTrigger | null>(null)
  const mediaControllerRef = useRef<FreshCutMotionMediaController | null>(null)
  const latestMediaCommandRef = useRef<MotionMediaCommand | null>(null)
  const focusTimersRef = useRef<Set<number>>(new Set())
  const pendingFocusRef = useRef<FreshCutMotionSceneId | null>(null)
  const latestProgressRef = useRef(0)
  const latestVisualProgressRef = useRef(0)
  const latestSceneRef = useRef<FreshCutMotionSceneId>('hero')
  const pausedRef = useRef(false)
  const preparedBuildRef = useRef<(() => void) | null>(null)
  const preparationFramesRef = useRef<{ first: number | null; second: number | null }>({
    first: null,
    second: null,
  })
  const cancelPreparationFrames = useCallback(() => {
    const frames = preparationFramesRef.current
    if (frames.first !== null) window.cancelAnimationFrame(frames.first)
    if (frames.second !== null) window.cancelAnimationFrame(frames.second)
    frames.first = null
    frames.second = null
  }, [])
  const [mode, setMode] = useState<MotionMode>('static')
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visualProgress, setVisualProgress] = useState(0)

  const queueHeadingFocus = useCallback((sceneId: FreshCutMotionSceneId) => {
    const timer = window.setTimeout(() => {
      focusTimersRef.current.delete(timer)
      focusSceneHeading(sceneId)
      if (pendingFocusRef.current === sceneId) pendingFocusRef.current = null
    }, 0)
    focusTimersRef.current.add(timer)
  }, [])

  const jumpToStableScene = useCallback(
    (sceneId: FreshCutMotionSceneId, options: StableSceneJumpOptions): boolean => {
      const trigger = triggerRef.current
      if (!trigger) return false

      pendingFocusRef.current = sceneId
      if (options.updateHash) {
        const anchorId =
          FRESHCUT_MOTION_SCENES.find((candidate) => candidate.id === sceneId)?.anchorId ?? ''
        const targetHash = `#${anchorId}`
        if (window.location.hash !== targetHash) window.history.pushState(null, '', targetHash)
      }

      const targetProgress = motionSceneTarget(sceneId)
      timelineRef.current?.progress(targetProgress)
      timelineRef.current?.pause()
      latestVisualProgressRef.current = targetProgress
      setVisualProgress(targetProgress)

      const stableMediaCommand: MotionMediaCommand = {
        sceneId,
        progress: targetProgress,
        direction: targetProgress < latestProgressRef.current ? -1 : 1,
        visible: trigger.isActive,
        paused: pausedRef.current,
        fast: true,
        checkpoint: true,
      }
      latestMediaCommandRef.current = stableMediaCommand
      const activeMediaController = mediaControllerRef.current
      try {
        activeMediaController?.sync(stableMediaCommand)
      } catch {
        if (mediaControllerRef.current === activeMediaController) mediaControllerRef.current = null
        try {
          activeMediaController?.destroy()
        } catch {
          // Media enhancement is optional; navigation and master motion remain authoritative.
        }
      }
      window.scrollTo({
        behavior: 'auto',
        top: motionScrollPositionForScene(trigger.start, trigger.end, sceneId),
      })

      if (options.focusIfCurrent && latestSceneRef.current === sceneId) {
        queueHeadingFocus(sceneId)
      }
      return true
    },
    [queueHeadingFocus],
  )

  const scene = motionSceneForProgress(progress)
  const mobilePhase = motionMobilePhaseForScene(scene.id)

  useLayoutEffect(() => {
    if (mode !== 'preparing' || !preparedBuildRef.current) return

    let cancelled = false
    const firstFrame = window.requestAnimationFrame(() => {
      preparationFramesRef.current.first = null
      if (cancelled) return
      const secondFrame = window.requestAnimationFrame(() => {
        preparationFramesRef.current.second = null
        if (cancelled) return
        const build = preparedBuildRef.current
        preparedBuildRef.current = null
        build?.()
      })
      preparationFramesRef.current.second = secondFrame
    })
    preparationFramesRef.current.first = firstFrame

    return () => {
      cancelled = true
      cancelPreparationFrames()
    }
  }, [cancelPreparationFrames, mode])

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return

    if (!claimFreshCutMotionPrepaintCapability()) return
    const bootstrapDeadline = getFreshCutMotionPrepaintDeadline()
    if (bootstrapDeadline === null) {
      clearFreshCutMotionPrepaintCapability()
      return
    }
    const compactQuery = window.matchMedia(`(max-width: ${DESKTOP_VIEWPORT_MIN_WIDTH - 1}px)`)
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (
      navigator as Navigator & {
        connection?: {
          addEventListener?: (type: 'change', listener: EventListener) => void
          removeEventListener?: (type: 'change', listener: EventListener) => void
        }
      }
    ).connection

    let disposed = false
    let cleaned = false
    let masterTimeline: MasterTimeline | null = null
    let masterTrigger: MasterScrollTrigger | null = null
    let mediaController: FreshCutMotionMediaController | null = null
    let mediaActivated = false
    let motionContext: MotionContext | null = null
    let motionRuntime: MotionRuntime | null = null
    let ownedRuntimePromise: Promise<MotionRuntime> | null = null
    let hasBuiltMotion = false
    let bootstrapExpired = false
    let bootstrapReady = false
    let bootstrapTimer: number | null = null
    let hasCheckedInitialHash = false
    let latestCompactViewport = compactQuery.matches
    let ownedPreparedBuild: (() => void) | null = null
    let runtimeDisabled = false

    const destroyActiveResources = () => {
      const triggerToKill = masterTrigger
      const mediaToDestroy = mediaController
      const timelineToKill = masterTimeline
      const contextToRevert = motionContext
      masterTrigger = null
      mediaController = null
      mediaActivated = false
      masterTimeline = null
      motionContext = null
      if (triggerRef.current === triggerToKill) triggerRef.current = null
      if (timelineRef.current === timelineToKill) timelineRef.current = null
      if (mediaControllerRef.current === mediaToDestroy) mediaControllerRef.current = null
      triggerToKill?.kill()
      mediaToDestroy?.destroy()
      timelineToKill?.kill()
      contextToRevert?.revert()
    }

    const disableMediaController = (controller: FreshCutMotionMediaController) => {
      mediaActivated = false
      if (mediaController === controller) mediaController = null
      if (mediaControllerRef.current === controller) mediaControllerRef.current = null
      try {
        controller.destroy()
      } catch {
        // A media-only failure must not tear down the master motion owner.
      }
    }

    const clearBootstrapTimer = () => {
      if (bootstrapTimer === null) return
      window.clearTimeout(bootstrapTimer)
      bootstrapTimer = null
    }

    const disableEnhancedMotion = () => {
      if (runtimeDisabled) return
      runtimeDisabled = true
      hasBuiltMotion = false
      bootstrapExpired = true
      clearBootstrapTimer()
      cancelPreparationFrames()
      if (preparedBuildRef.current === ownedPreparedBuild) preparedBuildRef.current = null
      destroyActiveResources()
      clearFreshCutMotionPrepaintCapability()
      if (!disposed) setMode('static')
    }

    const handleCapabilityChange: EventListener = () => {
      if (!isFreshCutMotionRuntimeEligible()) disableEnhancedMotion()
    }

    reducedMotionQuery.addEventListener('change', handleCapabilityChange)
    connection?.addEventListener?.('change', handleCapabilityChange)
    if (!isFreshCutMotionRuntimeEligible()) {
      disableEnhancedMotion()
    }

    const syncActiveMediaController = (command: MotionMediaCommand) => {
      const controller = mediaActivated ? mediaController : null
      if (!controller) return
      try {
        controller.sync(command)
      } catch {
        disableMediaController(controller)
      }
    }

    const bootstrapIsCurrent = () =>
      !bootstrapExpired &&
      Date.now() < bootstrapDeadline &&
      getFreshCutMotionPrepaintDeadline() === bootstrapDeadline

    const failBootstrapStatic = () => {
      if (bootstrapReady) return
      bootstrapExpired = true
      clearBootstrapTimer()
      cancelPreparationFrames()
      if (preparedBuildRef.current === ownedPreparedBuild) preparedBuildRef.current = null
      if (ownedRuntimePromise && motionRuntimePromise === ownedRuntimePromise) {
        motionRuntimePromise = null
      }
      destroyActiveResources()
      clearFreshCutMotionPrepaintCapability()
      if (!disposed) setMode('static')
    }

    bootstrapTimer = window.setTimeout(
      failBootstrapStatic,
      Math.max(0, bootstrapDeadline - Date.now()),
    )

    const syncMediaFromTrigger = (
      source: MasterScrollTrigger,
      nextProgress: number,
      nextSceneId: FreshCutMotionSceneId,
    ) => {
      const mediaCommand: MotionMediaCommand = {
        sceneId: nextSceneId,
        progress: nextProgress,
        direction: source.direction < 0 ? -1 : 1,
        visible: source.isActive,
        paused: pausedRef.current,
        fast: Math.abs(source.getVelocity()) >= FAST_SCROLL_VELOCITY,
        checkpoint: false,
      }
      latestMediaCommandRef.current = mediaCommand
      syncActiveMediaController(mediaCommand)
    }

    const updateFromScrollTrigger = (source: MasterScrollTrigger) => {
      if (disposed) return
      const next = clampProgress(source.progress)
      const nextScene = motionSceneForProgress(next)
      latestProgressRef.current = next
      latestSceneRef.current = nextScene.id
      setProgress(next)

      if (!pausedRef.current) {
        masterTimeline?.progress(next)
        masterTimeline?.pause()
        latestVisualProgressRef.current = next
        setVisualProgress(next)
      }

      if (pendingFocusRef.current === nextScene.id) {
        focusSceneHeading(nextScene.id)
        pendingFocusRef.current = null
      }

      syncMediaFromTrigger(source, next, nextScene.id)
    }

    const rebuildMotion = (compactViewport: boolean) => {
      if (disposed || runtimeDisabled || !motionRuntime) return
      if (!bootstrapReady && !bootstrapIsCurrent()) {
        failBootstrapStatic()
        return
      }
      hasBuiltMotion = false
      destroyActiveResources()
      try {
        const { gsap, ScrollTrigger } = motionRuntime
        motionContext = gsap.context(() => {
          const sceneElements = Array.from(stage.children).filter(
            (element): element is HTMLElement =>
              element instanceof HTMLElement && element.hasAttribute('data-motion-scene'),
          )
          const elementsByScene = new Map(
            sceneElements.map((element) => [element.dataset.motionScene, element]),
          )
          const businessPanel = stage.querySelector<HTMLElement>('[data-motion-business-panel]')

          const timeline = gsap.timeline({ paused: true })
          timeline.to(
            stage,
            {
              '--motion-visual-progress': 1,
              duration: 1,
              ease: 'none',
            },
            0,
          )
          timeline.set(
            sceneElements,
            {
              autoAlpha: 0,
              inset: 0,
              pointerEvents: 'none',
              position: 'absolute',
            },
            0,
          )

          const visualKeyframes = FRESHCUT_MOTION_SCENES.map((motionScene) => ({
            motionScene,
            start: motionScene.range[0],
          }))

          FRESHCUT_MOTION_SCENES.forEach((motionScene, index) => {
            const previousScene = index > 0 ? FRESHCUT_MOTION_SCENES[index - 1] : undefined
            const sceneElement = elementsByScene.get(motionScene.id)
            if (!sceneElement) return
            sceneElement.dataset.motionEntryDirection = compactViewport
              ? 'centre'
              : sceneEntryDirection(motionScene, previousScene)
          })

          visualKeyframes.forEach(({ motionScene, start }, index) => {
            const previousKeyframe = visualKeyframes[index - 1]
            const nextKeyframe = visualKeyframes[index + 1]
            const previousElement = previousKeyframe
              ? elementsByScene.get(previousKeyframe.motionScene.id)
              : undefined
            const sceneElement = elementsByScene.get(motionScene.id)
            if (!sceneElement) return

            const direction = compactViewport
              ? 'centre'
              : sceneEntryDirection(motionScene, previousKeyframe?.motionScene)
            const entryState = sceneEntryState(direction, compactViewport)
            const sceneEnd = nextKeyframe?.start ?? (compactViewport ? 1 : motionScene.range[1])
            const sceneDuration = Math.max(0.001, sceneEnd - start)
            const transitionDuration = Math.min(
              compactViewport ? 0.025 : 0.045,
              sceneDuration * 0.35,
            )
            const transitionStart = Math.max(0, start - transitionDuration)
            const usesMatchedHardCut =
              previousElement !== undefined &&
              previousKeyframe?.motionScene.transitionOut === FRESHCUT_MATCHED_CHAIR_HARD_CUT &&
              motionScene.transitionIn === FRESHCUT_MATCHED_CHAIR_HARD_CUT

            if (index === 0) {
              timeline.set(
                sceneElement,
                {
                  autoAlpha: 1,
                  pointerEvents: 'auto',
                  scale: 1,
                  xPercent: 0,
                },
                0,
              )
            } else if (usesMatchedHardCut) {
              timeline.set(
                previousElement,
                {
                  autoAlpha: 0,
                  pointerEvents: 'none',
                  xPercent: 0,
                },
                start,
              )
              timeline.set(
                sceneElement,
                {
                  autoAlpha: 1,
                  pointerEvents: 'auto',
                  scale: 1,
                  xPercent: 0,
                },
                start,
              )
            } else {
              if (previousElement) {
                timeline.to(
                  previousElement,
                  {
                    autoAlpha: 0,
                    duration: transitionDuration,
                    ease: 'power2.in',
                    pointerEvents: 'none',
                    xPercent: entryState.xPercent === 0 ? 0 : -entryState.xPercent / 2,
                  },
                  transitionStart,
                )
              }
              timeline.fromTo(
                sceneElement,
                {
                  autoAlpha: 0,
                  scale: entryState.scale,
                  xPercent: entryState.xPercent,
                },
                {
                  autoAlpha: 1,
                  duration: transitionDuration,
                  ease: 'power2.out',
                  pointerEvents: 'auto',
                  scale: 1,
                  xPercent: 0,
                },
                transitionStart,
              )
            }

            const layers = Array.from(
              sceneElement.querySelectorAll<HTMLElement>('[data-motion-layer]'),
            )
            for (const layer of layers) {
              const depthFactor = Number(layer.dataset.motionDepthFactor)
              const currentCamera = cameraStateAtDepth(
                motionScene.camera,
                compactViewport,
                depthFactor,
              )
              const nextCamera = cameraStateAtDepth(
                nextKeyframe?.motionScene.camera ?? motionScene.camera,
                compactViewport,
                depthFactor,
              )
              timeline.fromTo(
                layer,
                {
                  rotationY: currentCamera.rotationY,
                  x: currentCamera.x,
                  y: currentCamera.y,
                  z: currentCamera.z,
                },
                {
                  duration: sceneDuration,
                  ease: 'none',
                  rotationY: nextCamera.rotationY,
                  x: nextCamera.x,
                  y: nextCamera.y,
                  z: nextCamera.z,
                },
                start,
              )
            }
          })

          if (businessPanel) {
            timeline.set(
              businessPanel,
              {
                autoAlpha: 1,
                pointerEvents: 'auto',
                scale: 1,
                xPercent: 0,
                yPercent: 0,
              },
              FRESHCUT_MOTION_SCENES[0].range[0],
            )
            timeline.to(
              businessPanel,
              {
                autoAlpha: 0,
                duration: compactViewport ? 0.025 : 0.04,
                ease: 'power2.in',
                pointerEvents: 'none',
                scale: compactViewport ? 1 : 0.96,
                xPercent: compactViewport ? 0 : -14,
              },
              FRESHCUT_MOTION_SCENES[1].range[0] - (compactViewport ? 0.025 : 0.04),
            )
            if (!compactViewport) {
              timeline.to(
                businessPanel,
                {
                  autoAlpha: 1,
                  duration: 0.035,
                  ease: 'power2.out',
                  pointerEvents: 'auto',
                  scale: 0.82,
                  xPercent: 44,
                  yPercent: 0,
                },
                FRESHCUT_MOTION_SCENES[6].range[0] - 0.035,
              )
              timeline.to(
                businessPanel,
                {
                  autoAlpha: 1,
                  duration: 0.025,
                  ease: 'power1.inOut',
                  pointerEvents: 'auto',
                  scale: 0.78,
                  xPercent: -28,
                  yPercent: 8,
                },
                FRESHCUT_MOTION_SCENES[7].range[0] - 0.025,
              )
            }
          }
          masterTimeline = timeline
          masterTrigger = ScrollTrigger.create({
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            invalidateOnRefresh: true,
            onUpdate: (self) => updateFromScrollTrigger(self),
            onToggle: (self) =>
              syncMediaFromTrigger(self, latestProgressRef.current, latestSceneRef.current),
          })
          mediaController = createFreshCutMotionMediaController(stage, FRESHCUT_MOTION_SCENES)
        }, root)

        if (disposed) {
          destroyActiveResources()
          return
        }
        timelineRef.current = masterTimeline
        triggerRef.current = masterTrigger
        masterTimeline?.progress(latestVisualProgressRef.current)
        masterTimeline?.pause()

        if (!hasCheckedInitialHash) {
          hasCheckedInitialHash = true
          const initialScene = FRESHCUT_MOTION_SCENES.find(
            (candidate) => window.location.hash === `#${candidate.anchorId}`,
          )
          if (initialScene) {
            jumpToStableScene(initialScene.id, {
              focusIfCurrent: true,
              updateHash: false,
            })
          }
        }
        if (!bootstrapReady) {
          if (!bootstrapIsCurrent()) {
            failBootstrapStatic()
            return
          }
          bootstrapReady = true
          clearBootstrapTimer()
          markFreshCutMotionPrepaintReady()
        }
        hasBuiltMotion = true
        setMode('enhanced')

        const controllerToActivate = mediaController
        if (controllerToActivate) {
          mediaActivated = true
          mediaControllerRef.current = controllerToActivate
          const latestMediaCommand = latestMediaCommandRef.current
          if (latestMediaCommand) {
            syncActiveMediaController(latestMediaCommand)
          } else if (masterTrigger) {
            const initialProgress = clampProgress(masterTrigger.progress)
            syncMediaFromTrigger(
              masterTrigger,
              initialProgress,
              motionSceneForProgress(initialProgress).id,
            )
          }
          if (pausedRef.current && mediaController === controllerToActivate) {
            try {
              controllerToActivate.setPaused(true)
            } catch {
              disableMediaController(controllerToActivate)
            }
          }
        }
      } catch {
        destroyActiveResources()
        if (!disposed) {
          clearFreshCutMotionPrepaintCapability()
          setMode('static')
        }
      }
    }

    const queuePreparedBuild = () => {
      if (runtimeDisabled || !isFreshCutMotionRuntimeEligible()) return
      const preparedBuild = () => rebuildMotion(latestCompactViewport)
      ownedPreparedBuild = preparedBuild
      preparedBuildRef.current = preparedBuild
      setMode('preparing')
    }

    const handleCompactChange = (event: MediaQueryListEvent) => {
      latestCompactViewport = event.matches
      if (!runtimeDisabled && isFreshCutMotionRuntimeEligible() && hasBuiltMotion) {
        queuePreparedBuild()
      }
    }
    compactQuery.addEventListener('change', handleCompactChange)

    void (async () => {
      try {
        if (runtimeDisabled) return
        ownedRuntimePromise = loadMotionRuntime()
        motionRuntime = await ownedRuntimePromise
        if (disposed) return
        if (!bootstrapIsCurrent()) {
          failBootstrapStatic()
          return
        }
        motionRuntime.gsap.registerPlugin(motionRuntime.ScrollTrigger)
        latestCompactViewport = compactQuery.matches
        queuePreparedBuild()
      } catch {
        destroyActiveResources()
        if (!disposed) {
          clearFreshCutMotionPrepaintCapability()
          setMode('static')
        }
      }
    })()

    return () => {
      disposed = true
      if (!cleaned) {
        cleaned = true
        clearBootstrapTimer()
        cancelPreparationFrames()
        reducedMotionQuery.removeEventListener('change', handleCapabilityChange)
        connection?.removeEventListener?.('change', handleCapabilityChange)
        if (preparedBuildRef.current === ownedPreparedBuild) preparedBuildRef.current = null
        compactQuery.removeEventListener('change', handleCompactChange)
        destroyActiveResources()
        releaseFreshCutMotionPrepaintCapability()
      }
    }
  }, [cancelPreparationFrames, jumpToStableScene])

  useEffect(
    () => () => {
      for (const timer of focusTimersRef.current) window.clearTimeout(timer)
      focusTimersRef.current.clear()
    },
    [],
  )

  const navigateToScene = (event: ReactMouseEvent<HTMLElement>, sceneId: FreshCutMotionSceneId) => {
    if (event.defaultPrevented) return

    const trigger = triggerRef.current
    if (mode !== 'enhanced' || !trigger) {
      pendingFocusRef.current = sceneId
      queueHeadingFocus(sceneId)
      return
    }

    event.preventDefault()
    jumpToStableScene(sceneId, {
      focusIfCurrent: true,
      updateHash: true,
    })
  }

  const routeManifestAnchor = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    ) {
      return
    }

    const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]')
    if (!anchor || !event.currentTarget.contains(anchor)) return
    const href = anchor.getAttribute('href')
    const destination = FRESHCUT_MOTION_SCENES.find(
      (candidate) => href === `#${candidate.anchorId}`,
    )
    if (destination) navigateToScene(event, destination.id)
  }

  const togglePaused = () => {
    if (mode !== 'enhanced') return
    if (pausedRef.current) {
      pausedRef.current = false
      setPaused(false)
      const resumedCommand = latestMediaCommandRef.current
        ? { ...latestMediaCommandRef.current, paused: false }
        : null
      if (resumedCommand) {
        latestMediaCommandRef.current = resumedCommand
        mediaControllerRef.current?.sync(resumedCommand)
      }
      mediaControllerRef.current?.setPaused(false)
      const catchUpProgress = latestProgressRef.current
      timelineRef.current?.progress(catchUpProgress)
      timelineRef.current?.pause()
      latestVisualProgressRef.current = catchUpProgress
      setVisualProgress(catchUpProgress)
      return
    }

    pausedRef.current = true
    setPaused(true)
    mediaControllerRef.current?.setPaused(true)
    const pausedCommand = latestMediaCommandRef.current
      ? { ...latestMediaCommandRef.current, paused: true }
      : null
    if (pausedCommand) {
      latestMediaCommandRef.current = pausedCommand
      mediaControllerRef.current?.sync(pausedCommand)
    }
  }

  const style: MotionStyle = {
    '--motion-progress': String(progress),
    '--motion-scroll-distance-desktop': `${motionScrollDistanceVh('desktop')}svh`,
    '--motion-scroll-distance-mobile': `${motionScrollDistanceVh('mobile')}svh`,
    '--motion-visual-progress': String(visualProgress),
  }

  return (
    <div
      ref={rootRef}
      className={motion.motionExperience}
      data-motion-mode={mode}
      data-motion-scene={scene.id}
      data-motion-mobile-phase={mobilePhase}
      data-motion-paused={paused ? 'true' : 'false'}
      data-motion-released={progress >= 1 ? 'true' : 'false'}
      onClick={routeManifestAnchor}
      style={style}
    >
      <div className={motion.motionExperienceControls}>
        <nav aria-label="Upplevelsens scener" className={motion.motionExperienceNav}>
          {FRESHCUT_MOTION_SCENES.map((checkpoint) => (
            <a
              key={checkpoint.id}
              href={`#${checkpoint.anchorId}`}
              aria-current={scene.id === checkpoint.id ? 'step' : undefined}
            >
              {checkpoint.label}
            </a>
          ))}
        </nav>

        <div className={motion.motionExperienceActions}>
          <a href="#motion-scene-mirror">Hoppa till resultat</a>
          <a href="#tjanster">Se tjänster</a>
          {bookingControl}
          <button
            type="button"
            className={motion.motionExperiencePause}
            aria-pressed={paused}
            disabled={mode !== 'enhanced'}
            onClick={togglePaused}
          >
            {paused ? 'Fortsätt rörelse' : 'Pausa rörelse'}
          </button>
        </div>
      </div>

      <div ref={stageRef} className={motion.motionExperienceStage} data-motion-stage="true">
        {children}
      </div>
    </div>
  )
}
