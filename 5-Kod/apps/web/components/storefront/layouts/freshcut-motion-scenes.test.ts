import { describe, expect, it } from 'vitest'
import {
  FRESHCUT_MOTION_SCENES,
  motionSceneForProgress,
  motionSceneTarget,
  motionScrollDistanceVh,
  motionMobilePhaseForScene,
  validatedFreshCutMotionVideoSources,
  validateFreshCutMotionScenes,
} from './freshcut-motion-scenes'

describe('FreshCut production motion scene map', () => {
  it.each([
    [-1, 'hero'],
    [Number.NaN, 'hero'],
    [0, 'hero'],
    [0.119, 'hero'],
    [0.12, 'entrance'],
    [0.279, 'entrance'],
    [0.28, 'chair'],
    [0.429, 'chair'],
    [0.43, 'craft'],
    [0.599, 'craft'],
    [0.6, 'range'],
    [0.759, 'range'],
    [0.76, 'return'],
    [0.879, 'return'],
    [0.88, 'mirror'],
    [0.949, 'mirror'],
    [0.95, 'team'],
    [1, 'team'],
    [4, 'team'],
  ] as const)('maps progress %s to the stable %s scene', (progress, expected) => {
    expect(motionSceneForProgress(progress).id).toBe(expected)
  })

  it('provides direct stable targets without replaying earlier scenes', () => {
    expect(motionSceneTarget('hero')).toBe(0)
    expect(motionSceneTarget('chair')).toBe(0.28)
    expect(motionSceneTarget('range')).toBe(0.6)
    expect(motionSceneTarget('mirror')).toBe(0.88)
    expect(motionSceneTarget('team')).toBe(0.95)
  })

  it('owns unique stable anchor and heading destinations for every scene', () => {
    expect(FRESHCUT_MOTION_SCENES.map((scene) => scene.anchorId)).toEqual([
      'motion-scene-hero',
      'motion-scene-entrance',
      'motion-scene-chair',
      'motion-scene-craft',
      'motion-scene-range',
      'motion-scene-return',
      'motion-scene-mirror',
      'motion-scene-team',
    ])
    expect(new Set(FRESHCUT_MOTION_SCENES.map((scene) => scene.headingId)).size).toBe(8)
  })

  it('defines responsive safe zones and honest repository fallbacks before final media exists', () => {
    for (const scene of FRESHCUT_MOTION_SCENES) {
      expect(scene.safeZone.desktop).not.toBe('')
      expect(scene.safeZone.mobile).not.toBe('')
      expect(scene.media.poster).toMatch(/^\/images\/freshcut\/.+\.webp$/)
      expect(scene.media.desktopWebm).toBeNull()
      expect(scene.media.desktopMp4).toBeNull()
      expect(scene.media.mobileWebm).toBeNull()
      expect(scene.media.mobileMp4).toBeNull()
      expect(scene.media.sourceStatus).toBe('repository-controlled-fallback')
      expect(scene.media.rightsStatus).toBe('ai-transformation-pending')
    }
  })

  it('declares an explicit stable start and end frame for every media slot', () => {
    expect(
      FRESHCUT_MOTION_SCENES.map((scene) => [
        scene.id,
        scene.media.stableStart,
        scene.media.stableEnd,
      ]),
    ).toEqual([
      ['hero', 'poster', 'poster'],
      ['entrance', 'first-frame', 'last-frame'],
      ['chair', 'first-frame', 'last-frame'],
      ['craft', 'first-frame', 'last-frame'],
      ['range', 'first-frame', 'last-frame'],
      ['return', 'poster', 'poster'],
      ['mirror', 'first-frame', 'last-frame'],
      ['team', 'first-frame', 'last-frame'],
    ])
  })

  it('defines projection-ready real layers with one media owner and distinct finite depths', () => {
    type ProjectedLayer = {
      token: string
      kind: 'media' | 'side-scrim' | 'bottom-scrim' | 'mirror-frame'
      depthFactor: number
    }

    for (const scene of FRESHCUT_MOTION_SCENES) {
      const layers = scene.layers as unknown as readonly ProjectedLayer[]
      const tokens = layers.map((layer) => layer.token)
      const depths = layers.map((layer) => layer.depthFactor)

      expect(layers.filter((layer) => layer.kind === 'media')).toHaveLength(1)
      expect(new Set(tokens).size).toBe(layers.length)
      expect(tokens.every((token) => token.startsWith(`${scene.id}-`))).toBe(true)
      expect(depths.every((depth) => Number.isFinite(depth) && depth >= 0 && depth <= 1)).toBe(true)
      expect(new Set(depths).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('groups the same canonical scenes into the three intentional mobile phases', () => {
    expect(
      FRESHCUT_MOTION_SCENES.map((scene) => [scene.id, motionMobilePhaseForScene(scene.id)]),
    ).toEqual([
      ['hero', 'enter'],
      ['entrance', 'enter'],
      ['chair', 'enter'],
      ['craft', 'craft'],
      ['range', 'craft'],
      ['return', 'result'],
      ['mirror', 'result'],
      ['team', 'result'],
    ])
  })

  it('keeps both controlled journeys inside the accepted scroll budget', () => {
    expect(motionScrollDistanceVh('desktop')).toBe(120)
    expect(motionScrollDistanceVh('mobile')).toBe(90)
    expect(motionScrollDistanceVh('desktop')).toBeGreaterThanOrEqual(100)
    expect(motionScrollDistanceVh('desktop')).toBeLessThanOrEqual(130)
    expect(motionScrollDistanceVh('mobile')).toBeLessThanOrEqual(100)
  })

  it('has no gap, overlap, missing stable state or backward human playback', () => {
    expect(validateFreshCutMotionScenes(FRESHCUT_MOTION_SCENES)).toEqual([])
    expect(
      FRESHCUT_MOTION_SCENES.filter((scene) => scene.media.humanAction).map((scene) => [
        scene.id,
        scene.media.forward,
        scene.media.reverse,
      ]),
    ).toEqual([
      ['chair', 'play-on-entry', 'stable-frame'],
      ['craft', 'play-on-entry', 'stable-frame'],
      ['mirror', 'play-on-entry', 'stable-frame'],
    ])
  })

  it('rejects a scene map whose ranges stop being continuous', () => {
    const broken = FRESHCUT_MOTION_SCENES.map((scene) => ({
      ...scene,
      range: scene.id === 'craft' ? ([0.44, 0.6] as const) : scene.range,
    }))

    expect(validateFreshCutMotionScenes(broken)).toContain(
      'chair must end where craft starts (0.43 !== 0.44)',
    )
  })

  it('rejects duplicate anchor or heading destinations', () => {
    const broken = FRESHCUT_MOTION_SCENES.map((scene) => ({
      ...scene,
      anchorId: scene.id === 'entrance' ? FRESHCUT_MOTION_SCENES[0].anchorId : scene.anchorId,
      headingId: scene.id === 'chair' ? FRESHCUT_MOTION_SCENES[0].headingId : scene.headingId,
    }))

    expect(validateFreshCutMotionScenes(broken)).toContain(
      'scene anchor motion-scene-hero must be unique',
    )
    expect(validateFreshCutMotionScenes(broken)).toContain(
      'scene heading motion-scene-hero-title must be unique',
    )
  })

  it('accepts the FFmpeg source-set and versioned poster as one approved local asset family', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      poster: `${base}-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      desktopMp4: `${base}-desktop.mp4`,
      mobileWebm: `${base}-mobile.webm`,
      mobileMp4: `${base}-mobile.mp4`,
      sourceStatus: 'approved-final' as const,
      rightsStatus: 'approved-for-ai-transformation' as const,
    }

    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toEqual({
      desktopWebm: media.desktopWebm,
      desktopMp4: media.desktopMp4,
      mobileWebm: media.mobileWebm,
      mobileMp4: media.mobileMp4,
    })
  })

  it('accepts one honestly labelled synthetic demo family without calling it approved final', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      poster: `${base}-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      desktopMp4: `${base}-desktop.mp4`,
      mobileWebm: `${base}-mobile.webm`,
      mobileMp4: `${base}-mobile.mp4`,
      sourceStatus: 'generated-demo' as const,
      rightsStatus: 'synthetic-text-only' as const,
    }

    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toEqual({
      desktopWebm: media.desktopWebm,
      desktopMp4: media.desktopMp4,
      mobileWebm: media.mobileWebm,
      mobileMp4: media.mobileMp4,
    })
  })

  it('rejects crossed source and rights provenance even when the source family is complete', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      poster: `${base}-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      desktopMp4: `${base}-desktop.mp4`,
      mobileWebm: `${base}-mobile.webm`,
      mobileMp4: `${base}-mobile.mp4`,
      sourceStatus: 'generated-demo' as const,
      rightsStatus: 'approved-for-ai-transformation' as const,
    }

    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toBeNull()
  })

  it('rejects an approved source-set paired with a generic fallback poster', () => {
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      desktopWebm: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop.webm',
      desktopMp4: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop.mp4',
      mobileWebm: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile.webm',
      mobileMp4: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile.mp4',
      sourceStatus: 'approved-final' as const,
      rightsStatus: 'approved-for-ai-transformation' as const,
    }

    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toBeNull()
  })

  it('rejects a flat published family instead of the atomic nested family directory', () => {
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      poster: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-poster.webp',
      desktopWebm: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop.webm',
      desktopMp4: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop.mp4',
      mobileWebm: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile.webm',
      mobileMp4: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile.mp4',
      sourceStatus: 'approved-final' as const,
      rightsStatus: 'approved-for-ai-transformation' as const,
    }

    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toBeNull()
  })

  it('rejects an otherwise valid approved family whose prefix belongs to another scene', () => {
    const family = '/media/freshcut-motion/craft-v1-a1b2c3d4e5f6'
    const base = `${family}/craft-v1-a1b2c3d4e5f6`
    const broken = FRESHCUT_MOTION_SCENES.map((scene) =>
      scene.id === 'entrance'
        ? {
            ...scene,
            media: {
              ...scene.media,
              poster: `${base}-poster.webp` as const,
              desktopWebm: `${base}-desktop.webm` as const,
              desktopMp4: `${base}-desktop.mp4` as const,
              mobileWebm: `${base}-mobile.webm` as const,
              mobileMp4: `${base}-mobile.mp4` as const,
              sourceStatus: 'approved-final' as const,
              rightsStatus: 'approved-for-ai-transformation' as const,
            },
          }
        : scene,
    )

    expect(validateFreshCutMotionScenes(broken)).toContain(
      'entrance playable media must use one local versioned WebM and MP4 source-set',
    )
  })

  it('keeps repository fallback state on controlled fallback images without video sources', () => {
    const broken = FRESHCUT_MOTION_SCENES.map((scene) =>
      scene.id === 'hero'
        ? {
            ...scene,
            media: {
              ...scene.media,
              poster: '/media/freshcut-motion/hero-v1-a1b2c3d4e5f6-poster.webp' as const,
            },
          }
        : scene,
    )

    expect(validateFreshCutMotionScenes(broken)).toContain(
      'hero repository fallback must use a controlled fallback image without video sources',
    )
  })

  it('rejects final video source-sets that are incomplete, remote or not one asset family', () => {
    const broken = FRESHCUT_MOTION_SCENES.map((scene) =>
      scene.id === 'entrance'
        ? {
            ...scene,
            media: {
              ...scene.media,
              poster: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-poster.webp' as const,
              desktopWebm: 'https://cdn.example/entrance.webm',
              desktopMp4: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop.mp4',
              mobileWebm: '/media/freshcut-motion/different-v1-a1b2c3d4e5f6-mobile.webm',
              mobileMp4: null,
              sourceStatus: 'approved-final' as const,
              rightsStatus: 'approved-for-ai-transformation' as const,
            },
          }
        : scene,
    )

    expect(validateFreshCutMotionScenes(broken)).toContain(
      'entrance playable media must use one local versioned WebM and MP4 source-set',
    )
  })
})
