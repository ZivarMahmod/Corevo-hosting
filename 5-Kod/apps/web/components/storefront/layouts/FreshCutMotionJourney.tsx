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
  progress: '0' | '0.60' | '0.87'
}> = [
  {
    phase: 'threshold',
    label: 'Entré',
    anchorId: 'motion-checkpoint-threshold',
    headingId: 'motion-threshold-title',
    progress: '0',
  },
  {
    phase: 'craft',
    label: 'Hantverket',
    anchorId: 'motion-checkpoint-craft',
    headingId: 'motion-craft-title',
    progress: '0.60',
  },
  {
    phase: 'mirror',
    label: 'Resultatet',
    anchorId: 'motion-checkpoint-mirror',
    headingId: 'motion-mirror-title',
    progress: '0.87',
  },
]

type MotionStyle = CSSProperties & { '--motion-progress': string }

export function motionPhaseForProgress(progress: number): FreshCutMotionPhase {
  const clamped = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress))
  if (clamped < 0.6) return 'threshold'
  if (clamped < 0.87) return 'craft'
  return 'mirror'
}

export function FreshCutMotionJourney({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const focusTimersRef = useRef<Set<number>>(new Set())
  const [enhanced, setEnhanced] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const phase = motionPhaseForProgress(progress)
  const panels = Children.toArray(children)

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (prefersReducedMotion || connection?.saveData) return

    const wrapper = wrapperRef.current
    if (!wrapper) return

    let active = typeof window.IntersectionObserver !== 'function'
    let queuedFrame: number | null = null
    let disposed = false

    const updateProgress = () => {
      queuedFrame = null
      if (disposed || !active) return

      const bounds = wrapper.getBoundingClientRect()
      const denominator = Math.max(1, bounds.height - window.innerHeight)
      const nextProgress = Math.min(1, Math.max(0, -bounds.top / denominator))
      setProgress(nextProgress)
    }

    const queueUpdate = () => {
      if (!active || queuedFrame !== null) return
      queuedFrame = window.requestAnimationFrame(updateProgress)
    }

    const handleScroll = () => queueUpdate()
    window.addEventListener('scroll', handleScroll, { passive: true })

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

    setEnhanced(true)

    return () => {
      disposed = true
      window.removeEventListener('scroll', handleScroll)
      observer?.disconnect()
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

  const focusCheckpointHeading = (event: ReactMouseEvent<HTMLAnchorElement>, headingId: string) => {
    if (event.defaultPrevented) return
    const timer = window.setTimeout(() => {
      focusTimersRef.current.delete(timer)
      document.getElementById(headingId)?.focus({ preventScroll: true })
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
                onClick={(event) => focusCheckpointHeading(event, checkpoint.headingId)}
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
