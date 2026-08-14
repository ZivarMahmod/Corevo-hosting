import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FRESHCUT_SALON_MASTER_RECIPE_ID = 'freshcut-salon-master-v1'
export const FRESHCUT_SALON_MASTER_RECIPE_VERSION = 1

const REPOSITORY_DIRECTORY = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const USAGE = 'Usage: --input <2752x1536-rgba.png> --output <outside-repository.png>'
const EXPECTED_MEDIA = Object.freeze({
  codec: 'png',
  width: 2752,
  height: 1536,
  pixelFormat: 'rgba',
})
const RECIPE = Object.freeze({
  id: FRESHCUT_SALON_MASTER_RECIPE_ID,
  version: FRESHCUT_SALON_MASTER_RECIPE_VERSION,
  input: EXPECTED_MEDIA,
  segments: [
    { source: { x: 0, y: 0, width: 2752, height: 1050 }, outputHeight: 880 },
    { source: { x: 0, y: 1050, width: 2752, height: 486 }, outputHeight: 656 },
  ],
  output: EXPECTED_MEDIA,
  resampler: 'lanczos',
  encoding: {
    codec: 'png',
    compressionLevel: 9,
    prediction: 'mixed',
    pixelFormat: 'rgba',
    threads: 1,
    bitexact: true,
  },
})

export const FRESHCUT_SALON_MASTER_RECIPE_SHA256 = createHash('sha256')
  .update(JSON.stringify(RECIPE))
  .digest('hex')

const FILTER_COMPLEX = [
  '[0:v]split=2[top-source][floor-source]',
  '[top-source]crop=2752:1050:0:0,scale=2752:880:flags=lanczos,setsar=1[top]',
  '[floor-source]crop=2752:486:0:1050,scale=2752:656:flags=lanczos,setsar=1[floor]',
  '[top][floor]vstack=inputs=2,format=rgba,setsar=1[out]',
].join(';')

function slashPath(path) {
  return String(path).replaceAll('\\', '/')
}

function pathKey(path) {
  const absolutePath = resolve(path)
  return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath
}

function isWithin(parent, candidate) {
  const relation = relative(pathKey(parent), pathKey(candidate))
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
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

function safeFfmpegVersion(stdout) {
  const firstLine = String(stdout).split(/\r?\n/, 1)[0].trim()
  const match = /^ffmpeg version\s+([^\s]+)/i.exec(firstLine)
  if (!match) throw new Error('Unable to identify FFmpeg version')
  return `ffmpeg version ${match[1]}`
}

function assertOutputOutsideRepository(outputPath) {
  const outputParent = dirname(outputPath)
  if (!existsSync(outputParent)) throw new Error('Output parent directory must already exist')
  const parentStat = lstatSync(outputParent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('Output parent must be one real local directory')
  }
  const realParent = realpathSync(outputParent)
  const realCandidate = join(realParent, basename(outputPath))
  if (isWithin(REPOSITORY_DIRECTORY, realCandidate)) {
    throw new Error('Salon master output must stay outside the repository and public')
  }
}

function validateInput(inputPath) {
  if (extname(inputPath).toLowerCase() !== '.png') {
    throw new Error('Salon master input must be one PNG image')
  }
  if (!existsSync(inputPath)) throw new Error('Salon master input must exist')
  const inputStat = lstatSync(inputPath)
  if (!inputStat.isFile() || inputStat.isSymbolicLink()) {
    throw new Error('Salon master input must be one regular file')
  }
  if (inputStat.size <= 0) throw new Error('Salon master input must be non-empty')
}

function normalizedPlan(input) {
  if (!String(input.inputPath ?? '').trim()) throw new Error('Explicit input path is required')
  if (!String(input.outputPath ?? '').trim()) throw new Error('Explicit output path is required')
  const inputPath = resolve(input.inputPath)
  const outputPath = resolve(input.outputPath)
  validateInput(inputPath)
  if (extname(outputPath).toLowerCase() !== '.png') {
    throw new Error('Salon master output must be one PNG image')
  }
  if (pathKey(inputPath) === pathKey(outputPath)) {
    throw new Error('Salon master input and output must be different files')
  }
  assertOutputOutsideRepository(outputPath)
  const receiptPath = `${outputPath}.receipt.json`
  if (existsSync(outputPath) || existsSync(receiptPath)) {
    throw new Error('Salon master output or receipt already exists')
  }
  return {
    inputPath,
    outputPath,
    receiptPath,
    sourceSha256: sha256File(inputPath),
  }
}

function probeArgs(inputPath) {
  return [
    '-v',
    'error',
    '-select_streams',
    'v',
    '-show_entries',
    'stream=codec_name,width,height,pix_fmt',
    '-of',
    'json',
    slashPath(inputPath),
  ]
}

function probeExpectedPng(path, ffprobePath, runCommand) {
  let parsed
  try {
    parsed = JSON.parse(runCommand(ffprobePath, probeArgs(path), { capture: true }))
  } catch (error) {
    throw new Error(`Unable to probe salon master PNG: ${error?.message ?? error}`)
  }
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : []
  const stream = streams[0]
  if (
    streams.length !== 1 ||
    stream?.codec_name !== EXPECTED_MEDIA.codec ||
    stream?.width !== EXPECTED_MEDIA.width ||
    stream?.height !== EXPECTED_MEDIA.height ||
    stream?.pix_fmt !== EXPECTED_MEDIA.pixelFormat
  ) {
    throw new Error('Salon master media must decode as exactly one 2752x1536 RGBA PNG')
  }
  return EXPECTED_MEDIA
}

function readableImageArgs(inputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-xerror',
    '-i',
    slashPath(inputPath),
    '-map',
    '0:v:0',
    '-frames:v',
    '1',
    '-f',
    'null',
    '-',
  ]
}

function assertSourceHash(plan, message) {
  if (sha256File(plan.inputPath) !== plan.sourceSha256) throw new Error(message)
}

export function parseFreshCutSalonMasterArgs(args) {
  const allowed = new Set(['--input', '--output'])
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!allowed.has(flag)) throw new Error(`Unknown argument: ${flag ?? '(missing)'}; ${USAGE}`)
    if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`)
    if (value === undefined || allowed.has(value) || String(value).startsWith('--')) {
      throw new Error(`Missing value for ${flag}; ${USAGE}`)
    }
    values.set(flag, value)
  }
  if (!values.has('--input') || !values.has('--output')) {
    throw new Error(`Exactly one input and one output are required. ${USAGE}`)
  }
  return { inputPath: values.get('--input'), outputPath: values.get('--output') }
}

export function buildFreshCutSalonMasterCommand(input, options = {}) {
  if (!String(input.inputPath ?? '').trim()) throw new Error('Explicit input path is required')
  if (!String(input.outputPath ?? '').trim()) throw new Error('Explicit output path is required')
  return {
    command: options.ffmpegPath || 'ffmpeg',
    args: [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-n',
      '-fflags',
      '+bitexact',
      '-sws_flags',
      'lanczos+accurate_rnd+full_chroma_int+bitexact',
      '-i',
      slashPath(resolve(input.inputPath)),
      '-filter_complex',
      FILTER_COMPLEX,
      '-map',
      '[out]',
      '-frames:v',
      '1',
      '-an',
      '-sn',
      '-dn',
      '-map_metadata',
      '-1',
      '-c:v',
      'png',
      '-compression_level',
      '9',
      '-pred',
      'mixed',
      '-pix_fmt',
      'rgba',
      '-threads',
      '1',
      '-flags:v',
      '+bitexact',
      '-update',
      '1',
      slashPath(resolve(input.outputPath)),
    ],
  }
}

export function executeFreshCutSalonMaster(input, options = {}) {
  const plan = normalizedPlan(input)
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_BIN || 'ffmpeg'
  const ffprobePath = options.ffprobePath || process.env.FFPROBE_BIN || 'ffprobe'
  const runCommand = options.runCommand || run
  const ffmpegVersion = safeFfmpegVersion(runCommand(ffmpegPath, ['-version'], { capture: true }))

  probeExpectedPng(plan.inputPath, ffprobePath, runCommand)
  runCommand(ffmpegPath, readableImageArgs(plan.inputPath))
  assertSourceHash(plan, 'Salon master source changed during validation')

  const temporaryDirectory = mkdtempSync(
    join(dirname(plan.outputPath), '.freshcut-salon-master-tmp-'),
  )
  const temporaryOutput = join(temporaryDirectory, basename(plan.outputPath))
  const temporaryReceipt = join(temporaryDirectory, `${basename(plan.outputPath)}.receipt.json`)
  let copiedOutput = false
  let copiedReceipt = false

  try {
    const command = buildFreshCutSalonMasterCommand(
      { inputPath: plan.inputPath, outputPath: temporaryOutput },
      { ffmpegPath },
    )
    runCommand(command.command, command.args)
    if (!existsSync(temporaryOutput)) throw new Error('FFmpeg did not create the salon master')
    const outputStat = lstatSync(temporaryOutput)
    if (!outputStat.isFile() || outputStat.isSymbolicLink() || outputStat.size <= 0) {
      throw new Error('FFmpeg salon master must be one non-empty regular file')
    }
    probeExpectedPng(temporaryOutput, ffprobePath, runCommand)
    runCommand(ffmpegPath, readableImageArgs(temporaryOutput))
    assertSourceHash(plan, 'Salon master source changed during composition')

    const outputSha256 = sha256File(temporaryOutput)
    const receipt = {
      schemaVersion: 1,
      recipeId: FRESHCUT_SALON_MASTER_RECIPE_ID,
      recipeVersion: FRESHCUT_SALON_MASTER_RECIPE_VERSION,
      recipeSha256: FRESHCUT_SALON_MASTER_RECIPE_SHA256,
      sourceSha256: plan.sourceSha256,
      outputSha256,
      ffmpegVersion,
      input: EXPECTED_MEDIA,
      output: EXPECTED_MEDIA,
    }
    writeFileSync(temporaryReceipt, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })

    assertOutputOutsideRepository(plan.outputPath)
    if (existsSync(plan.outputPath) || existsSync(plan.receiptPath)) {
      throw new Error('Salon master output or receipt already exists')
    }
    assertSourceHash(plan, 'Salon master source changed before publication')
    copyFileSync(temporaryOutput, plan.outputPath, fsConstants.COPYFILE_EXCL)
    copiedOutput = true
    if (sha256File(plan.outputPath) !== outputSha256) {
      throw new Error('Published salon master hash does not match the encoded output')
    }
    assertSourceHash(plan, 'Salon master source changed during publication')
    copyFileSync(temporaryReceipt, plan.receiptPath, fsConstants.COPYFILE_EXCL)
    copiedReceipt = true
    return {
      outputPath: slashPath(plan.outputPath),
      receiptPath: slashPath(plan.receiptPath),
    }
  } catch (error) {
    if (copiedReceipt) rmSync(plan.receiptPath, { force: true })
    if (copiedOutput) rmSync(plan.outputPath, { force: true })
    throw error
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}

function main() {
  const input = parseFreshCutSalonMasterArgs(process.argv.slice(2))
  const result = executeFreshCutSalonMaster(input)
  console.log(`Prepared FreshCut salon master: ${result.outputPath}`)
  console.log(`Receipt: ${result.receiptPath}`)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(String(error?.message ?? error))
    process.exit(1)
  }
}
