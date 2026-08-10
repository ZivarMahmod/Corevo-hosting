import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../../../..')
const SCENE_COPY_PLACEMENT = Object.freeze({
  hero: 'left',
  entrance: 'left',
  chair: 'right',
  craft: 'left',
  range: 'left',
  return: 'right',
  mirror: 'right',
  team: 'left',
})
const IMAGE_EXTENSIONS = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp'])
const VIDEO_EXTENSIONS = new Set(['.mkv', '.mov', '.mp4', '.webm'])
const DOCUMENTED_TRANSITION_PAIRS = Object.freeze([
  Object.freeze(['entrance', 'chair']),
  Object.freeze(['chair', 'craft']),
  Object.freeze(['craft', 'range']),
  Object.freeze(['range', 'return']),
  Object.freeze(['return', 'mirror']),
  Object.freeze(['mirror', 'team']),
])
export const FRESHCUT_QA_PHONE_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 360, height: 800 }),
  Object.freeze({ width: 390, height: 844 }),
  Object.freeze({ width: 430, height: 932 }),
])
const SHA256_PATTERN = /^[a-f0-9]{64}$/i

function argument(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function argumentsFor(args, name) {
  return args.flatMap((value, index) =>
    value === name && args[index + 1] ? [args[index + 1]] : [],
  )
}

function transitionInputSpecs(args, env) {
  const specs = [...argumentsFor(args, '--transition-input')]
  if (env.FRESHCUT_QA_TRANSITION_INPUTS_JSON?.trim()) {
    let parsed
    try {
      parsed = JSON.parse(env.FRESHCUT_QA_TRANSITION_INPUTS_JSON)
    } catch {
      throw new Error('Transition input JSON must be an object of scene-to-path entries')
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Transition input JSON must be an object of scene-to-path entries')
    }
    specs.push(...Object.entries(parsed).map(([sceneId, path]) => `${sceneId}=${path}`))
  }
  return specs
}

function isInside(directory, candidate) {
  const pathFromDirectory = relative(directory, candidate)
  return (
    pathFromDirectory === '' ||
    (!pathFromDirectory.startsWith('..') && !isAbsolute(pathFromDirectory))
  )
}

function validatedPrivateMediaPath(value, repositoryRoot, label = 'Candidate') {
  if (!isAbsolute(value)) throw new Error(`${label} path must be absolute`)
  let fileStats
  let privatePath
  try {
    fileStats = statSync(value)
    privatePath = realpathSync(value)
  } catch {
    throw new Error(`${label} path must reference a readable existing file`)
  }
  if (!fileStats.isFile()) {
    throw new Error(`${label} path must reference an existing file`)
  }
  const extension = extname(value).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(`${label} must be a supported image or video file`)
  }
  if (isInside(repositoryRoot, privatePath)) {
    throw new Error(`${label} must remain outside the repository`)
  }
  return {
    mediaKind: IMAGE_EXTENSIONS.has(extension) ? 'image' : 'video',
    path: privatePath,
  }
}

function validatedOutputDirectory(value, repositoryRoot) {
  if (!isAbsolute(value)) throw new Error('Output directory path must be absolute')
  const requestedDirectory = resolve(value)
  let existingAncestor = requestedDirectory
  const missingSegments = []
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) throw new Error('Output directory cannot be resolved')
    missingSegments.unshift(basename(existingAncestor))
    existingAncestor = parent
  }
  if (!statSync(existingAncestor).isDirectory()) {
    throw new Error('Output directory must resolve through a directory')
  }
  const outputDirectory = resolve(realpathSync(existingAncestor), ...missingSegments)
  if (isInside(repositoryRoot, outputDirectory)) {
    throw new Error('Output directory must remain outside the repository')
  }
  return outputDirectory
}

function validatedLocalMotiontestOrigin(value) {
  let origin
  try {
    origin = new URL(value)
  } catch {
    throw new Error('Browser origin must be a valid local motiontest URL')
  }
  if (
    origin.protocol !== 'http:' ||
    origin.hostname.toLowerCase() !== 'motiontest.localhost' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('Browser origin must be a clean http://motiontest.localhost origin')
  }
  return origin.origin
}

function percentagePosition(token) {
  if (!/^\d+(?:\.\d+)?%$/.test(token)) return false
  const percentage = Number(token.slice(0, -1))
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
}

function validatedObjectPosition(value, label) {
  const tokens = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const horizontal = (token) =>
    ['left', 'center', 'right'].includes(token) || percentagePosition(token)
  const vertical = (token) =>
    ['top', 'center', 'bottom'].includes(token) || percentagePosition(token)
  const valid =
    (tokens.length === 1 && (horizontal(tokens[0]) || vertical(tokens[0]))) ||
    (tokens.length === 2 && horizontal(tokens[0]) && vertical(tokens[1]))
  if (!valid) throw new Error(`${label} object-position is invalid`)
  return tokens.join(' ')
}

export function resolveQaHarnessInput(args = [], env = process.env, options = {}) {
  const input = {
    candidatePath: argument(args, '--candidate') ?? env.FRESHCUT_QA_CANDIDATE,
    sceneId: argument(args, '--scene') ?? env.FRESHCUT_QA_SCENE,
    copyPlacement: argument(args, '--copy-placement') ?? env.FRESHCUT_QA_COPY_PLACEMENT,
    outputDir: argument(args, '--output') ?? env.FRESHCUT_QA_OUTPUT_DIR,
    baseUrl:
      argument(args, '--base-url') ??
      env.FRESHCUT_QA_BASE_URL ??
      `http://motiontest.localhost:${env.E2E_PORT ?? '3000'}`,
    desktopObjectPosition:
      argument(args, '--desktop-object-position') ?? env.FRESHCUT_QA_DESKTOP_OBJECT_POSITION,
    mobileObjectPosition:
      argument(args, '--mobile-object-position') ?? env.FRESHCUT_QA_MOBILE_OBJECT_POSITION,
    transitionInputSpecs: transitionInputSpecs(args, env),
  }

  if (
    !input.candidatePath?.trim() ||
    !input.sceneId?.trim() ||
    !input.copyPlacement?.trim() ||
    !input.outputDir?.trim()
  ) {
    throw new Error('Candidate, scene, copy placement and output directory are required')
  }

  const repositoryRoot = realpathSync(resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT))
  const expectedCopyPlacement = SCENE_COPY_PLACEMENT[input.sceneId]
  if (!expectedCopyPlacement) throw new Error('Scene must be one of the eight motiontest scenes')
  if (input.copyPlacement !== expectedCopyPlacement) {
    throw new Error(`Copy placement does not match the ${input.sceneId} acceptance contract`)
  }
  const candidate = validatedPrivateMediaPath(input.candidatePath, repositoryRoot)
  const hasDesktopObjectPosition = Boolean(input.desktopObjectPosition?.trim())
  const hasMobileObjectPosition = Boolean(input.mobileObjectPosition?.trim())
  if (hasDesktopObjectPosition !== hasMobileObjectPosition) {
    throw new Error('Desktop and mobile object-position overrides must be provided together')
  }
  const objectPosition = hasDesktopObjectPosition
    ? {
        desktop: validatedObjectPosition(input.desktopObjectPosition, 'Desktop'),
        mobile: validatedObjectPosition(input.mobileObjectPosition, 'Mobile'),
      }
    : null
  const seenTransitionScenes = new Set()
  const transitionInputs = input.transitionInputSpecs.map((spec) => {
    const separator = spec.indexOf('=')
    if (separator <= 0 || separator === spec.length - 1) {
      throw new Error('Transition inputs must use scene=absolute-path')
    }
    const sceneId = spec.slice(0, separator)
    const path = spec.slice(separator + 1)
    if (!SCENE_COPY_PLACEMENT[sceneId]) throw new Error('Transition input scene is unknown')
    if (sceneId === input.sceneId || seenTransitionScenes.has(sceneId)) {
      throw new Error('Transition input scenes must be unique and exclude the candidate scene')
    }
    seenTransitionScenes.add(sceneId)
    const media = validatedPrivateMediaPath(path, repositoryRoot, 'Transition input')
    return { sceneId, ...media }
  })

  return {
    ...input,
    candidatePath: candidate.path,
    mediaKind: candidate.mediaKind,
    outputDir: validatedOutputDirectory(input.outputDir, repositoryRoot),
    baseUrl: validatedLocalMotiontestOrigin(input.baseUrl),
    objectPosition,
    repositoryRoot,
    transitionInputs,
  }
}

function artifactPath(directory, filename) {
  return join(directory, filename)
}

export function buildFreshCutQaArtifactPlan(input, facts = {}) {
  const candidateSha256 = String(facts.candidateSha256 ?? '').toLowerCase()
  if (!SHA256_PATTERN.test(candidateSha256)) {
    throw new Error('Candidate SHA-256 must be one full hexadecimal digest')
  }

  let samples
  if (input.mediaKind === 'video') {
    const durationSeconds = Number(facts.durationSeconds)
    const finalFrameSeconds = Number(facts.finalFrameSeconds)
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 1 / 30) {
      throw new Error('Video duration must be longer than one frame')
    }
    if (
      !Number.isFinite(finalFrameSeconds) ||
      finalFrameSeconds < 0 ||
      finalFrameSeconds > durationSeconds
    ) {
      throw new Error('Video final decoded frame timestamp is invalid')
    }
    samples = [
      { label: 'first', seconds: 0 },
      { label: 'middle', seconds: durationSeconds / 2 },
      { label: 'final', seconds: finalFrameSeconds },
    ]
  } else {
    samples = [{ label: 'still', seconds: null }]
  }

  const artifactDirectory = artifactPath(
    input.outputDir,
    `${input.sceneId}-${candidateSha256.slice(0, 12)}-qa`,
  )
  const mediaByScene = new Map([
    [
      input.sceneId,
      {
        durationSeconds: input.mediaKind === 'video' ? Number(facts.durationSeconds) : null,
        finalFrameSeconds: input.mediaKind === 'video' ? Number(facts.finalFrameSeconds) : null,
        mediaKind: input.mediaKind,
        path: input.candidatePath,
        sceneId: input.sceneId,
      },
    ],
  ])
  for (const transition of input.transitionInputs) {
    const transitionFacts = facts.transitionMediaFacts?.[transition.sceneId]
    const durationSeconds =
      transition.mediaKind === 'video' ? Number(transitionFacts?.durationSeconds) : null
    const finalFrameSeconds =
      transition.mediaKind === 'video' ? Number(transitionFacts?.finalFrameSeconds) : null
    if (
      transition.mediaKind === 'video' &&
      (!Number.isFinite(durationSeconds) ||
        durationSeconds <= 1 / 30 ||
        !Number.isFinite(finalFrameSeconds) ||
        finalFrameSeconds < 0 ||
        finalFrameSeconds > durationSeconds)
    ) {
      throw new Error(`Transition video duration is invalid for ${transition.sceneId}`)
    }
    mediaByScene.set(transition.sceneId, {
      ...transition,
      durationSeconds,
      finalFrameSeconds,
    })
  }
  const transitionPairs = DOCUMENTED_TRANSITION_PAIRS.flatMap(([fromScene, toScene]) => {
    const from = mediaByScene.get(fromScene)
    const to = mediaByScene.get(toScene)
    return from && to ? [{ from, fromScene, to, toScene }] : []
  })
  if (input.transitionInputs.length > 0 && transitionPairs.length === 0) {
    throw new Error('Supplied inputs do not form a documented transition pair')
  }
  const usedTransitionScenes = new Set(
    transitionPairs.flatMap(({ fromScene, toScene }) => [fromScene, toScene]),
  )
  const unusedTransitionScenes = input.transitionInputs
    .map(({ sceneId }) => sceneId)
    .filter((sceneId) => !usedTransitionScenes.has(sceneId))
  if (unusedTransitionScenes.length > 0) {
    throw new Error(`Unused transition input scenes: ${unusedTransitionScenes.join(', ')}`)
  }
  return {
    ...input,
    artifactDirectory,
    candidateSha256,
    objectPosition: input.objectPosition,
    samples,
    phoneViewports: FRESHCUT_QA_PHONE_VIEWPORTS,
    transitionPairs,
    browserCapture:
      input.mediaKind === 'image'
        ? {
            enabled: true,
            height: 900,
            output: artifactPath(artifactDirectory, `${input.sceneId}-dom-1440x900.png`),
            responsive: input.objectPosition
              ? FRESHCUT_QA_PHONE_VIEWPORTS.map(({ width, height }) => ({
                  height,
                  output: artifactPath(
                    artifactDirectory,
                    `${input.sceneId}-dom-${width}x${height}.png`,
                  ),
                  width,
                }))
              : [],
            width: 1440,
          }
        : { enabled: false },
  }
}

function ffmpegInputArgs(plan, sample) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    ...(plan.mediaKind === 'video' ? ['-ss', String(sample.seconds)] : []),
    '-i',
    plan.candidatePath,
    '-an',
  ]
}

function centreCropFilter(width, height) {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    'setsar=1',
  ].join(',')
}

function desktopOverlayFilter(copyPlacement) {
  const copyMask =
    copyPlacement === 'left'
      ? 'drawbox=x=0:y=0:w=iw*0.46:h=ih:color=black@0.52:t=fill'
      : 'drawbox=x=iw*0.54:y=0:w=iw*0.46:h=ih:color=black@0.52:t=fill'
  return [
    centreCropFilter(1440, 810),
    copyMask,
    'drawbox=x=iw*0.41:y=ih*0.12:w=iw*0.18:h=ih*0.46:color=lime@0.65:t=4',
  ].join(',')
}

function frameCommand(plan, sample, kind, filter, output, command) {
  return {
    kind,
    command,
    args: [...ffmpegInputArgs(plan, sample), '-vf', filter, '-frames:v', '1', output],
  }
}

function transitionEndpointArgs(media, endpoint) {
  if (media.mediaKind !== 'video') return ['-i', media.path]
  const seconds = endpoint === 'final' ? media.finalFrameSeconds : 0
  return ['-ss', String(seconds), '-i', media.path]
}

function transitionCommand(plan, pair, variant, command) {
  const mobile = variant === 'mobile-390x844'
  const width = mobile ? 390 : 720
  const height = mobile ? 844 : 405
  const crop = centreCropFilter(width, height)
  const output = artifactPath(
    plan.artifactDirectory,
    `transition-${pair.fromScene}-to-${pair.toScene}-${variant}.png`,
  )
  return {
    kind: `transition-${pair.fromScene}-to-${pair.toScene}-${variant}`,
    command,
    args: [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-n',
      ...transitionEndpointArgs(pair.from, 'final'),
      ...transitionEndpointArgs(pair.to, 'first'),
      '-an',
      '-filter_complex',
      `[0:v]${crop}[from];[1:v]${crop}[to];[from][to]hstack=inputs=2[out]`,
      '-map',
      '[out]',
      '-frames:v',
      '1',
      output,
    ],
  }
}

export function buildFreshCutQaFfmpegCommands(plan, options = {}) {
  const command = options.ffmpegPath ?? 'ffmpeg'
  const frameCommands = plan.samples.flatMap((sample) => {
    const prefix = `${plan.sceneId}-${sample.label}`
    const desktop = frameCommand(
      plan,
      sample,
      `${sample.label}-desktop-overlay`,
      desktopOverlayFilter(plan.copyPlacement),
      artifactPath(plan.artifactDirectory, `${prefix}-desktop-overlay.png`),
      command,
    )
    const phoneCrops = plan.phoneViewports.map(({ width, height }) =>
      frameCommand(
        plan,
        sample,
        `${sample.label}-center-${width}x${height}`,
        centreCropFilter(width, height),
        artifactPath(plan.artifactDirectory, `${prefix}-center-${width}x${height}.png`),
        command,
      ),
    )
    return [desktop, ...phoneCrops]
  })
  const transitionCommands = plan.transitionPairs.flatMap((pair) => [
    transitionCommand(plan, pair, 'desktop', command),
    transitionCommand(plan, pair, 'mobile-390x844', command),
  ])
  return [...frameCommands, ...transitionCommands]
}

export async function hashQaMediaFile(path) {
  return await new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', () => reject(new Error('Media file could not be read')))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

function defaultRunCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'pipe',
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${options.label ?? 'Media command'} failed`)
  }
  return result.stdout ?? ''
}

function probeQaMedia(media, ffprobePath, runCommand) {
  let probe
  try {
    probe = JSON.parse(
      String(
        runCommand(
          ffprobePath,
          [
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_frames',
            '-show_entries',
            'stream=codec_type,width,height,duration:format=duration:frame=best_effort_timestamp_time,pts_time,pkt_pts_time',
            '-of',
            'json',
            media.path,
          ],
          { capture: true, label: 'Media probe' },
        ),
      ),
    )
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Media probe returned invalid JSON')
    throw error
  }
  const videoStream = Array.isArray(probe?.streams)
    ? probe.streams.find((stream) => stream.codec_type === 'video')
    : null
  if (
    !videoStream ||
    !Number.isFinite(Number(videoStream.width)) ||
    !Number.isFinite(Number(videoStream.height)) ||
    Number(videoStream.width) < 1 ||
    Number(videoStream.height) < 1
  ) {
    throw new Error('Candidate media has no decodable visual stream')
  }
  const durationSeconds = Number(probe?.format?.duration ?? videoStream.duration)
  const decodedFrameSeconds = Array.isArray(probe?.frames)
    ? probe.frames
        .map((frame) =>
          Number(frame.best_effort_timestamp_time ?? frame.pts_time ?? frame.pkt_pts_time),
        )
        .filter((seconds) => Number.isFinite(seconds) && seconds >= 0)
    : []
  const finalFrameSeconds =
    decodedFrameSeconds.length > 0 ? Math.max(...decodedFrameSeconds) : Number.NaN
  if (
    media.mediaKind === 'video' &&
    (!Number.isFinite(durationSeconds) ||
      durationSeconds <= 1 / 30 ||
      !Number.isFinite(finalFrameSeconds) ||
      finalFrameSeconds > durationSeconds)
  ) {
    throw new Error('Candidate video duration is invalid')
  }
  return {
    durationSeconds: media.mediaKind === 'video' ? durationSeconds : null,
    finalFrameSeconds: media.mediaKind === 'video' ? finalFrameSeconds : null,
    height: Number(videoStream.height),
    width: Number(videoStream.width),
  }
}

function workingArtifactPlan(plan, artifactDirectory) {
  return {
    ...plan,
    artifactDirectory,
    browserCapture: plan.browserCapture.enabled
      ? {
          ...plan.browserCapture,
          output: artifactPath(artifactDirectory, basename(plan.browserCapture.output)),
          responsive: (plan.browserCapture.responsive ?? []).map((capture) => ({
            ...capture,
            output: artifactPath(artifactDirectory, basename(capture.output)),
          })),
        }
      : plan.browserCapture,
  }
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function contactSheetHtml(plan, artifactFiles) {
  const cards = artifactFiles
    .map(
      ({ kind, file }) => `
        <figure>
          <img src="${htmlEscape(file)}" alt="${htmlEscape(kind)}" loading="lazy">
          <figcaption>${htmlEscape(kind)}</figcaption>
        </figure>`,
    )
    .join('')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FreshCut motion contact sheet — ${htmlEscape(plan.sceneId)}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 24px; background: #111; color: #f5f5f5; }
    header { max-width: 72rem; margin: 0 auto 24px; }
    h1 { margin: 0 0 8px; font-size: clamp(1.5rem, 4vw, 2.5rem); }
    p { color: #bbb; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
    figure { margin: 0; padding: 12px; background: #1b1b1b; border: 1px solid #333; border-radius: 10px; }
    img { display: block; width: 100%; height: auto; background: #000; }
    figcaption { margin-top: 8px; overflow-wrap: anywhere; font-size: .875rem; color: #ddd; }
  </style>
</head>
<body>
  <header>
    <h1>FreshCut motion contact sheet</h1>
    <p>Scene: ${htmlEscape(plan.sceneId)} · Copy: ${htmlEscape(plan.copyPlacement)} · Candidate: ${htmlEscape(plan.candidateSha256.slice(0, 12))}</p>
  </header>
  <main>${cards}</main>
</body>
</html>
`
}

function qaManifest(plan, artifactFiles, transitionHashes) {
  return {
    schemaVersion: 'freshcut-motion-contact-sheet-qa/v1',
    sceneId: plan.sceneId,
    copyPlacement: plan.copyPlacement,
    mediaKind: plan.mediaKind,
    candidateSha256: plan.candidateSha256,
    objectPosition: plan.objectPosition,
    phoneViewports: plan.phoneViewports,
    samples: plan.samples,
    browserCapture: plan.browserCapture.enabled
      ? {
          enabled: true,
          captures: [
            { width: plan.browserCapture.width, height: plan.browserCapture.height },
            ...(plan.browserCapture.responsive ?? []).map(({ width, height }) => ({
              width,
              height,
            })),
          ],
        }
      : { enabled: false },
    transitions: plan.transitionPairs.map(({ fromScene, toScene }) => ({
      fromScene,
      fromSha256: transitionHashes[fromScene],
      toScene,
      toSha256: transitionHashes[toScene],
    })),
    artifacts: artifactFiles,
  }
}

function assertArtifactsExist(artifactFiles, directory) {
  for (const artifact of artifactFiles) {
    if (!existsSync(artifactPath(directory, artifact.file))) {
      throw new Error(`QA artifact was not produced for ${artifact.kind}`)
    }
  }
}

export function isFreshCutMotionMediaRequest(requestUrl, baseUrl) {
  try {
    const request = new URL(requestUrl)
    const base = new URL(baseUrl)
    if (request.origin !== base.origin) return false
    return (
      request.pathname.startsWith('/images/freshcut/') ||
      request.pathname.startsWith('/media/freshcut-motion/')
    )
  } catch {
    return false
  }
}

export function isInterceptedFreshCutPoster(currentSrc, baseUrl, interceptedRequests) {
  return isFreshCutMotionMediaRequest(currentSrc, baseUrl) && interceptedRequests.has(currentSrc)
}

function candidateContentType(path) {
  switch (extname(path).toLowerCase()) {
    case '.avif':
      return 'image/avif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

export async function captureFreshCutMotionDom(plan, options = {}) {
  if (!plan.browserCapture.enabled || plan.mediaKind !== 'image') {
    throw new Error('DOM capture requires a still-image QA plan')
  }
  let candidateBody
  try {
    candidateBody = readFileSync(plan.candidatePath)
  } catch {
    throw new Error('Candidate media could not be read')
  }
  const contentType = candidateContentType(plan.candidatePath)
  const captures = [
    {
      height: plan.browserCapture.height,
      output: plan.browserCapture.output,
      width: plan.browserCapture.width,
    },
    ...(plan.browserCapture.responsive ?? []),
  ]
  const playwright = options.playwrightLoader
    ? await options.playwrightLoader()
    : await import('@playwright/test')
  if (!playwright?.chromium) throw new Error('Playwright Chromium is unavailable')

  const browser = await playwright.chromium.launch({ headless: true })
  try {
    for (const capture of captures) {
      const context = await browser.newContext({
        locale: 'sv-SE',
        timezoneId: 'Europe/Stockholm',
        viewport: { width: capture.width, height: capture.height },
      })
      try {
        const page = await context.newPage()
        const interceptedCandidateRequests = new Set()
        await page.route('**/*', async (route) => {
          const request = route.request()
          if (
            request.resourceType() === 'image' &&
            isFreshCutMotionMediaRequest(request.url(), plan.baseUrl)
          ) {
            const requestUrl = request.url()
            await route.fulfill({
              body: candidateBody,
              contentType,
              headers: { 'cache-control': 'no-store' },
              status: 200,
            })
            interceptedCandidateRequests.add(requestUrl)
            return
          }
          await route.continue()
        })

        const targetUrl = new URL('/', `${plan.baseUrl}/`).toString()
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
        if (!response || response.status() >= 400) {
          throw new Error('Local motiontest document did not load successfully')
        }
        const experience = page.locator('[data-storefront-experience="freshcut-motiontest"]')
        await experience.waitFor({ state: 'visible', timeout: 15_000 })
        const motionOwner = page.locator(
          '[data-storefront-experience="freshcut-motiontest"] [data-motion-mode]',
        )
        await motionOwner.waitFor({ state: 'visible', timeout: 15_000 })
        await page.waitForFunction(
          () =>
            document
              .querySelector(
                '[data-storefront-experience="freshcut-motiontest"] [data-motion-mode]',
              )
              ?.getAttribute('data-motion-mode') === 'enhanced',
          undefined,
          { timeout: 15_000 },
        )
        const checkpoint = page.locator(
          `nav[aria-label="Upplevelsens scener"] a[href="#motion-scene-${plan.sceneId}"]`,
        )
        if ((await checkpoint.count()) !== 1) throw new Error('Motiontest checkpoint is missing')
        if (plan.sceneId === 'hero') {
          await motionOwner.evaluate((element) => {
            const rootTop = element.getBoundingClientRect().top + window.scrollY
            window.scrollTo(0, rootTop)
          })
        } else {
          await checkpoint.click()
        }
        await page.waitForFunction(
          (sceneId) =>
            document
              .querySelector(
                '[data-storefront-experience="freshcut-motiontest"] [data-motion-mode]',
              )
              ?.getAttribute('data-motion-scene') === sceneId,
          plan.sceneId,
          { timeout: 15_000 },
        )
        const scene = page.locator(
          `[data-motion-stage] > section[data-motion-scene="${plan.sceneId}"]`,
        )
        await scene.waitFor({ state: 'visible', timeout: 15_000 })
        if ((await scene.getAttribute('data-motion-copy-placement')) !== plan.copyPlacement) {
          throw new Error('Motiontest DOM copy placement does not match the QA input')
        }
        if (plan.objectPosition) {
          await scene.evaluate((element, objectPosition) => {
            element.style.setProperty('--motion-scene-crop', objectPosition.desktop)
            element.style.setProperty('--motion-scene-mobile-crop', objectPosition.mobile)
          }, plan.objectPosition)
        }
        await page.locator('[data-motion-stage] video').evaluateAll((videos) => {
          for (const video of videos) {
            video.pause()
            video.removeAttribute('autoplay')
            video.style.setProperty('display', 'none', 'important')
          }
        })
        const poster = scene.locator(`img[data-motion-poster-image="${plan.sceneId}"]`)
        await poster.waitFor({ state: 'visible', timeout: 15_000 })
        const decoded = await poster.evaluate(async (image) => {
          if (!(image instanceof HTMLImageElement)) return false
          try {
            await image.decode()
          } catch {
            return false
          }
          return image.complete && image.naturalWidth > 0
        })
        if (!decoded) {
          throw new Error('Intercepted candidate image did not decode in motiontest DOM')
        }
        const currentSrc = await poster.evaluate((image) =>
          image instanceof HTMLImageElement ? image.currentSrc : '',
        )
        if (!isInterceptedFreshCutPoster(currentSrc, plan.baseUrl, interceptedCandidateRequests)) {
          throw new Error('Motiontest poster was not served by the candidate intercept')
        }
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready
        })
        await page.addStyleTag({
          content:
            '*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition-duration:0s!important}',
        })
        await page.screenshot({
          animations: 'disabled',
          fullPage: false,
          path: capture.output,
        })
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

export async function executeFreshCutQaHarness(input, options = {}) {
  const runCommand = options.runCommand ?? defaultRunCommand
  const ffprobePath = options.ffprobePath ?? process.env.FFPROBE_BIN ?? 'ffprobe'
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_BIN ?? 'ffmpeg'
  const candidateSha256 = await hashQaMediaFile(input.candidatePath)
  const candidateProbe = probeQaMedia(
    { mediaKind: input.mediaKind, path: input.candidatePath },
    ffprobePath,
    runCommand,
  )
  const transitionMediaFacts = {}
  const transitionHashes = { [input.sceneId]: candidateSha256 }
  for (const transition of input.transitionInputs) {
    const probe = probeQaMedia(transition, ffprobePath, runCommand)
    transitionMediaFacts[transition.sceneId] = {
      durationSeconds: probe.durationSeconds,
      finalFrameSeconds: probe.finalFrameSeconds,
    }
    transitionHashes[transition.sceneId] = await hashQaMediaFile(transition.path)
  }
  const plan = buildFreshCutQaArtifactPlan(input, {
    candidateSha256,
    durationSeconds: candidateProbe.durationSeconds,
    finalFrameSeconds: candidateProbe.finalFrameSeconds,
    transitionMediaFacts,
  })
  if (existsSync(plan.artifactDirectory)) {
    throw new Error('QA artifact package already exists for this candidate and scene')
  }

  mkdirSync(plan.outputDir, { recursive: true })
  const temporaryDirectory = realpathSync(
    mkdtempSync(join(plan.outputDir, `.${plan.sceneId}-${candidateSha256.slice(0, 12)}-tmp-`)),
  )
  const workingPlan = workingArtifactPlan(plan, temporaryDirectory)
  try {
    const commands = buildFreshCutQaFfmpegCommands(workingPlan, { ffmpegPath })
    for (const step of commands) {
      runCommand(step.command, step.args, { label: step.kind })
    }
    if (workingPlan.browserCapture.enabled) {
      const captureBrowser = options.captureBrowser ?? captureFreshCutMotionDom
      await captureBrowser(workingPlan, options)
    }
    const artifactFiles = [
      ...commands.map((step) => ({ kind: step.kind, file: basename(step.args.at(-1)) })),
      ...(workingPlan.browserCapture.enabled
        ? [
            { kind: 'dom-1440x900', file: basename(workingPlan.browserCapture.output) },
            ...(workingPlan.browserCapture.responsive ?? []).map((capture) => ({
              kind: `dom-${capture.width}x${capture.height}`,
              file: basename(capture.output),
            })),
          ]
        : []),
    ]
    assertArtifactsExist(artifactFiles, temporaryDirectory)
    writeFileSync(
      artifactPath(temporaryDirectory, 'qa-manifest.json'),
      `${JSON.stringify(qaManifest(workingPlan, artifactFiles, transitionHashes), null, 2)}\n`,
      'utf8',
    )
    writeFileSync(
      artifactPath(temporaryDirectory, 'contact-sheet.html'),
      contactSheetHtml(workingPlan, artifactFiles),
      'utf8',
    )
    renameSync(temporaryDirectory, plan.artifactDirectory)
    return { artifactDirectory: plan.artifactDirectory, candidateSha256 }
  } catch (error) {
    rmSync(temporaryDirectory, { force: true, recursive: true })
    throw error
  }
}

async function main() {
  const input = resolveQaHarnessInput(process.argv.slice(2), process.env)
  const result = await executeFreshCutQaHarness(input)
  console.log(`FreshCut QA package ready: ${result.artifactDirectory}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(String(error?.message ?? error).replace(/https?:\/\/\S+/gi, '[redacted-url]'))
    process.exit(1)
  })
}
