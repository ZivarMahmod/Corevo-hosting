export type FreshCutMotionSceneId =
  | 'hero'
  | 'entrance'
  | 'chair'
  | 'craft'
  | 'range'
  | 'return'
  | 'mirror'
  | 'team'

export type FreshCutMotionMobilePhase = 'enter' | 'craft' | 'result'
export type FreshCutMotionViewport = 'desktop' | 'mobile'

export type FreshCutMotionCamera = {
  x: number
  y: number
  z: number
  rotationY: number
}

export type FreshCutMotionLayerKind = 'media' | 'side-scrim' | 'bottom-scrim' | 'mirror-frame'

export type FreshCutMotionLayer = {
  token: string
  kind: FreshCutMotionLayerKind
  depthFactor: number
}

export type FreshCutMotionMediaPolicy = {
  videoOwner: boolean
  posterOwner: FreshCutMotionSceneId
  slot:
    | 'threshold'
    | 'entrance'
    | 'chair-action'
    | 'craft-action'
    | 'range-editorial'
    | 'main-customer-hold'
    | 'mirror-result'
    | 'team-editorial'
  humanAction: boolean
  forward: 'hold' | 'play-on-entry' | 'micro-loop'
  reverse: 'stable-frame'
  stableStart: 'poster' | 'first-frame'
  stableEnd: 'poster' | 'last-frame'
  preload: 'eager' | 'active-and-next' | 'nearby'
  desktopPoster:
    | `/images/freshcut/${string}.webp`
    | `/media/freshcut-motion/${string}-desktop-poster.webp`
  mobilePoster:
    | `/images/freshcut/${string}.webp`
    | `/media/freshcut-motion/${string}-mobile-poster.webp`
  desktopWebm: string | null
  desktopMp4: string | null
  mobileWebm: string | null
  mobileMp4: string | null
  desktopCrop: string
  mobileCrop: string
  sourceStatus: 'repository-controlled-fallback' | 'generated-demo' | 'approved-final'
  rightsStatus:
    | 'ai-transformation-pending'
    | 'synthetic-text-only'
    | 'approved-for-ai-transformation'
}

export type FreshCutMotionSafeZone = {
  desktop: string
  mobile: string
}

export type FreshCutMotionScene = {
  id: FreshCutMotionSceneId
  label: string
  anchorId: string
  headingId: string
  copyPlacement: 'left' | 'right'
  range: readonly [start: number, end: number]
  mobilePhase: FreshCutMotionMobilePhase
  camera: FreshCutMotionCamera
  safeZone: FreshCutMotionSafeZone
  layers: readonly FreshCutMotionLayer[]
  media: FreshCutMotionMediaPolicy
  dom: readonly string[]
  transitionIn: string
  transitionOut: string
  controls: readonly string[]
  reducedMotion: string
  fallback: string
  verification: 'pending' | 'verified'
}

const SHARED_CONTROLS = ['checkpoints', 'skip-result', 'services', 'book'] as const

function sceneLayers(
  sceneId: FreshCutMotionSceneId,
  options: { mirrorFrame?: boolean } = {},
): readonly FreshCutMotionLayer[] {
  const layers: FreshCutMotionLayer[] = [
    { token: `${sceneId}-media`, kind: 'media', depthFactor: 0.5 },
    { token: `${sceneId}-side-scrim`, kind: 'side-scrim', depthFactor: 0.2 },
    { token: `${sceneId}-bottom-scrim`, kind: 'bottom-scrim', depthFactor: 0.8 },
  ]
  if (options.mirrorFrame) {
    layers.push({ token: `${sceneId}-mirror-frame`, kind: 'mirror-frame', depthFactor: 0.95 })
  }
  return layers
}

export const FRESHCUT_MOTION_SCENES = [
  {
    id: 'hero',
    label: 'Start',
    anchorId: 'motion-scene-hero',
    headingId: 'motion-scene-hero-title',
    copyPlacement: 'left',
    range: [0, 0.12],
    mobilePhase: 'enter',
    camera: { x: 0, y: 0, z: 0, rotationY: 0 },
    safeZone: {
      desktop: 'copy-left-x0-46; subject-right-x47-100',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('hero'),
    media: {
      videoOwner: false,
      posterOwner: 'hero',
      slot: 'threshold',
      humanAction: false,
      forward: 'hold',
      reverse: 'stable-frame',
      stableStart: 'poster',
      stableEnd: 'poster',
      preload: 'eager',
      desktopPoster: '/images/freshcut/freshcut-hero.webp',
      mobilePoster: '/images/freshcut/freshcut-hero.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center',
      mobileCrop: 'center center',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['brand', 'popular-services', 'locations', 'primary-actions'],
    transitionIn: 'stable-threshold',
    transitionOut: 'doorway-depth',
    controls: SHARED_CONTROLS,
    reducedMotion: 'static-threshold-with-business-panel',
    fallback: 'threshold-poster-with-business-panel',
    verification: 'pending',
  },
  {
    id: 'entrance',
    label: 'Entré',
    anchorId: 'motion-scene-entrance',
    headingId: 'motion-scene-entrance-title',
    copyPlacement: 'left',
    range: [0.12, 0.28],
    mobilePhase: 'enter',
    camera: { x: 0, y: 0, z: 18, rotationY: 0 },
    safeZone: {
      desktop: 'copy-left-x0-46; doorway-centre-x47-66',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('entrance'),
    media: {
      videoOwner: true,
      posterOwner: 'entrance',
      slot: 'entrance',
      humanAction: false,
      forward: 'play-on-entry',
      reverse: 'stable-frame',
      stableStart: 'first-frame',
      stableEnd: 'last-frame',
      preload: 'active-and-next',
      desktopPoster: '/images/freshcut/freshcut-hero.webp',
      mobilePoster: '/images/freshcut/freshcut-hero.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center',
      mobileCrop: 'center center',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['entrance-line', 'persistent-booking'],
    transitionIn: 'doorway-mask-open',
    transitionOut: 'chair-foreground-wipe',
    controls: SHARED_CONTROLS,
    reducedMotion: 'static-entrance-panel',
    fallback: 'entrance-poster',
    verification: 'pending',
  },
  {
    id: 'chair',
    label: 'Stolen',
    anchorId: 'motion-scene-chair',
    headingId: 'motion-scene-chair-title',
    copyPlacement: 'right',
    range: [0.28, 0.43],
    mobilePhase: 'enter',
    camera: { x: -18, y: 0, z: 24, rotationY: -4 },
    safeZone: {
      desktop: 'copy-right-x54-100; subject-centre-x41-53',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('chair'),
    media: {
      videoOwner: true,
      posterOwner: 'chair',
      slot: 'chair-action',
      humanAction: true,
      forward: 'play-on-entry',
      reverse: 'stable-frame',
      stableStart: 'first-frame',
      stableEnd: 'last-frame',
      preload: 'active-and-next',
      desktopPoster: '/images/freshcut/freshcut-barber.webp',
      mobilePoster: '/images/freshcut/freshcut-barber.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center 34%',
      mobileCrop: 'center 32%',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['chair-line', 'persistent-booking'],
    transitionIn: 'chair-foreground-wipe',
    transitionOut: 'barber-right-occlusion',
    controls: SHARED_CONTROLS,
    reducedMotion: 'static-chair-panel',
    fallback: 'chair-stable-frame',
    verification: 'pending',
  },
  {
    id: 'craft',
    label: 'Hantverket',
    anchorId: 'motion-scene-craft',
    headingId: 'motion-scene-craft-title',
    copyPlacement: 'left',
    range: [0.43, 0.6],
    mobilePhase: 'craft',
    camera: { x: 12, y: -1, z: 30, rotationY: 5 },
    safeZone: {
      desktop: 'copy-left-x0-46; hands-tools-centre-x47-66',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('craft'),
    media: {
      videoOwner: true,
      posterOwner: 'craft',
      slot: 'craft-action',
      humanAction: true,
      forward: 'play-on-entry',
      reverse: 'stable-frame',
      stableStart: 'first-frame',
      stableEnd: 'last-frame',
      preload: 'active-and-next',
      desktopPoster: '/images/freshcut/freshcut-barber.webp',
      mobilePoster: '/images/freshcut/freshcut-barber.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center 34%',
      mobileCrop: 'center 32%',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['craft-line', 'service-context', 'persistent-booking'],
    transitionIn: 'barber-right-occlusion',
    transitionOut: 'service-panel-mask',
    controls: SHARED_CONTROLS,
    reducedMotion: 'static-craft-editorial',
    fallback: 'craft-stable-frame',
    verification: 'pending',
  },
  {
    id: 'range',
    label: 'Utbudet',
    anchorId: 'motion-scene-range',
    headingId: 'motion-scene-range-title',
    copyPlacement: 'left',
    range: [0.6, 0.76],
    mobilePhase: 'craft',
    camera: { x: 0, y: 0, z: 26, rotationY: 0 },
    safeZone: {
      desktop: 'copy-left-x0-46; panels-centre-right-x47-100',
      mobile: 'critical-x41-59-y12-58; one-panel-centre; copy-below-y62',
    },
    layers: sceneLayers('range'),
    media: {
      videoOwner: false,
      posterOwner: 'range',
      slot: 'range-editorial',
      humanAction: false,
      forward: 'hold',
      reverse: 'stable-frame',
      stableStart: 'poster',
      stableEnd: 'poster',
      preload: 'nearby',
      desktopPoster: '/images/freshcut/freshcut-2.webp',
      mobilePoster: '/images/freshcut/freshcut-2.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center',
      mobileCrop: 'center',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['service-categories', 'service-list', 'persistent-booking'],
    transitionIn: 'alternating-panel-mask',
    transitionOut: 'panels-return-to-centre',
    controls: [...SHARED_CONTROLS, 'service-categories'],
    reducedMotion: 'static-service-range',
    fallback: 'approved-service-stills',
    verification: 'pending',
  },
  {
    id: 'return',
    label: 'Tillbaka',
    anchorId: 'motion-scene-return',
    headingId: 'motion-scene-return-title',
    copyPlacement: 'right',
    range: [0.76, 0.88],
    mobilePhase: 'result',
    camera: { x: 0, y: 0, z: 20, rotationY: 0 },
    safeZone: {
      desktop: 'copy-right-x54-100; customer-centre-x41-53',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('return'),
    media: {
      videoOwner: false,
      posterOwner: 'craft',
      slot: 'main-customer-hold',
      humanAction: false,
      forward: 'hold',
      reverse: 'stable-frame',
      stableStart: 'poster',
      stableEnd: 'poster',
      preload: 'active-and-next',
      desktopPoster: '/images/freshcut/freshcut-barber.webp',
      mobilePoster: '/images/freshcut/freshcut-barber.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center 28%',
      mobileCrop: 'center 24%',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['selected-service', 'persistent-booking'],
    transitionIn: 'panels-return-to-centre',
    transitionOut: 'mirror-frame-wipe',
    controls: SHARED_CONTROLS,
    reducedMotion: 'static-main-customer-result',
    fallback: 'main-customer-stable-frame',
    verification: 'pending',
  },
  {
    id: 'mirror',
    label: 'Resultatet',
    anchorId: 'motion-scene-mirror',
    headingId: 'motion-scene-mirror-title',
    copyPlacement: 'right',
    range: [0.88, 0.95],
    mobilePhase: 'result',
    camera: { x: 0, y: 0, z: 12, rotationY: 0 },
    safeZone: {
      desktop: 'mirror-left-x0-53; copy-right-x54-100',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('mirror', { mirrorFrame: true }),
    media: {
      videoOwner: true,
      posterOwner: 'mirror',
      slot: 'mirror-result',
      humanAction: true,
      forward: 'play-on-entry',
      reverse: 'stable-frame',
      stableStart: 'first-frame',
      stableEnd: 'last-frame',
      preload: 'active-and-next',
      desktopPoster: '/images/freshcut/freshcut-3.webp',
      mobilePoster: '/images/freshcut/freshcut-3.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center 28%',
      mobileCrop: 'center 24%',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['popular-services', 'locations', 'booking-actions', 'all-services'],
    transitionIn: 'mirror-frame-wipe',
    transitionOut: 'mirror-side-pan',
    controls: [...SHARED_CONTROLS, 'locations', 'continue-about'],
    reducedMotion: 'static-mirror-booking-hub',
    fallback: 'mirror-poster-with-booking-hub',
    verification: 'pending',
  },
  {
    id: 'team',
    label: 'Om oss',
    anchorId: 'motion-scene-team',
    headingId: 'motion-scene-team-title',
    copyPlacement: 'left',
    range: [0.95, 1],
    mobilePhase: 'result',
    camera: { x: 22, y: 0, z: 8, rotationY: 6 },
    safeZone: {
      desktop: 'copy-left-x0-46; team-centre-right-x47-100',
      mobile: 'critical-x41-59-y12-58; copy-below-y62',
    },
    layers: sceneLayers('team'),
    media: {
      videoOwner: false,
      posterOwner: 'team',
      slot: 'team-editorial',
      humanAction: false,
      forward: 'hold',
      reverse: 'stable-frame',
      stableStart: 'poster',
      stableEnd: 'poster',
      preload: 'nearby',
      desktopPoster: '/images/freshcut/freshcut-4.webp',
      mobilePoster: '/images/freshcut/freshcut-4.webp',
      desktopWebm: null,
      desktopMp4: null,
      mobileWebm: null,
      mobileMp4: null,
      desktopCrop: 'center',
      mobileCrop: 'center',
      sourceStatus: 'repository-controlled-fallback',
      rightsStatus: 'ai-transformation-pending',
    },
    dom: ['about', 'locations', 'contact', 'persistent-booking'],
    transitionIn: 'mirror-side-pan',
    transitionOut: 'release-to-document',
    controls: ['checkpoints', 'locations', 'contact', 'book'],
    reducedMotion: 'static-team-about',
    fallback: 'approved-team-or-salon-still',
    verification: 'pending',
  },
] as const satisfies readonly FreshCutMotionScene[]

const VERSIONED_MEDIA_BASE =
  /^\/media\/freshcut-motion\/([a-z0-9][a-z0-9-]*-v[1-9]\d*-[a-f0-9]{12})\/\1-desktop\.webm$/
const VERSIONED_POSTER_BASE =
  /^\/media\/freshcut-motion\/([a-z0-9][a-z0-9-]*-v[1-9]\d*-[a-f0-9]{12})\/\1-desktop-poster\.webp$/
const CONTROLLED_FALLBACK_POSTER = /^\/images\/freshcut\/[a-z0-9][a-z0-9-]*\.webp$/

export const FRESHCUT_MOTION_VIDEO_OWNERS = [
  'entrance',
  'chair',
  'craft',
  'mirror',
] as const satisfies readonly FreshCutMotionSceneId[]

const VIDEO_OWNER_IDS = new Set<FreshCutMotionSceneId>(FRESHCUT_MOTION_VIDEO_OWNERS)

export type FreshCutMotionVideoSources = {
  desktopWebm: string
  desktopMp4: string
  mobileWebm: string
  mobileMp4: string
}

export type FreshCutMotionPosters = {
  desktopPoster: string
  mobilePoster: string
}

function hasAnyVideoSource(media: FreshCutMotionMediaPolicy): boolean {
  return Boolean(media.desktopWebm || media.desktopMp4 || media.mobileWebm || media.mobileMp4)
}

/**
 * Fail-closed responsive poster gate shared by approved and synthetic families.
 */
export function validatedFreshCutMotionPosters(
  media: FreshCutMotionMediaPolicy,
  sceneId: FreshCutMotionSceneId,
): FreshCutMotionPosters | null {
  const expectedPosterOwner = sceneId === 'return' ? 'craft' : sceneId
  if (media.posterOwner !== expectedPosterOwner) return null

  const hasVideoSource = hasAnyVideoSource(media)
  if (media.sourceStatus === 'repository-controlled-fallback') {
    if (
      media.rightsStatus !== 'ai-transformation-pending' ||
      hasVideoSource ||
      !CONTROLLED_FALLBACK_POSTER.test(media.desktopPoster) ||
      !CONTROLLED_FALLBACK_POSTER.test(media.mobilePoster)
    ) {
      return null
    }
    return {
      desktopPoster: media.desktopPoster,
      mobilePoster: media.mobilePoster,
    }
  }

  const synthetic =
    media.sourceStatus === 'generated-demo' && media.rightsStatus === 'synthetic-text-only'
  const approved =
    media.sourceStatus === 'approved-final' &&
    media.rightsStatus === 'approved-for-ai-transformation'
  if (!synthetic && !approved) return null

  const family = media.desktopPoster.match(VERSIONED_POSTER_BASE)?.[1]
  const base =
    family && family.startsWith(`${media.posterOwner}-v`)
      ? `/media/freshcut-motion/${family}/${family}`
      : null
  if (!base || media.mobilePoster !== `${base}-mobile-poster.webp`) return null

  return {
    desktopPoster: media.desktopPoster,
    mobilePoster: media.mobilePoster,
  }
}

/** Fail-closed video gate: either valid provenance pair may play for the four owners. */
export function validatedFreshCutMotionVideoSources(
  media: FreshCutMotionMediaPolicy,
  sceneId: FreshCutMotionSceneId,
): FreshCutMotionVideoSources | null {
  if (
    !media.videoOwner ||
    !VIDEO_OWNER_IDS.has(sceneId) ||
    media.posterOwner !== sceneId ||
    !(
      (media.sourceStatus === 'approved-final' &&
        media.rightsStatus === 'approved-for-ai-transformation') ||
      (media.sourceStatus === 'generated-demo' && media.rightsStatus === 'synthetic-text-only')
    ) ||
    !validatedFreshCutMotionPosters(media, sceneId) ||
    !media.desktopWebm ||
    !media.desktopMp4 ||
    !media.mobileWebm ||
    !media.mobileMp4
  ) {
    return null
  }
  const family = media.desktopWebm.match(VERSIONED_MEDIA_BASE)?.[1]
  const base =
    family && family.startsWith(`${sceneId}-v`)
      ? `/media/freshcut-motion/${family}/${family}`
      : null
  if (
    !base ||
    media.desktopMp4 !== `${base}-desktop.mp4` ||
    media.mobileWebm !== `${base}-mobile.webm` ||
    media.mobileMp4 !== `${base}-mobile.mp4` ||
    media.desktopPoster !== `${base}-desktop-poster.webp` ||
    media.mobilePoster !== `${base}-mobile-poster.webp`
  ) {
    return null
  }
  return {
    desktopWebm: media.desktopWebm,
    desktopMp4: media.desktopMp4,
    mobileWebm: media.mobileWebm,
    mobileMp4: media.mobileMp4,
  }
}

const SCROLL_DISTANCE_VH: Record<FreshCutMotionViewport, number> = {
  desktop: 120,
  mobile: 90,
}

function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

export function motionSceneForProgress(progress: number): FreshCutMotionScene {
  const clamped = clampProgress(progress)
  return (
    FRESHCUT_MOTION_SCENES.find(
      (scene, index) =>
        clamped >= scene.range[0] &&
        (clamped < scene.range[1] || index === FRESHCUT_MOTION_SCENES.length - 1),
    ) ?? FRESHCUT_MOTION_SCENES[0]
  )
}

export function motionSceneTarget(sceneId: FreshCutMotionSceneId): number {
  return FRESHCUT_MOTION_SCENES.find((scene) => scene.id === sceneId)?.range[0] ?? 0
}

export function motionMobilePhaseForScene(
  sceneId: FreshCutMotionSceneId,
): FreshCutMotionMobilePhase {
  return FRESHCUT_MOTION_SCENES.find((scene) => scene.id === sceneId)?.mobilePhase ?? 'enter'
}

export function motionScrollDistanceVh(viewport: FreshCutMotionViewport): number {
  return SCROLL_DISTANCE_VH[viewport]
}

export function validateFreshCutMotionScenes(scenes: readonly FreshCutMotionScene[]): string[] {
  const errors: string[] = []
  const ids = new Set<FreshCutMotionSceneId>()
  const anchors = new Set<string>()
  const headings = new Set<string>()

  if (scenes.length === 0) return ['scene map must not be empty']
  if (scenes[0]?.range[0] !== 0) errors.push('first scene must start at 0')

  scenes.forEach((scene, index) => {
    const [start, end] = scene.range
    if (ids.has(scene.id)) errors.push(`scene id ${scene.id} must be unique`)
    ids.add(scene.id)
    if (anchors.has(scene.anchorId)) {
      errors.push(`scene anchor ${scene.anchorId} must be unique`)
    }
    anchors.add(scene.anchorId)
    if (headings.has(scene.headingId)) {
      errors.push(`scene heading ${scene.headingId} must be unique`)
    }
    headings.add(scene.headingId)
    if (start < 0 || end > 1 || start >= end) {
      errors.push(`${scene.id} has an invalid range (${start}–${end})`)
    }
    const next = scenes[index + 1]
    if (next && end !== next.range[0]) {
      errors.push(`${scene.id} must end where ${next.id} starts (${end} !== ${next.range[0]})`)
    }
    if (scene.media.humanAction && scene.media.forward !== 'play-on-entry') {
      errors.push(`${scene.id} human action must play on entry`)
    }
    if (scene.media.humanAction && scene.media.reverse !== 'stable-frame') {
      errors.push(`${scene.id} human action must use a stable frame in reverse`)
    }
    if (
      scene.media.videoOwner &&
      (scene.media.forward !== 'play-on-entry' || scene.media.reverse !== 'stable-frame')
    ) {
      errors.push(`${scene.id} video owner must play on entry and use a stable reverse frame`)
    }
    if (
      !scene.media.videoOwner &&
      (scene.media.forward !== 'hold' || scene.media.reverse !== 'stable-frame')
    ) {
      errors.push(`${scene.id} still-only scene must hold one stable poster`)
    }
    if (!scene.media.stableStart || !scene.media.stableEnd) {
      errors.push(`${scene.id} must define stable media start and end frames`)
    }
    const layerTokens = new Set<string>()
    let mediaLayerCount = 0
    const layerDepths = new Set<number>()
    for (const layer of scene.layers) {
      if (layerTokens.has(layer.token)) {
        errors.push(`${scene.id} layer token ${layer.token} must be unique`)
      }
      layerTokens.add(layer.token)
      if (!layer.token.startsWith(`${scene.id}-`)) {
        errors.push(`${scene.id} layer token ${layer.token} must be scene-owned`)
      }
      if (layer.kind === 'media') mediaLayerCount += 1
      if (!Number.isFinite(layer.depthFactor) || layer.depthFactor < 0 || layer.depthFactor > 1) {
        errors.push(`${scene.id} layer ${layer.token} must have a finite depth factor from 0 to 1`)
      }
      layerDepths.add(layer.depthFactor)
    }
    if (mediaLayerCount !== 1) errors.push(`${scene.id} must own exactly one media layer`)
    if (layerDepths.size < 2)
      errors.push(`${scene.id} must define at least two distinct layer depths`)
    const hasVideoSource = hasAnyVideoSource(scene.media)
    const requiresPublishedVideo =
      scene.media.videoOwner && scene.media.sourceStatus !== 'repository-controlled-fallback'
    if (!scene.media.videoOwner && hasVideoSource) {
      errors.push(`${scene.id} still-only scene must not declare video sources`)
    }
    if (
      scene.media.sourceStatus === 'repository-controlled-fallback' &&
      !validatedFreshCutMotionPosters(scene.media, scene.id)
    ) {
      errors.push(
        `${scene.id} repository fallback must use a controlled fallback image without video sources`,
      )
    } else if (!validatedFreshCutMotionPosters(scene.media, scene.id)) {
      errors.push(`${scene.id} media must use one valid responsive poster family`)
    }
    if (
      (hasVideoSource || requiresPublishedVideo) &&
      !validatedFreshCutMotionVideoSources(scene.media, scene.id)
    ) {
      errors.push(`${scene.id} playable media must use one local versioned WebM and MP4 source-set`)
    }
    if (!scene.reducedMotion || !scene.fallback) {
      errors.push(`${scene.id} must define reduced-motion and fallback states`)
    }
  })

  const videoOwners = scenes.filter((scene) => scene.media.videoOwner).map((scene) => scene.id)
  if (
    videoOwners.length !== FRESHCUT_MOTION_VIDEO_OWNERS.length ||
    videoOwners.some((sceneId, index) => sceneId !== FRESHCUT_MOTION_VIDEO_OWNERS[index])
  ) {
    errors.push('video owners must be exactly entrance, chair, craft and mirror')
  }

  const craft = scenes.find((scene) => scene.id === 'craft')
  const returnScene = scenes.find((scene) => scene.id === 'return')
  if (
    !craft ||
    !returnScene ||
    returnScene.media.posterOwner !== 'craft' ||
    returnScene.media.desktopPoster !== craft.media.desktopPoster ||
    returnScene.media.mobilePoster !== craft.media.mobilePoster
  ) {
    errors.push('return must reuse craft responsive poster URLs exactly')
  }

  if (scenes.at(-1)?.range[1] !== 1) errors.push('last scene must end at 1')
  return errors
}
