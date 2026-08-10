import { createHash } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCENES = new Set(['hero', 'entrance', 'chair', 'craft', 'range', 'return', 'mirror', 'team'])
const SOURCE_HASH_PATTERN = /^[a-f0-9]{64}$/i
const VERSION_PATTERN = /^v[1-9]\d*$/

export const FRESHCUT_MOTION_PIPELINE_VERSION = 'freshcut-motion-ffmpeg-v2'

function normalisePath(path) {
  return String(path).replace(/\\/g, '/')
}

function outputPath(directory, filename) {
  return `${String(directory).replace(/[\\/]+$/, '')}/${filename}`
}

function finiteNonNegative(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be non-negative`)
  return number
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function mediaRecipe({ trimStartSeconds, trimEndSeconds, holdStartSeconds, holdEndSeconds }) {
  return {
    trim: { startSeconds: trimStartSeconds, endSeconds: trimEndSeconds },
    holds: { startSeconds: holdStartSeconds, endSeconds: holdEndSeconds },
    fps: 30,
    dimensions: {
      desktop: { width: 1920, height: 1080 },
      mobile: { width: 1080, height: 1920 },
    },
    filter: {
      colorspace: 'colorspace=all=bt709:iall=bt709:fast=1',
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
    poster: { encoder: 'libwebp', quality: 82, frameCount: 1, viewport: 'desktop' },
    audio: 'removed',
  }
}

function familyOutputs(directory, baseName) {
  return {
    desktopMp4: outputPath(directory, `${baseName}-desktop.mp4`),
    desktopWebm: outputPath(directory, `${baseName}-desktop.webm`),
    mobileMp4: outputPath(directory, `${baseName}-mobile.mp4`),
    mobileWebm: outputPath(directory, `${baseName}-mobile.webm`),
    posterWebp: outputPath(directory, `${baseName}-poster.webp`),
  }
}

export function buildFreshCutMotionMediaPlan(input) {
  if (!SCENES.has(input.sceneId)) throw new Error(`Unknown scene: ${input.sceneId}`)
  if (!String(input.inputPath ?? '').trim()) throw new Error('Input path is required')
  if (!String(input.outputDir ?? '').trim()) throw new Error('Output directory is required')
  if (!VERSION_PATTERN.test(String(input.version ?? ''))) {
    throw new Error('Version must use v1, v2, ...')
  }
  if (!SOURCE_HASH_PATTERN.test(String(input.sourceHash ?? ''))) {
    throw new Error('Source hash must be one full SHA-256 hexadecimal digest')
  }

  const trimStartSeconds = finiteNonNegative(input.trimStartSeconds, 'Trim start')
  const trimEndSeconds = finiteNonNegative(input.trimEndSeconds, 'Trim end')
  const holdStartSeconds = finiteNonNegative(input.holdStartSeconds, 'Hold start')
  const holdEndSeconds = finiteNonNegative(input.holdEndSeconds, 'Hold end')
  if (trimEndSeconds <= trimStartSeconds) throw new Error('Trim window must end after it starts')

  const sourceHash = String(input.sourceHash).toLowerCase()
  const recipe = mediaRecipe({
    trimStartSeconds,
    trimEndSeconds,
    holdStartSeconds,
    holdEndSeconds,
  })
  const familyHash = createHash('sha256')
    .update(
      canonicalJson({
        pipelineVersion: FRESHCUT_MOTION_PIPELINE_VERSION,
        sourceHash,
        sceneId: input.sceneId,
        version: input.version,
        recipe,
      }),
    )
    .digest('hex')
  const baseName = `${input.sceneId}-${input.version}-${familyHash.slice(0, 12)}`
  const outputDir = normalisePath(input.outputDir).replace(/[\\/]+$/, '')
  const familyDirectory = outputPath(outputDir, baseName)

  return {
    sceneId: input.sceneId,
    inputPath: normalisePath(input.inputPath),
    outputDir,
    familyDirectory,
    version: input.version,
    pipelineVersion: FRESHCUT_MOTION_PIPELINE_VERSION,
    sourceHash,
    familyHash,
    baseName,
    trimStartSeconds,
    trimEndSeconds,
    holdStartSeconds,
    holdEndSeconds,
    recipe,
    outputs: familyOutputs(familyDirectory, baseName),
  }
}

function videoFilter(plan, width, height) {
  const { filter, fps } = plan.recipe
  return [
    `fps=${fps}`,
    `tpad=start_mode=clone:start_duration=${plan.holdStartSeconds}:stop_mode=clone:stop_duration=${plan.holdEndSeconds}`,
    filter.colorspace,
    `scale=${width}:${height}:${filter.fit}`,
    `crop=${width}:${height}`,
    `setsar=${filter.sampleAspectRatio}`,
  ].join(',')
}

function commonInputArgs(plan) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-n',
    '-ss',
    String(plan.trimStartSeconds),
    '-to',
    String(plan.trimEndSeconds),
    '-i',
    plan.inputPath,
    '-an',
  ]
}

function keyframeArgs(plan) {
  return [
    '-g',
    String(plan.recipe.keyframes.gop),
    '-keyint_min',
    String(plan.recipe.keyframes.minimumInterval),
    '-sc_threshold',
    String(plan.recipe.keyframes.sceneThreshold),
  ]
}

function mp4Args(plan, width, height, output) {
  const codec = plan.recipe.codecs.mp4
  return [
    ...commonInputArgs(plan),
    '-vf',
    videoFilter(plan, width, height),
    '-c:v',
    codec.encoder,
    '-preset',
    codec.preset,
    '-crf',
    String(codec.crf),
    '-pix_fmt',
    codec.pixelFormat,
    ...(codec.fastStart ? ['-movflags', '+faststart'] : []),
    ...keyframeArgs(plan),
    output,
  ]
}

function webmArgs(plan, width, height, output) {
  const codec = plan.recipe.codecs.webm
  return [
    ...commonInputArgs(plan),
    '-vf',
    videoFilter(plan, width, height),
    '-c:v',
    codec.encoder,
    '-b:v',
    String(codec.bitrate),
    '-crf',
    String(codec.crf),
    '-row-mt',
    String(codec.rowMt),
    ...keyframeArgs(plan),
    output,
  ]
}

export function buildFreshCutMotionMediaCommands(plan, options = {}) {
  const command = options.ffmpegPath || 'ffmpeg'
  const desktop = plan.recipe.dimensions.desktop
  const mobile = plan.recipe.dimensions.mobile
  return [
    {
      kind: 'desktop-mp4',
      command,
      args: mp4Args(plan, desktop.width, desktop.height, plan.outputs.desktopMp4),
    },
    {
      kind: 'desktop-webm',
      command,
      args: webmArgs(plan, desktop.width, desktop.height, plan.outputs.desktopWebm),
    },
    {
      kind: 'mobile-mp4',
      command,
      args: mp4Args(plan, mobile.width, mobile.height, plan.outputs.mobileMp4),
    },
    {
      kind: 'mobile-webm',
      command,
      args: webmArgs(plan, mobile.width, mobile.height, plan.outputs.mobileWebm),
    },
    {
      kind: 'poster',
      command,
      args: [
        ...commonInputArgs(plan),
        '-vf',
        videoFilter(plan, desktop.width, desktop.height),
        '-frames:v',
        String(plan.recipe.poster.frameCount),
        '-c:v',
        plan.recipe.poster.encoder,
        '-quality',
        String(plan.recipe.poster.quality),
        plan.outputs.posterWebp,
      ],
    },
  ]
}

function frameRate(value) {
  const [numerator, denominator = '1'] = String(value ?? '')
    .split('/')
    .map(Number)
  return denominator ? numerator / denominator : 0
}

export function assertPreparedMediaProbe(probe, expected) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : []
  if (streams.some((stream) => stream.codec_type === 'audio')) {
    throw new Error('Prepared motion media must not contain an audio stream')
  }
  const video = streams.find((stream) => stream.codec_type === 'video')
  if (!video) throw new Error('Prepared motion media has no video stream')
  if (video.width !== expected.width || video.height !== expected.height) {
    throw new Error(`Prepared media dimensions are ${video.width}x${video.height}`)
  }
  const fps = frameRate(video.avg_frame_rate)
  if (fps < 29 || fps > 31) throw new Error(`Prepared media frame rate is ${fps}`)
  if (expected.expectedCodec && video.codec_name !== expected.expectedCodec) {
    throw new Error(
      `Prepared media codec is ${video.codec_name ?? 'missing'}; expected ${expected.expectedCodec}`,
    )
  }
  if (expected.expectedContainers) {
    const observedContainers = String(probe?.format?.format_name ?? '')
      .toLowerCase()
      .split(',')
      .filter(Boolean)
    if (!expected.expectedContainers.some((container) => observedContainers.includes(container))) {
      throw new Error(
        `Prepared media container is ${observedContainers.join(',') || 'missing'}; expected one of ${expected.expectedContainers.join(',')}`,
      )
    }
  }
  const duration = Number(probe?.format?.duration)
  const invalidDuration =
    !Number.isFinite(duration) ||
    (Number.isFinite(expected.expectedDuration)
      ? Math.abs(duration - expected.expectedDuration) > expected.durationTolerance
      : duration < expected.minimumDuration)
  if (invalidDuration) {
    throw new Error(`Prepared media duration is ${duration}`)
  }
  const size = Number(probe?.format?.size)
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Prepared media size is ${size}`)
  }
  const bitrate = Number(probe?.format?.bit_rate ?? video.bit_rate)
  if (!Number.isFinite(bitrate) || bitrate <= 0 || bitrate > expected.maximumBitrate) {
    throw new Error(`Prepared media bitrate is ${bitrate}`)
  }
  if (expected.expectedGop) {
    const frames = Array.isArray(probe?.frames)
      ? probe.frames.filter((frame) => !frame.media_type || frame.media_type === 'video')
      : []
    if (frames.length <= expected.expectedGop) {
      throw new Error('Prepared media keyframe cadence has insufficient frame evidence')
    }
    const observedKeyframes = frames.flatMap((frame, index) =>
      Number(frame.key_frame) === 1 ? [index] : [],
    )
    const expectedKeyframes = []
    for (let index = 0; index < frames.length; index += expected.expectedGop) {
      expectedKeyframes.push(index)
    }
    if (
      observedKeyframes.length !== expectedKeyframes.length ||
      observedKeyframes.some((index, position) => index !== expectedKeyframes[position])
    ) {
      throw new Error(
        `Prepared media keyframe cadence is ${observedKeyframes.join(',')}; expected every ${expected.expectedGop} frames`,
      )
    }
    const observedIFrames = frames.flatMap((frame, index) =>
      frame.pict_type === 'I' ? [index] : [],
    )
    if (
      observedIFrames.length > 0 &&
      (observedIFrames.length !== expectedKeyframes.length ||
        observedIFrames.some((index, position) => index !== expectedKeyframes[position]))
    ) {
      throw new Error('Prepared media keyframe cadence contains an unexpected I-frame')
    }
  }
  return true
}

export function assertPreparedPosterProbe(probe, expected) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : []
  const video = streams.find((stream) => stream.codec_type === 'video')
  if (!video || video.codec_name !== 'webp') {
    throw new Error(`Prepared poster codec is ${video?.codec_name ?? 'missing'}`)
  }
  if (video.width !== expected.width || video.height !== expected.height) {
    throw new Error(`Prepared poster dimensions are ${video.width}x${video.height}`)
  }
  const frameCount = Number(video.nb_read_frames ?? video.nb_frames)
  if (frameCount !== expected.frameCount) {
    throw new Error(`Prepared poster must contain exactly one frame; received ${frameCount}`)
  }
  const size = Number(probe?.format?.size)
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Prepared poster size is ${size}`)
  }
  return true
}

export async function hashMotionSource(inputPath) {
  const hash = createHash('sha256')
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(inputPath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', resolvePromise)
    stream.on('error', rejectPromise)
  })
  return hash.digest('hex')
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit ${result.status}: ${result.stderr || ''}`.trim())
  }
  return result.stdout || ''
}

function temporaryPlan(plan, temporaryDirectory) {
  return {
    ...plan,
    familyDirectory: temporaryDirectory,
    outputs: familyOutputs(temporaryDirectory, plan.baseName),
  }
}

export function executeFreshCutMotionMediaPlan(plan, options = {}) {
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_BIN || 'ffmpeg'
  const ffprobePath = options.ffprobePath || process.env.FFPROBE_BIN || 'ffprobe'
  const runCommand = options.runCommand || run

  if (existsSync(plan.familyDirectory)) {
    throw new Error(`Published media family already exists: ${plan.familyDirectory}`)
  }

  mkdirSync(plan.outputDir, { recursive: true })
  const temporaryDirectory = normalisePath(
    mkdtempSync(join(plan.outputDir, `.${plan.baseName}-tmp-`)),
  )
  const workingPlan = temporaryPlan(plan, temporaryDirectory)

  try {
    const ffmpegVersion = String(runCommand(ffmpegPath, ['-version'], { capture: true }))
      .split(/\r?\n/, 1)[0]
      .trim()

    for (const step of buildFreshCutMotionMediaCommands(workingPlan, { ffmpegPath })) {
      runCommand(step.command, step.args)
    }

    const desktop = plan.recipe.dimensions.desktop
    const mobile = plan.recipe.dimensions.mobile
    const checks = [
      [workingPlan.outputs.desktopMp4, desktop.width, desktop.height, 'h264', ['mp4', 'mov']],
      [workingPlan.outputs.desktopWebm, desktop.width, desktop.height, 'vp9', ['webm', 'matroska']],
      [workingPlan.outputs.mobileMp4, mobile.width, mobile.height, 'h264', ['mp4', 'mov']],
      [workingPlan.outputs.mobileWebm, mobile.width, mobile.height, 'vp9', ['webm', 'matroska']],
    ]
    const expectedDuration =
      plan.trimEndSeconds - plan.trimStartSeconds + plan.holdStartSeconds + plan.holdEndSeconds

    for (const [file, width, height, expectedCodec, expectedContainers] of checks) {
      if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing output: ${file}`)
      const stdout = runCommand(
        ffprobePath,
        ['-v', 'error', '-show_streams', '-show_format', '-show_frames', '-of', 'json', file],
        { capture: true },
      )
      // ffprobe cannot recover the encoder's sc_threshold option. The command fixes it at zero;
      // the full frame list below empirically proves the resulting exact GOP without scene cuts.
      assertPreparedMediaProbe(JSON.parse(stdout), {
        width,
        height,
        expectedDuration,
        durationTolerance: 0.25,
        maximumBitrate: 8_000_000,
        expectedGop: plan.recipe.keyframes.gop,
        expectedCodec,
        expectedContainers,
      })
      runCommand(ffmpegPath, ['-v', 'error', '-i', file, '-f', 'null', '-'])
    }
    if (
      !existsSync(workingPlan.outputs.posterWebp) ||
      statSync(workingPlan.outputs.posterWebp).size === 0
    ) {
      throw new Error(`Missing output: ${workingPlan.outputs.posterWebp}`)
    }
    const posterProbe = runCommand(
      ffprobePath,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-count_frames',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        workingPlan.outputs.posterWebp,
      ],
      { capture: true },
    )
    assertPreparedPosterProbe(JSON.parse(posterProbe), {
      width: desktop.width,
      height: desktop.height,
      frameCount: plan.recipe.poster.frameCount,
    })

    const manifestFilename = `${plan.baseName}-manifest.json`
    const temporaryManifestPath = outputPath(temporaryDirectory, manifestFilename)
    writeFileSync(
      temporaryManifestPath,
      `${JSON.stringify(
        {
          sceneId: plan.sceneId,
          version: plan.version,
          pipelineVersion: plan.pipelineVersion,
          sourceHash: plan.sourceHash,
          familyHash: plan.familyHash,
          recipe: plan.recipe,
          ffmpegVersion,
          outputs: Object.fromEntries(
            Object.entries(plan.outputs).map(([key, path]) => [key, basename(path)]),
          ),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    if (existsSync(plan.familyDirectory)) {
      throw new Error(`Published media family already exists: ${plan.familyDirectory}`)
    }
    renameSync(temporaryDirectory, plan.familyDirectory)
    return {
      ...plan,
      manifestPath: outputPath(plan.familyDirectory, manifestFilename),
    }
  } catch (error) {
    rmSync(temporaryDirectory, { force: true, recursive: true })
    throw error
  }
}

function argument(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const inputPath = argument(args, '--input')
  const sceneId = argument(args, '--scene')
  const outputDir = argument(args, '--output')
  const version = argument(args, '--version') || 'v1'
  if (!inputPath || !sceneId || !outputDir) {
    throw new Error('Usage: --input <file> --scene <id> --output <directory> [--version v1]')
  }
  const sourceHash = await hashMotionSource(inputPath)
  const plan = buildFreshCutMotionMediaPlan({
    sceneId,
    inputPath: resolve(inputPath),
    outputDir: resolve(outputDir),
    version,
    sourceHash,
    trimStartSeconds: Number(argument(args, '--trim-start') || 0),
    trimEndSeconds: Number(argument(args, '--trim-end') || 5),
    holdStartSeconds: Number(argument(args, '--hold-start') || 0.2),
    holdEndSeconds: Number(argument(args, '--hold-end') || 0.35),
  })
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ plan, commands: buildFreshCutMotionMediaCommands(plan) }, null, 2))
    return
  }
  const result = executeFreshCutMotionMediaPlan(plan)
  console.log(`Prepared ${result.sceneId}: ${result.manifestPath}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(String(error?.message ?? error))
    process.exit(1)
  })
}
