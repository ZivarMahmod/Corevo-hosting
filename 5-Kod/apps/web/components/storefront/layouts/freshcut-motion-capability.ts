const PREPAINT_STATE_KEY = '__freshCutMotionPrepaintState'

type FreshCutMotionPrepaintState = {
  deadline: number
  sheet: CSSStyleSheet
  status: 'pending' | 'claimed' | 'ready' | 'releasing'
  timer: number | null
}

type FreshCutMotionWindow = Window & {
  __freshCutMotionPrepaintState?: FreshCutMotionPrepaintState
}

type FreshCutMotionConnection = {
  effectiveType?: string
  saveData?: boolean
  addEventListener?: (type: 'change', listener: EventListener) => void
  removeEventListener?: (type: 'change', listener: EventListener) => void
}

function constrainedConnection(connection: FreshCutMotionConnection | undefined): boolean {
  return (
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === '3g'
  )
}

/** Re-checkable runtime gate for preferences and device/network constraints. */
export function isFreshCutMotionRuntimeEligible(): boolean {
  const connection = (navigator as Navigator & { connection?: FreshCutMotionConnection }).connection
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return (
    typeof window.requestAnimationFrame === 'function' &&
    'adoptedStyleSheets' in document &&
    typeof CSSStyleSheet === 'function' &&
    typeof CSSStyleSheet.prototype.replaceSync === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !connection?.saveData &&
    !constrainedConnection(connection) &&
    !(typeof deviceMemory === 'number' && deviceMemory <= 2)
  )
}

function removeSheet(sheet: CSSStyleSheet): void {
  if (!('adoptedStyleSheets' in document)) return
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    (candidate) => candidate !== sheet,
  )
}

/**
 * Runs as an inline script before the motion markup is painted. Its function
 * source must stay self-contained because the client bundle is not available
 * yet. If hydration never claims the sheet, the watchdog restores the complete
 * server-rendered static flow.
 */
export function applyFreshCutMotionPrepaintCapability(): boolean {
  try {
    const motionWindow = window as FreshCutMotionWindow
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean }
      }
    ).connection
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const constrainedConnection =
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g' ||
      connection?.effectiveType === '3g'
    const eligible =
      typeof window.requestAnimationFrame === 'function' &&
      'adoptedStyleSheets' in document &&
      typeof CSSStyleSheet === 'function' &&
      typeof CSSStyleSheet.prototype.replaceSync === 'function' &&
      !prefersReducedMotion &&
      !connection?.saveData &&
      !constrainedConnection &&
      !(typeof deviceMemory === 'number' && deviceMemory <= 2)

    const existing = motionWindow.__freshCutMotionPrepaintState
    if (existing?.status === 'ready') return false
    if (!eligible) {
      if (existing?.timer !== null && existing?.timer !== undefined) {
        window.clearTimeout(existing.timer)
      }
      if (existing?.sheet) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (candidate) => candidate !== existing.sheet,
        )
      }
      delete motionWindow.__freshCutMotionPrepaintState
      return false
    }

    if (existing) return true

    const sheet = new CSSStyleSheet()
    sheet.replaceSync(`
      [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] {
        height: calc(100svh + var(--motion-scroll-distance-desktop));
      }
      [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-stage] {
        position: sticky;
        top: 0;
        height: 100svh;
        overflow: clip;
        isolation: isolate;
        perspective: 1200px;
        transform-style: preserve-3d;
      }
      [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-scene] {
        position: absolute;
        inset: 0;
        min-height: 100%;
        visibility: hidden;
        opacity: 0;
        pointer-events: none;
      }
      [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-scene="hero"] {
        visibility: visible;
        opacity: 1;
      }
      [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-business-panel] {
        position: absolute;
        top: 58px;
        bottom: 0;
        left: 0;
        width: min(47vw, 720px);
        min-height: 0;
      }
      @media (min-width: 768px) {
        [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-business-panel] {
          top: 0;
          padding-block: clamp(32px, 4svh, 44px);
        }
        [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-business-panel] > :first-child {
          margin-bottom: clamp(18px, 3svh, 28px);
        }
      }
      @media (max-width: 1023px) {
        [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] {
          height: calc(100svh + var(--motion-scroll-distance-mobile));
        }
        [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-stage] {
          height: 100svh;
        }
      }
      @media (max-width: 767px) {
        [data-storefront-experience="freshcut-motiontest"] [data-motion-mode="static"] [data-motion-business-panel] {
          top: 0;
          right: 0;
          bottom: auto;
          width: 100%;
          min-height: 100%;
        }
      }
    `)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

    const state = {
      deadline: Date.now() + 4_000,
      sheet,
      status: 'pending' as const,
      timer: null as number | null,
    }
    state.timer = window.setTimeout(() => {
      const current = motionWindow.__freshCutMotionPrepaintState
      if (current !== state || current.status === 'releasing') return
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (candidate) => candidate !== sheet,
      )
      delete motionWindow.__freshCutMotionPrepaintState
    }, 4_000)
    motionWindow.__freshCutMotionPrepaintState = state
    return true
  } catch {
    try {
      const motionWindow = window as FreshCutMotionWindow
      const state = motionWindow.__freshCutMotionPrepaintState
      if (state?.timer !== null && state?.timer !== undefined) window.clearTimeout(state.timer)
      if (state?.sheet && 'adoptedStyleSheets' in document) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (candidate) => candidate !== state.sheet,
        )
      }
      delete motionWindow.__freshCutMotionPrepaintState
    } catch {
      // If CSSOM access itself fails, the server-rendered static flow remains.
    }
    return false
  }
}

/** Claims the prepaint geometry before the asynchronous motion runtime loads. */
export function claimFreshCutMotionPrepaintCapability(): boolean {
  const motionWindow = window as FreshCutMotionWindow
  const state = motionWindow.__freshCutMotionPrepaintState
  if (!state || !document.adoptedStyleSheets.includes(state.sheet)) return false
  if (state.status === 'claimed') return false
  if (state.status === 'releasing' || state.timer === null) {
    if (state.timer !== null) window.clearTimeout(state.timer)
    state.timer = window.setTimeout(
      () => {
        if (motionWindow.__freshCutMotionPrepaintState !== state || state.status === 'releasing') {
          return
        }
        removeSheet(state.sheet)
        delete motionWindow.__freshCutMotionPrepaintState
      },
      Math.max(0, state.deadline - Date.now()),
    )
  }
  state.status = 'claimed'
  return true
}

/** Absolute prepaint deadline shared by the async runtime bootstrap. */
export function getFreshCutMotionPrepaintDeadline(): number | null {
  const state = (window as FreshCutMotionWindow).__freshCutMotionPrepaintState
  return state && (state.status === 'pending' || state.status === 'claimed') ? state.deadline : null
}

/** The enhanced owner calls ready only after its real timeline and trigger exist. */
export function markFreshCutMotionPrepaintReady(): void {
  const state = (window as FreshCutMotionWindow).__freshCutMotionPrepaintState
  if (!state) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  state.timer = null
  state.status = 'ready'
  removeSheet(state.sheet)
}

/**
 * Defers release by one task so React StrictMode can immediately reclaim the
 * same owner during its development-only effect remount.
 */
export function releaseFreshCutMotionPrepaintCapability(): void {
  const motionWindow = window as FreshCutMotionWindow
  const state = motionWindow.__freshCutMotionPrepaintState
  if (!state) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  state.status = 'releasing'
  state.timer = window.setTimeout(() => {
    if (motionWindow.__freshCutMotionPrepaintState !== state || state.status !== 'releasing') {
      return
    }
    removeSheet(state.sheet)
    delete motionWindow.__freshCutMotionPrepaintState
  }, 0)
}

export function clearFreshCutMotionPrepaintCapability(): void {
  const motionWindow = window as FreshCutMotionWindow
  const state = motionWindow[PREPAINT_STATE_KEY]
  if (!state) return
  if (state.timer !== null) window.clearTimeout(state.timer)
  removeSheet(state.sheet)
  delete motionWindow[PREPAINT_STATE_KEY]
}

export const FRESHCUT_MOTION_PREPAINT_SCRIPT = `(${applyFreshCutMotionPrepaintCapability.toString()})();`
