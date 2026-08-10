'use client'

import {
  Children,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import motion from './freshcut-motion.module.css'

export type FreshCutMotionPhase = 'threshold' | 'craft' | 'mirror'

const CHECKPOINTS: ReadonlyArray<{
  phase: FreshCutMotionPhase
  label: string
  anchorId: string
  headingId: string
  progress: 0 | 0.6 | 0.87
}> = [
  {
    phase: 'threshold',
    label: 'Entré',
    anchorId: 'motion-checkpoint-threshold',
    headingId: 'motion-threshold-title',
    progress: 0,
  },
  {
    phase: 'craft',
    label: 'Hantverket',
    anchorId: 'motion-checkpoint-craft',
    headingId: 'motion-craft-title',
    progress: 0.6,
  },
  {
    phase: 'mirror',
    label: 'Resultatet',
    anchorId: 'motion-checkpoint-mirror',
    headingId: 'motion-mirror-title',
    progress: 0.87,
  },
]

type MotionStyle = CSSProperties & { '--motion-progress': string }
type CheckpointStyle = CSSProperties & { '--motion-checkpoint-top': string }
type PendingFocus = Pick<(typeof CHECKPOINTS)[number], 'phase' | 'headingId'>
type JourneyMode = 'pending' | 'static' | 'enhanced'

export function motionPhaseForProgress(progress: number): FreshCutMotionPhase {
  const clamped = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress))
  if (clamped < 0.6) return 'threshold'
  if (clamped < 0.87) return 'craft'
  return 'mirror'
}

export function FreshCutMotionJourney({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const focusTimersRef = useRef<Set<number>>(new Set())
  const [journeyMode, setJourneyMode] = useState<JourneyMode>('pending')
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [measuredTravel, setMeasuredTravel] = useState<number | null>(null)
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null)
  const enhanced = journeyMode === 'enhanced'
  const phase = motionPhaseForProgress(progress)
  const panels = Children.toArray(children)

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (prefersReducedMotion || connection?.saveData) {
      setJourneyMode('static')
      return
    }

    const wrapper = wrapperRef.current
    if (!wrapper) return

    let active = typeof window.IntersectionObserver !== 'function'
    let queuedFrame: number | null = null
    let disposed = false

    const updateProgress = () => {
      queuedFrame = null
      if (disposed || !active) return

      const bounds = wrapper.getBoundingClientRect()
      const visualViewportHeight = window.visualViewport?.height
      const viewportHeight =
        typeof visualViewportHeight === 'number' && visualViewportHeight > 0
          ? visualViewportHeight
          : window.innerHeight
      const travel = Math.max(1, bounds.height - viewportHeight)
      const nextProgress = Math.min(1, Math.max(0, -bounds.top / travel))
      setMeasuredTravel(travel)
      setProgress(nextProgress)
      setJourneyMode('enhanced')
    }

    const queueUpdate = () => {
      if (!active || queuedFrame !== null) return
      queuedFrame = window.requestAnimationFrame(updateProgress)
    }

    const handleScroll = () => queueUpdate()
    const handleResize = () => queueUpdate()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', handleResize)

    let resizeObserver: ResizeObserver | null = null
    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(handleResize)
      resizeObserver.observe(wrapper)
    }

    let observer: IntersectionObserver | null = null
    if (typeof window.IntersectionObserver === 'function') {
      observer = new window.IntersectionObserver(([entry]) => {
        active = entry?.isIntersecting ?? false
        if (active) {
          queueUpdate()
        } else if (queuedFrame !== null) {
          window.cancelAnimationFrame(queuedFrame)
          queuedFrame = null
        }
      })
      observer.observe(wrapper)
    } else {
      queueUpdate()
    }

    return () => {
      disposed = true
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      visualViewport?.removeEventListener('resize', handleResize)
      observer?.disconnect()
      resizeObserver?.disconnect()
      if (queuedFrame !== null) window.cancelAnimationFrame(queuedFrame)
    }
  }, [])

  useEffect(
    () => () => {
      for (const timer of focusTimersRef.current) window.clearTimeout(timer)
      focusTimersRef.current.clear()
    },
    [],
  )

  useEffect(() => {
    if (!pendingFocus || (journeyMode !== 'static' && pendingFocus.phase !== phase)) return
    document.getElementById(pendingFocus.headingId)?.focus({ preventScroll: true })
    setPendingFocus(null)
  }, [journeyMode, pendingFocus, phase])

  const queueCheckpointFocus = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    checkpoint: PendingFocus,
  ) => {
    if (event.defaultPrevented) return
    const timer = window.setTimeout(() => {
      focusTimersRef.current.delete(timer)
      setPendingFocus({ phase: checkpoint.phase, headingId: checkpoint.headingId })
    }, 0)
    focusTimersRef.current.add(timer)
  }

  const style: MotionStyle = { '--motion-progress': String(progress) }

  return (
    <div
      ref={wrapperRef}
      className={motion.journey}
      data-motion-mode={enhanced ? 'enhanced' : 'static'}
      data-motion-enhanced={enhanced ? 'true' : undefined}
      data-motion-phase={phase}
      data-motion-paused={paused ? 'true' : 'false'}
      data-motion-released={enhanced && progress >= 1 ? 'true' : 'false'}
      style={style}
    >
      {CHECKPOINTS.map((checkpoint) => (
        <span
          key={checkpoint.anchorId}
          id={checkpoint.anchorId}
          className={motion.checkpointAnchor}
          data-motion-checkpoint={checkpoint.phase}
          data-motion-progress={checkpoint.progress}
          style={
            enhanced && measuredTravel !== null
              ? ({
                  '--motion-checkpoint-top': `${checkpoint.progress * measuredTravel}px`,
                } as CheckpointStyle)
              : undefined
          }
          aria-hidden="true"
        />
      ))}

      <div className={motion.journeyScene}>
        <div className={motion.journeyControls}>
          <nav aria-label="Upplevelsens delar" className={motion.checkpoints}>
            {CHECKPOINTS.map((checkpoint) => (
              <a
                key={checkpoint.anchorId}
                href={`#${checkpoint.anchorId}`}
                aria-current={phase === checkpoint.phase ? 'step' : undefined}
                onClick={(event) => queueCheckpointFocus(event, checkpoint)}
              >
                {checkpoint.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            className={motion.pauseButton}
            aria-pressed={paused}
            disabled={!enhanced}
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? 'Fortsätt rörelse' : 'Pausa rörelse'}
          </button>
        </div>

        {panels.map((panel, index) => {
          const checkpoint = CHECKPOINTS[index]
          return (
            <div
              key={checkpoint?.phase ?? index}
              className={motion.journeyPanel}
              data-motion-panel={checkpoint?.phase}
            >
              {panel}
            </div>
          )
        })}
      </div>
    </div>
  )
}
