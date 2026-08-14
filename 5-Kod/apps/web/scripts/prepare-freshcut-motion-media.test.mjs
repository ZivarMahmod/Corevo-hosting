import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FRESHCUT_MOTION_BYTE_BUDGETS,
  assertPreparedMediaProbe,
  assertPreparedPosterProbe,
  buildFreshCutMotionMediaPlan,
  buildFreshCutMotionMediaCommands,
  executeFreshCutMotionMediaPlan,
} from './prepare-freshcut-motion-media.mjs'

const SOURCE_HASH = 'a'.repeat(64)
const EXPECTED_PIPELINE_VERSION = 'freshcut-motion-ffmpeg-v4'
const scratchDirectories = []

function scratchDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'freshcut-motion-media-'))
  scratchDirectories.push(directory)
  return directory
}

function planInput(overrides = {}) {
  return {
    sceneId: 'craft',
    inputPath: 'C:/raw/craft-source.mp4',
    outputDir: 'C:/public/media/freshcut-motion',
    version: 'v1',
    sourceHash: SOURCE_HASH,
    trimStartSeconds: 0.4,
    trimEndSeconds: 5.8,
    holdStartSeconds: 0.25,
    holdEndSeconds: 0.35,
    sourceStatus: 'approved-final',
    rightsStatus: 'approved-for-ai-transformation',
    ...overrides,
  }
}

function videoFrames(gop = 30, count = 181) {
  return Array.from({ length: count }, (_value, index) => ({
    media_type: 'video',
    key_frame: index % gop === 0 ? 1 : 0,
    pict_type: index % gop === 0 ? 'I' : 'P',
  }))
}

function successfulRunner(calls, posterOverrides = {}) {
  return vi.fn((command, args, options = {}) => {
    calls.push({ command, args: [...args], options })
    if (args[0] === '-version') return 'ffmpeg version 7.1.1 Copyright FFmpeg developers\n'
    if (command === 'ffprobe-test') {
      const file = args.at(-1)
      if (String(file).includes('-poster.webp')) {
        const mobile = String(file).includes('-mobile-poster.webp')
        return JSON.stringify({
          streams: [
            {
              codec_type: 'video',
              codec_name: 'webp',
              width: mobile ? 1080 : 1920,
              height: mobile ? 1920 : 1080,
              nb_read_frames: '1',
              ...posterOverrides.stream,
            },
          ],
          format: { size: mobile ? '100000' : '180000', ...posterOverrides.format },
        })
      }
      const mobile = String(file).includes('-mobile.')
      const webm = String(file).endsWith('.webm')
      const size = mobile ? (webm ? 800_000 : 1_100_000) : webm ? 1_400_000 : 1_900_000
      return JSON.stringify({
        streams: [
          {
            codec_type: 'video',
            codec_name: webm ? 'vp9' : 'h264',
            width: mobile ? 1080 : 1920,
            height: mobile ? 1920 : 1080,
            avg_frame_rate: '30/1',
            bit_rate: '2400000',
          },
        ],
        format: {
          duration: '6.0',
          bit_rate: '2400000',
          format_name: webm ? 'matroska,webm' : 'mov,mp4,m4a,3gp,3g2,mj2',
          size: String(size),
        },
        frames: videoFrames(),
      })
    }
    if (command === 'ffmpeg-test' && args.at(-1) === '-') return ''
    const output = args.at(-1)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, 'prepared-media')
    return ''
  })
}

function successfulRunnerWithOversize(calls, suffix, size) {
  const baseRunner = successfulRunner(calls)
  return vi.fn((command, args, options = {}) => {
    const result = baseRunner(command, args, options)
    if (command !== 'ffprobe-test' || !String(args.at(-1)).endsWith(suffix)) return result
    const probe = JSON.parse(result)
    probe.format.size = String(size)
    return JSON.stringify(probe)
  })
}

function executePlan(plan, options = {}) {
  return executeFreshCutMotionMediaPlan(plan, {
    hashSource: () => plan.sourceHash,
    ...options,
  })
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('FreshCut motion media preparation', () => {
  it('derives a nested family identity from the source hash and canonical full recipe', () => {
    const plan = buildFreshCutMotionMediaPlan(planInput())
    const familyDirectory = `C:/public/media/freshcut-motion/${plan.baseName}`

    expect(plan.pipelineVersion).toBe(EXPECTED_PIPELINE_VERSION)
    expect(plan.mediaDelivery).toBe('video')
    expect(plan.provenance).toEqual({
      sourceStatus: 'approved-final',
      rightsStatus: 'approved-for-ai-transformation',
    })
    expect(plan.sourceHash).toBe(SOURCE_HASH)
    expect(plan.familyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(plan.baseName).toBe(`craft-v1-${plan.familyHash.slice(0, 12)}`)
    expect(plan.familyDirectory).toBe(familyDirectory)
    expect(plan.recipe).toEqual({
      trim: { startSeconds: 0.4, endSeconds: 5.8 },
      holds: { startSeconds: 0.25, endSeconds: 0.35 },
      fps: 30,
      dimensions: {
        desktop: { width: 1920, height: 1080 },
        mobile: { width: 1080, height: 1920 },
      },
      filter: {
        colorspace: 'colorspace=all=bt709:iall=bt709:fast=1',
        grade: 'eq=saturation=0:contrast=1.08:brightness=-0.08',
        fit: 'force_original_aspect_ratio=increase',
        crop: 'center',
        sampleAspectRatio: 1,
      },
      codecs: {
        mp4: {
          encoder: 'libx264',
          preset: 'slow',
          crf: 21,
          pixelFormat: 'yuv420p',
          fastStart: true,
        },
        webm: { encoder: 'libvpx-vp9', crf: 31, bitrate: 0, rowMt: 1 },
      },
      keyframes: { gop: 30, minimumInterval: 30, sceneThreshold: 0 },
      poster: { encoder: 'libwebp', quality: 82, frameCount: 1, capture: 'end' },
      byteBudgets: FRESHCUT_MOTION_BYTE_BUDGETS,
      audio: 'removed',
    })
    expect(plan.outputs).toEqual({
      desktopMp4: `${familyDirectory}/${plan.baseName}-desktop.mp4`,
      desktopWebm: `${familyDirectory}/${plan.baseName}-desktop.webm`,
      mobileMp4: `${familyDirectory}/${plan.baseName}-mobile.mp4`,
      mobileWebm: `${familyDirectory}/${plan.baseName}-mobile.webm`,
      desktopPosterWebp: `${familyDirectory}/${plan.baseName}-desktop-poster.webp`,
      mobilePosterWebp: `${familyDirectory}/${plan.baseName}-mobile-poster.webp`,
    })
  })

  it('emits only responsive posters for still owners and refuses a separate Return family', () => {
    const hero = buildFreshCutMotionMediaPlan(planInput({ sceneId: 'hero' }))

    expect(hero.mediaDelivery).toBe('poster-only')
    expect(buildFreshCutMotionMediaCommands(hero).map(({ kind }) => kind)).toEqual([
      'desktop-poster',
      'mobile-poster',
    ])
    expect(hero.outputs).toEqual({
      desktopPosterWebp: `${hero.familyDirectory}/${hero.baseName}-desktop-poster.webp`,
      mobilePosterWebp: `${hero.familyDirectory}/${hero.baseName}-mobile-poster.webp`,
    })
    expect(() => buildFreshCutMotionMediaPlan(planInput({ sceneId: 'return' }))).toThrow(
      /reuses craft posters/i,
    )
  })

  it('captures the finished Craft endpoint for the shared Return poster and starts elsewhere', () => {
    const craft = buildFreshCutMotionMediaPlan(planInput())
    const hero = buildFreshCutMotionMediaPlan(planInput({ sceneId: 'hero' }))
    const craftCommands = buildFreshCutMotionMediaCommands(craft)
    const heroCommands = buildFreshCutMotionMediaCommands(hero)

    expect(craft.recipe.poster.capture).toBe('end')
    expect(hero.recipe.poster.capture).toBe('start')
    for (const command of craftCommands.filter(({ kind }) => kind.includes('poster'))) {
      const captureSecond = Number(command.args[command.args.indexOf('-ss') + 1])
      expect(captureSecond).toBeGreaterThan(5.7)
      expect(captureSecond).toBeLessThan(5.8)
    }
    for (const command of heroCommands.filter(({ kind }) => kind.includes('poster'))) {
      expect(Number(command.args[command.args.indexOf('-ss') + 1])).toBe(0.4)
    }
    for (const command of craftCommands.filter(({ kind }) => !kind.includes('poster'))) {
      expect(Number(command.args[command.args.indexOf('-ss') + 1])).toBe(0.4)
    }
  })

  it('emits video and responsive posters for synthetic provenance on a video-owner scene', () => {
    const syntheticCraft = buildFreshCutMotionMediaPlan(
      planInput({
        sourceStatus: 'generated-demo',
        rightsStatus: 'synthetic-text-only',
      }),
    )

    expect(syntheticCraft.mediaDelivery).toBe('video')
    expect(buildFreshCutMotionMediaCommands(syntheticCraft).map(({ kind }) => kind)).toEqual([
      'desktop-mp4',
      'desktop-webm',
      'mobile-mp4',
      'mobile-webm',
      'desktop-poster',
      'mobile-poster',
    ])
  })

  it('changes the family hash when either raw source identity or a recipe field changes', () => {
    const baseline = buildFreshCutMotionMediaPlan(planInput())
    const changedSource = buildFreshCutMotionMediaPlan(planInput({ sourceHash: 'b'.repeat(64) }))
    const changedTrim = buildFreshCutMotionMediaPlan(planInput({ trimEndSeconds: 5.9 }))
    const changedHold = buildFreshCutMotionMediaPlan(planInput({ holdEndSeconds: 0.45 }))
    const changedProvenance = buildFreshCutMotionMediaPlan(
      planInput({
        sourceStatus: 'generated-demo',
        rightsStatus: 'synthetic-text-only',
      }),
    )

    expect(
      new Set([
        baseline.familyHash,
        changedSource.familyHash,
        changedTrim.familyHash,
        changedHold.familyHash,
        changedProvenance.familyHash,
      ]).size,
    ).toBe(5)
  })

  it('builds non-overwriting commands from the canonical recipe', () => {
    const plan = buildFreshCutMotionMediaPlan(planInput({ sceneId: 'mirror', version: 'v3' }))
    const commands = buildFreshCutMotionMediaCommands(plan, { ffmpegPath: 'ffmpeg-custom' })

    expect(commands).toHaveLength(6)
    for (const { command, args } of commands) {
      expect(command).toBe('ffmpeg-custom')
      expect(args).toContain('-n')
      expect(args).not.toContain('-y')
      expect(args).toContain('-an')
      expect(args.join(' ')).toContain('fps=30')
      expect(args.join(' ')).toContain('tpad=start_mode=clone:start_duration=0.25')
      expect(args.join(' ')).toContain('stop_mode=clone:stop_duration=0.35')
    }
    for (const mediaCommand of commands.filter(({ kind }) => !kind.includes('poster'))) {
      expect(mediaCommand.args[mediaCommand.args.indexOf('-g') + 1]).toBe('30')
      expect(mediaCommand.args[mediaCommand.args.indexOf('-keyint_min') + 1]).toBe('30')
      expect(mediaCommand.args[mediaCommand.args.indexOf('-sc_threshold') + 1]).toBe('0')
    }
    for (const poster of commands.filter(({ kind }) => kind.includes('poster'))) {
      expect(poster.args[poster.args.indexOf('-frames:v') + 1]).toBe('1')
      expect(poster.args.join(' ')).toContain('eq=saturation=0:contrast=1.08:brightness=-0.08')
    }
  })

  it('encodes and probes in a temporary family then atomically publishes one manifest family', () => {
    const outputDir = join(scratchDirectory(), 'published')
    const privateInputPath = 'C:/Users/Zivar-PC/private/client-original-name.mp4'
    const plan = buildFreshCutMotionMediaPlan(planInput({ inputPath: privateInputPath, outputDir }))
    const calls = []
    const runCommand = successfulRunner(calls)

    const result = executePlan(plan, {
      ffmpegPath: 'ffmpeg-test',
      ffprobePath: 'ffprobe-test',
      runCommand,
    })

    expect(existsSync(plan.familyDirectory)).toBe(true)
    expect(readdirSync(outputDir)).toEqual([plan.baseName])
    const encodeOutputs = calls
      .filter(
        ({ command, args }) =>
          command === 'ffmpeg-test' && args[0] !== '-version' && args.at(-1) !== '-',
      )
      .map(({ args }) => String(args.at(-1)).replaceAll('\\', '/'))
    expect(encodeOutputs).toHaveLength(6)
    expect(encodeOutputs.every((output) => output.includes(`/.${plan.baseName}-tmp-`))).toBe(true)
    expect(encodeOutputs.every((output) => !output.startsWith(`${plan.familyDirectory}/`))).toBe(
      true,
    )
    const decodeCalls = calls.filter(
      ({ command, args }) => command === 'ffmpeg-test' && args.at(-1) === '-',
    )
    expect(decodeCalls).toHaveLength(4)
    expect(
      decodeCalls.every(({ args }) =>
        String(args[args.indexOf('-i') + 1]).includes(`.${plan.baseName}-tmp-`),
      ),
    ).toBe(true)
    const probes = calls.filter(({ command }) => command === 'ffprobe-test')
    expect(probes).toHaveLength(6)
    expect(
      probes
        .filter(({ args }) => !String(args.at(-1)).includes('-poster.webp'))
        .every(({ args }) => args.includes('-show_frames')),
    ).toBe(true)
    expect(
      probes
        .filter(({ args }) => String(args.at(-1)).includes('-poster.webp'))
        .every(({ args }) => args.includes('-count_frames')),
    ).toBe(true)

    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8'))
    expect(manifest).toMatchObject({
      sceneId: plan.sceneId,
      version: plan.version,
      pipelineVersion: EXPECTED_PIPELINE_VERSION,
      provenance: {
        sourceStatus: 'approved-final',
        rightsStatus: 'approved-for-ai-transformation',
      },
      sourceHash: SOURCE_HASH,
      familyHash: plan.familyHash,
      recipe: plan.recipe,
      ffmpegVersion: 'ffmpeg version 7.1.1 Copyright FFmpeg developers',
      outputs: {
        desktopMp4: `${plan.baseName}-desktop.mp4`,
        desktopWebm: `${plan.baseName}-desktop.webm`,
        mobileMp4: `${plan.baseName}-mobile.mp4`,
        mobileWebm: `${plan.baseName}-mobile.webm`,
        desktopPosterWebp: `${plan.baseName}-desktop-poster.webp`,
        mobilePosterWebp: `${plan.baseName}-mobile-poster.webp`,
      },
    })
    expect(manifest).not.toHaveProperty('sourceFilename')
    const serializedManifest = JSON.stringify(manifest)
    expect(serializedManifest).not.toContain(privateInputPath)
    expect(serializedManifest).not.toContain('client-original-name.mp4')
    expect(serializedManifest).not.toContain(outputDir.replaceAll('\\', '/'))
    expect(serializedManifest).not.toContain(`.${plan.baseName}-tmp-`)
  })

  it('rejects publication when the source changes during preparation', () => {
    const outputDir = join(scratchDirectory(), 'published')
    const plan = buildFreshCutMotionMediaPlan(planInput({ outputDir }))
    const hashSource = vi.fn().mockReturnValueOnce(plan.sourceHash).mockReturnValue('b'.repeat(64))

    expect(() =>
      executePlan(plan, {
        ffmpegPath: 'ffmpeg-test',
        ffprobePath: 'ffprobe-test',
        hashSource,
        runCommand: successfulRunner([]),
      }),
    ).toThrow(/source changed during preparation/i)
    expect(hashSource).toHaveBeenCalledTimes(2)
    expect(existsSync(plan.familyDirectory)).toBe(false)
    expect(readdirSync(outputDir).filter((entry) => entry.includes('-tmp-'))).toEqual([])
  })

  it('refuses an existing published family before running FFmpeg', () => {
    const outputDir = join(scratchDirectory(), 'published')
    const plan = buildFreshCutMotionMediaPlan(planInput({ outputDir }))
    mkdirSync(plan.familyDirectory, { recursive: true })
    const runCommand = vi.fn()

    expect(() => executePlan(plan, { runCommand })).toThrow(/already exists/i)
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('cleans the temporary family when encoding or probing fails', () => {
    const outputDir = join(scratchDirectory(), 'published')
    const plan = buildFreshCutMotionMediaPlan(planInput({ outputDir }))
    let encodingCalls = 0
    const runCommand = vi.fn((command, args) => {
      if (args[0] === '-version') return 'ffmpeg version test\n'
      if (command === 'ffprobe-test') throw new Error('probe failed')
      encodingCalls += 1
      const output = args.at(-1)
      mkdirSync(dirname(output), { recursive: true })
      writeFileSync(output, 'prepared-media')
      return ''
    })

    expect(() =>
      executePlan(plan, {
        ffmpegPath: 'ffmpeg-test',
        ffprobePath: 'ffprobe-test',
        runCommand,
      }),
    ).toThrow(/probe failed/)
    expect(encodingCalls).toBe(6)
    expect(existsSync(plan.familyDirectory)).toBe(false)
    expect(readdirSync(outputDir).filter((entry) => entry.includes('-tmp-'))).toEqual([])
  })

  it.each([
    ['codec', { stream: { codec_name: 'png' } }, /poster codec/i],
    ['dimensions', { stream: { width: 1919 } }, /poster dimensions/i],
    ['frame count', { stream: { nb_read_frames: '2' } }, /one frame/i],
    ['nonzero integrity', { format: { size: '0' } }, /poster size/i],
  ])('rejects a prepared poster with invalid %s', (_label, posterOverrides, expectedError) => {
    const outputDir = join(scratchDirectory(), 'published')
    const plan = buildFreshCutMotionMediaPlan(planInput({ outputDir }))
    const runCommand = successfulRunner([], posterOverrides)

    expect(() =>
      executePlan(plan, {
        ffmpegPath: 'ffmpeg-test',
        ffprobePath: 'ffprobe-test',
        runCommand,
      }),
    ).toThrow(expectedError)
    expect(existsSync(plan.familyDirectory)).toBe(false)
  })

  it('enforces the exact responsive poster and codec byte ceilings', () => {
    expect(FRESHCUT_MOTION_BYTE_BUDGETS).toEqual({
      poster: { mobile: 120 * 1024, desktop: 200 * 1024 },
      webm: { mobile: 900 * 1024, desktop: 1_500 * 1024 },
      mp4: { mobile: 1_200 * 1024, desktop: 2_000 * 1024 },
    })

    const mediaProbe = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'vp9',
          width: 1080,
          height: 1920,
          avg_frame_rate: '30/1',
          bit_rate: '1000000',
        },
      ],
      format: {
        duration: '6.0',
        bit_rate: '1000000',
        format_name: 'matroska,webm',
        size: String(FRESHCUT_MOTION_BYTE_BUDGETS.webm.mobile + 1),
      },
      frames: videoFrames(),
    }
    expect(() =>
      assertPreparedMediaProbe(mediaProbe, {
        width: 1080,
        height: 1920,
        expectedDuration: 6,
        durationTolerance: 0.25,
        maximumBitrate: 4_000_000,
        maximumBytes: FRESHCUT_MOTION_BYTE_BUDGETS.webm.mobile,
        expectedGop: 30,
        expectedCodec: 'vp9',
        expectedContainers: ['webm', 'matroska'],
      }),
    ).toThrow(/byte budget/i)

    expect(() =>
      assertPreparedPosterProbe(
        {
          streams: [
            {
              codec_type: 'video',
              codec_name: 'webp',
              width: 1080,
              height: 1920,
              nb_read_frames: '1',
            },
          ],
          format: { size: String(FRESHCUT_MOTION_BYTE_BUDGETS.poster.mobile + 1) },
        },
        {
          width: 1080,
          height: 1920,
          frameCount: 1,
          maximumBytes: FRESHCUT_MOTION_BYTE_BUDGETS.poster.mobile,
        },
      ),
    ).toThrow(/byte budget/i)
  })

  it.each([
    ['mobile poster', '-mobile-poster.webp', FRESHCUT_MOTION_BYTE_BUDGETS.poster.mobile],
    ['desktop poster', '-desktop-poster.webp', FRESHCUT_MOTION_BYTE_BUDGETS.poster.desktop],
    ['mobile WebM', '-mobile.webm', FRESHCUT_MOTION_BYTE_BUDGETS.webm.mobile],
    ['desktop WebM', '-desktop.webm', FRESHCUT_MOTION_BYTE_BUDGETS.webm.desktop],
    ['mobile MP4', '-mobile.mp4', FRESHCUT_MOTION_BYTE_BUDGETS.mp4.mobile],
    ['desktop MP4', '-desktop.mp4', FRESHCUT_MOTION_BYTE_BUDGETS.mp4.desktop],
  ])('refuses an encoded %s one byte above its delivery budget', (_label, suffix, budget) => {
    const outputDir = join(scratchDirectory(), 'published')
    const plan = buildFreshCutMotionMediaPlan(planInput({ outputDir }))
    const runCommand = successfulRunnerWithOversize([], suffix, budget + 1)

    expect(() =>
      executePlan(plan, {
        ffmpegPath: 'ffmpeg-test',
        ffprobePath: 'ffprobe-test',
        runCommand,
      }),
    ).toThrow(/byte budget/i)
    expect(existsSync(plan.familyDirectory)).toBe(false)
  })

  it('fails closed for invalid scenes, source hashes, and trim windows', () => {
    const base = planInput()

    expect(() => buildFreshCutMotionMediaPlan({ ...base, sceneId: 'unknown' })).toThrow(
      /unknown scene/i,
    )
    expect(() => buildFreshCutMotionMediaPlan({ ...base, sourceHash: 'short' })).toThrow(
      /source hash/i,
    )
    expect(() =>
      buildFreshCutMotionMediaPlan({ ...base, trimStartSeconds: 4, trimEndSeconds: 2 }),
    ).toThrow(/trim window/i)
    expect(() =>
      buildFreshCutMotionMediaPlan({
        ...base,
        sourceStatus: 'generated-demo',
        rightsStatus: 'approved-for-ai-transformation',
      }),
    ).toThrow(/provenance/i)
  })

  it('verifies encoded dimensions, duration, bitrate, frame rate, and absence of audio', () => {
    expect(() =>
      assertPreparedMediaProbe(
        {
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1920,
              height: 1080,
              avg_frame_rate: '30/1',
              bit_rate: '2400000',
            },
          ],
          format: {
            duration: '5.1',
            bit_rate: '2400000',
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
            size: '1200000',
          },
          frames: videoFrames(),
        },
        {
          width: 1920,
          height: 1080,
          expectedDuration: 5.1,
          durationTolerance: 0.25,
          maximumBitrate: 4_000_000,
          expectedGop: 30,
          expectedCodec: 'h264',
          expectedContainers: ['mp4', 'mov'],
        },
      ),
    ).not.toThrow()

    expect(() =>
      assertPreparedMediaProbe(
        {
          streams: [
            { codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30/1' },
            { codec_type: 'audio', codec_name: 'aac' },
          ],
          format: { duration: '5.1', bit_rate: '2400000' },
        },
        { width: 1920, height: 1080, minimumDuration: 4.8, maximumBitrate: 4_000_000 },
      ),
    ).toThrow(/audio/i)
  })

  it('rejects encoded media whose observed keyframes violate the canonical GOP', () => {
    const frames = videoFrames(30)
    for (const frame of frames) frame.key_frame = 0
    for (const index of [0, 20, 40, 60, 80, 100, 120, 140, 160, 180]) {
      frames[index].key_frame = 1
      frames[index].pict_type = 'I'
    }

    expect(() =>
      assertPreparedMediaProbe(
        {
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1920,
              height: 1080,
              avg_frame_rate: '30/1',
              bit_rate: '2400000',
            },
          ],
          format: {
            duration: '6.0',
            bit_rate: '2400000',
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
            size: '1800000',
          },
          frames,
        },
        {
          width: 1920,
          height: 1080,
          expectedDuration: 6,
          durationTolerance: 0.25,
          maximumBitrate: 4_000_000,
          expectedGop: 30,
          expectedCodec: 'h264',
          expectedContainers: ['mp4', 'mov'],
        },
      ),
    ).toThrow(/keyframe cadence/i)
  })

  it.each([
    [
      'MP4 codec',
      { codecName: 'vp9', formatName: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '6.0', size: '1' },
      { expectedCodec: 'h264', expectedContainers: ['mp4', 'mov'] },
      /codec/i,
    ],
    [
      'MP4 container',
      { codecName: 'h264', formatName: 'matroska,webm', duration: '6.0', size: '1' },
      { expectedCodec: 'h264', expectedContainers: ['mp4', 'mov'] },
      /container/i,
    ],
    [
      'WebM codec',
      { codecName: 'h264', formatName: 'matroska,webm', duration: '6.0', size: '1' },
      { expectedCodec: 'vp9', expectedContainers: ['webm', 'matroska'] },
      /codec/i,
    ],
    [
      'WebM container',
      { codecName: 'vp9', formatName: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '6.0', size: '1' },
      { expectedCodec: 'vp9', expectedContainers: ['webm', 'matroska'] },
      /container/i,
    ],
    [
      'maximum duration',
      { codecName: 'h264', formatName: 'mov,mp4', duration: '6.3', size: '1' },
      { expectedCodec: 'h264', expectedContainers: ['mp4', 'mov'] },
      /duration/i,
    ],
    [
      'nonzero file integrity',
      { codecName: 'h264', formatName: 'mov,mp4', duration: '6.0', size: '0' },
      { expectedCodec: 'h264', expectedContainers: ['mp4', 'mov'] },
      /size/i,
    ],
  ])('rejects invalid encoded %s evidence', (_label, probeFields, expected, error) => {
    expect(() =>
      assertPreparedMediaProbe(
        {
          streams: [
            {
              codec_type: 'video',
              codec_name: probeFields.codecName,
              width: 1920,
              height: 1080,
              avg_frame_rate: '30/1',
              bit_rate: '2400000',
            },
          ],
          format: {
            duration: probeFields.duration,
            bit_rate: '2400000',
            format_name: probeFields.formatName,
            size: probeFields.size,
          },
          frames: videoFrames(),
        },
        {
          width: 1920,
          height: 1080,
          expectedDuration: 6,
          durationTolerance: 0.25,
          maximumBitrate: 4_000_000,
          expectedGop: 30,
          ...expected,
        },
      ),
    ).toThrow(error)
  })
})
