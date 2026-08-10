import { describe, expect, it } from 'vitest'
import {
  FRESHCUT_MOTION_SCENES,
  type FreshCutMotionScene,
  motionSceneForProgress,
  motionSceneTarget,
  motionScrollDistanceVh,
  motionMobilePhaseForScene,
  validatedFreshCutMotionPosters,
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
      expect(scene.media.desktopPoster).toMatch(/^\/images\/freshcut\/.+\.webp$/)
      expect(scene.media.mobilePoster).toMatch(/^\/images\/freshcut\/.+\.webp$/)
      expect(scene.media.desktopWebm).toBeNull()
      expect(scene.media.desktopMp4).toBeNull()
      expect(scene.media.mobileWebm).toBeNull()
      expect(scene.media.mobileMp4).toBeNull()
      expect(scene.media.sourceStatus).toBe('repository-controlled-fallback')
      expect(scene.media.rightsStatus).toBe('ai-transformation-pending')
    }
  })

  it('has exactly four potential video owners and keeps every editorial scene still-only', () => {
    expect(
      FRESHCUT_MOTION_SCENES.filter((scene) => scene.media.videoOwner).map((scene) => scene.id),
    ).toEqual(['entrance', 'chair', 'craft', 'mirror'])
    expect(
      FRESHCUT_MOTION_SCENES.filter((scene) => !scene.media.videoOwner).map((scene) => scene.id),
    ).toEqual(['hero', 'range', 'return', 'team'])

    for (const scene of FRESHCUT_MOTION_SCENES.filter((candidate) => !candidate.media.videoOwner)) {
      expect(scene.media.forward).toBe('hold')
      expect(scene.media.reverse).toBe('stable-frame')
      expect([
        scene.media.desktopWebm,
        scene.media.desktopMp4,
        scene.media.mobileWebm,
        scene.media.mobileMp4,
      ]).toEqual([null, null, null, null])
    }
  })

  it('plays Entrance once on entry and resolves reverse travel to a stable frame', () => {
    const entrance = FRESHCUT_MOTION_SCENES.find((scene) => scene.id === 'entrance')!

    expect(entrance.media.forward).toBe('play-on-entry')
    expect(entrance.media.reverse).toBe('stable-frame')
  })

  it('reuses the Craft K3 posters for Return without introducing another fetch target', () => {
    const craft = FRESHCUT_MOTION_SCENES.find((scene) => scene.id === 'craft')!
    const returnScene = FRESHCUT_MOTION_SCENES.find((scene) => scene.id === 'return')!

    expect(returnScene.media.posterOwner).toBe('craft')
    expect(returnScene.media.desktopPoster).toBe(craft.media.desktopPoster)
    expect(returnScene.media.mobilePoster).toBe(craft.media.mobilePoster)
  })

  it('locks DOM copy placement and the narrow mobile subject corridor before generation', () => {
    expect(FRESHCUT_MOTION_SCENES.map((scene) => [scene.id, scene.copyPlacement])).toEqual([
      ['hero', 'left'],
      ['entrance', 'left'],
      ['chair', 'right'],
      ['craft', 'left'],
      ['range', 'left'],
      ['return', 'right'],
      ['mirror', 'right'],
      ['team', 'left'],
    ])

    for (const scene of FRESHCUT_MOTION_SCENES) {
      expect(scene.safeZone.mobile).toContain('critical-x41-59-y12-58')
      expect(scene.media.mobileCrop.split(' ')[0]).toBe('center')
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
      ['range', 'poster', 'poster'],
      ['return', 'poster', 'poster'],
      ['mirror', 'first-frame', 'last-frame'],
      ['team', 'poster', 'poster'],
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
      FRESHCUT_MOTION_SCENES.filter((scene) => scene.media.videoOwner).map((scene) => [
        scene.id,
        scene.media.forward,
        scene.media.reverse,
      ]),
    ).toEqual([
      ['entrance', 'play-on-entry', 'stable-frame'],
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

  it('fails closed when ownership, still-only delivery or Craft-to-Return reuse drifts', () => {
    const broken = FRESHCUT_MOTION_SCENES.map((scene) => {
      if (scene.id === 'hero') {
        return {
          ...scene,
          media: { ...scene.media, videoOwner: true },
        }
      }
      if (scene.id === 'range') {
        return {
          ...scene,
          media: { ...scene.media, desktopWebm: '/media/freshcut-motion/range.webm' },
        }
      }
      if (scene.id === 'return') {
        return {
          ...scene,
          media: { ...scene.media, mobilePoster: '/images/freshcut/freshcut-3.webp' },
        }
      }
      return scene
    }) as unknown as readonly FreshCutMotionScene[]

    expect(validateFreshCutMotionScenes(broken)).toEqual(
      expect.arrayContaining([
        'video owners must be exactly entrance, chair, craft and mirror',
        'range still-only scene must not declare video sources',
        'return must reuse craft responsive poster URLs exactly',
      ]),
    )
  })

  it('accepts the FFmpeg source-set and versioned poster as one approved local asset family', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      desktopPoster: `${base}-desktop-poster.webp`,
      mobilePoster: `${base}-mobile-poster.webp`,
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

  it('accepts one honestly labelled synthetic demo video family for a video owner', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      desktopPoster: `${base}-desktop-poster.webp`,
      mobilePoster: `${base}-mobile-poster.webp`,
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
    expect(validatedFreshCutMotionPosters(media, 'entrance')).toEqual({
      desktopPoster: media.desktopPoster,
      mobilePoster: media.mobilePoster,
    })
    const scenes = FRESHCUT_MOTION_SCENES.map((scene) =>
      scene.id === 'entrance' ? { ...scene, media } : scene,
    ) as unknown as readonly FreshCutMotionScene[]
    expect(validateFreshCutMotionScenes(scenes)).toEqual([])
  })

  it('fails closed when a synthetic demo video family is incomplete', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      desktopPoster: `${base}-desktop-poster.webp`,
      mobilePoster: `${base}-mobile-poster.webp`,
      desktopWebm: `${base}-desktop.webm`,
      sourceStatus: 'generated-demo' as const,
      rightsStatus: 'synthetic-text-only' as const,
    }

    expect(validatedFreshCutMotionPosters(media, 'entrance')).toEqual({
      desktopPoster: media.desktopPoster,
      mobilePoster: media.mobilePoster,
    })
    expect(validatedFreshCutMotionVideoSources(media, 'entrance')).toBeNull()

    const broken = FRESHCUT_MOTION_SCENES.map((scene) =>
      scene.id === 'entrance' ? { ...scene, media } : scene,
    ) as unknown as readonly FreshCutMotionScene[]
    expect(validateFreshCutMotionScenes(broken)).toContain(
      'entrance playable media must use one local versioned WebM and MP4 source-set',
    )
  })

  it('rejects crossed source and rights provenance even when the source family is complete', () => {
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const media = {
      ...FRESHCUT_MOTION_SCENES[1].media,
      desktopPoster: `${base}-desktop-poster.webp`,
      mobilePoster: `${base}-mobile-poster.webp`,
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
      desktopPoster: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop-poster.webp',
      mobilePoster: '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile-poster.webp',
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
              desktopPoster: `${base}-desktop-poster.webp` as const,
              mobilePoster: `${base}-mobile-poster.webp` as const,
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
              desktopPoster:
                '/media/freshcut-motion/hero-v1-a1b2c3d4e5f6-desktop-poster.webp' as const,
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
              desktopPoster:
                '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-desktop-poster.webp' as const,
              mobilePoster:
                '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6-mobile-poster.webp' as const,
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
