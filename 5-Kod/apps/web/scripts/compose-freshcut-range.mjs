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
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FRESHCUT_RANGE_RECIPE_VERSION = 'freshcut-range-composite-v1'

const PUBLIC_DIRECTORY = realpathSync(fileURLToPath(new URL('../public/', import.meta.url)))
const IMAGE_EXTENSIONS = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp'])
const ROLE_FLAGS = ['--r1', '--r2', '--r3', '--r4', '--r5']
const USAGE =
  'Usage: --r1 <image> --r2 <image> --r3 <image> --r4 <image> --r5 <image> --output <outside-public.png>'

const FILTER_COMPLEX = [
  'color=c=0x080808:s=1920x1080:r=1[base]',
  '[0:v]scale=768:1080:force_original_aspect_ratio=increase,crop=768:1080,setsar=1[r1]',
  '[1:v]scale=282:534:force_original_aspect_ratio=increase,crop=282:534,setsar=1[r2]',
  '[2:v]scale=282:534:force_original_aspect_ratio=increase,crop=282:534,setsar=1[r3]',
  '[3:v]scale=282:534:force_original_aspect_ratio=increase,crop=282:534,setsar=1[r4]',
  '[4:v]scale=282:534:force_original_aspect_ratio=increase,crop=282:534,setsar=1[r5]',
  '[base][r1]overlay=576:0:shortest=1[layer1]',
  '[layer1][r2]overlay=1348:4:shortest=1[layer2]',
  '[layer2][r3]overlay=1634:4:shortest=1[layer3]',
  '[layer3][r4]overlay=1348:542:shortest=1[layer4]',
  '[layer4][r5]overlay=1634:542:shortest=1[layer5]',
  '[layer5]drawbox=x=0:y=0:w=768:h=1080:color=0x080808@1:t=fill[out]',
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

function assertOutputOutsidePublic(outputPath) {
  const outputParent = dirname(outputPath)
  if (!existsSync(outputParent)) throw new Error('Output parent directory must already exist')
  const parentStat = lstatSync(outputParent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('Output parent must be one real local directory')
  }
  const realParent = realpathSync(outputParent)
  const realCandidate = join(realParent, basename(outputPath))
  if (isWithin(PUBLIC_DIRECTORY, realCandidate)) {
    throw new Error('Range composite output must stay outside public')
  }
}

function validateInputs(inputs) {
  if (!Array.isArray(inputs) || inputs.length !== 5) {
    throw new Error('Range composite requires exactly five accepted stills in R1-R5 order')
  }
  const resolvedInputs = inputs.map((path) => resolve(String(path ?? '')))
  if (new Set(resolvedInputs.map(pathKey)).size !== 5) {
    throw new Error('R1-R5 must be five distinct accepted stills')
  }
  for (const inputPath of resolvedInputs) {
    if (!IMAGE_EXTENSIONS.has(extname(inputPath).toLowerCase())) {
      throw new Error('Every R1-R5 input must be an image file')
    }
    if (!existsSync(inputPath)) throw new Error('Every R1-R5 image must exist')
    const inputStat = lstatSync(inputPath)
    if (!inputStat.isFile() || inputStat.isSymbolicLink()) {
      throw new Error('Every R1-R5 image must be one regular file')
    }
    if (inputStat.size <= 0) throw new Error('Every R1-R5 image must be non-empty')
  }
  const hashes = resolvedInputs.map(sha256File)
  if (new Set(hashes).size !== 5) {
    throw new Error('R1-R5 must contain five distinct accepted stills')
  }
  return { hashes, resolvedInputs }
}

function normalizedPlan(input) {
  const { hashes, resolvedInputs } = validateInputs(input.inputs)
  if (!String(input.outputPath ?? '').trim()) throw new Error('Explicit output path is required')
  const outputPath = resolve(input.outputPath)
  if (extname(outputPath).toLowerCase() !== '.png') {
    throw new Error('Range composite output must be one PNG image')
  }
  assertOutputOutsidePublic(outputPath)
  const receiptPath = `${outputPath}.receipt.json`
  if (existsSync(outputPath) || existsSync(receiptPath)) {
    throw new Error('Range composite output or receipt already exists')
  }
  return { hashes, inputs: resolvedInputs, outputPath, receiptPath }
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

function safeFfmpegVersion(stdout) {
  const firstLine = String(stdout).split(/\r?\n/, 1)[0].trim()
  const match = /^ffmpeg version\s+([^\s]+)/i.exec(firstLine)
  if (!match) throw new Error('Unable to identify FFmpeg version')
  return `ffmpeg version ${match[1]}`
}

export function parseFreshCutRangeArgs(args) {
  const allowed = new Set([...ROLE_FLAGS, '--output'])
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
  if (!ROLE_FLAGS.every((flag) => values.has(flag)) || !values.has('--output')) {
    throw new Error(`Exactly R1-R5 and one output are required. ${USAGE}`)
  }
  return {
    inputs: ROLE_FLAGS.map((flag) => values.get(flag)),
    outputPath: values.get('--output'),
  }
}

export function buildFreshCutRangeCompositeCommand(input, options = {}) {
  const inputs = Array.isArray(input.inputs)
    ? input.inputs.map((path) => slashPath(resolve(path)))
    : []
  if (inputs.length !== 5) throw new Error('Range composite command requires exactly five inputs')
  const outputPath = slashPath(resolve(input.outputPath))
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
      ...inputs.flatMap((path) => ['-i', path]),
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
      '6',
      '-pix_fmt',
      'rgb24',
      '-threads',
      '1',
      '-flags:v',
      '+bitexact',
      '-update',
      '1',
      outputPath,
    ],
  }
}

export function executeFreshCutRangeComposite(input, options = {}) {
  const plan = normalizedPlan(input)
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_BIN || 'ffmpeg'
  const runCommand = options.runCommand || run
  const ffmpegVersion = safeFfmpegVersion(runCommand(ffmpegPath, ['-version'], { capture: true }))

  for (const inputPath of plan.inputs) {
    runCommand(ffmpegPath, readableImageArgs(inputPath))
  }

  const temporaryDirectory = mkdtempSync(join(dirname(plan.outputPath), '.freshcut-range-tmp-'))
  const temporaryOutput = join(temporaryDirectory, basename(plan.outputPath))
  const temporaryReceipt = join(temporaryDirectory, `${basename(plan.outputPath)}.receipt.json`)
  let copiedOutput = false
  let copiedReceipt = false

  try {
    const command = buildFreshCutRangeCompositeCommand(
      { inputs: plan.inputs, outputPath: temporaryOutput },
      { ffmpegPath },
    )
    runCommand(command.command, command.args)
    if (!existsSync(temporaryOutput)) throw new Error('FFmpeg did not create the Range composite')
    const outputStat = lstatSync(temporaryOutput)
    if (!outputStat.isFile() || outputStat.isSymbolicLink() || outputStat.size <= 0) {
      throw new Error('FFmpeg Range composite must be one non-empty regular file')
    }
    runCommand(ffmpegPath, readableImageArgs(temporaryOutput))
    const finalInputHashes = plan.inputs.map(sha256File)
    if (finalInputHashes.some((hash, index) => hash !== plan.hashes[index])) {
      throw new Error('An accepted still changed during composition')
    }
    const outputSha256 = sha256File(temporaryOutput)
    const receipt = {
      schemaVersion: 1,
      recipeVersion: FRESHCUT_RANGE_RECIPE_VERSION,
      orderedInputSha256: plan.hashes,
      outputSha256,
      ffmpegVersion,
    }
    writeFileSync(temporaryReceipt, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })

    // Re-resolve the parent just before publication so a junction cannot redirect into public.
    assertOutputOutsidePublic(plan.outputPath)
    if (existsSync(plan.outputPath) || existsSync(plan.receiptPath)) {
      throw new Error('Range composite output or receipt already exists')
    }
    copyFileSync(temporaryOutput, plan.outputPath, fsConstants.COPYFILE_EXCL)
    copiedOutput = true
    if (sha256File(plan.outputPath) !== outputSha256) {
      throw new Error('Published Range composite hash does not match the encoded output')
    }
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
  const input = parseFreshCutRangeArgs(process.argv.slice(2))
  const result = executeFreshCutRangeComposite(input)
  console.log(`Prepared FreshCut Range composite: ${result.outputPath}`)
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
