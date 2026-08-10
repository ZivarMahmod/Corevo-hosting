import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FRESHCUT_SALON_MASTER_RECIPE_ID,
  FRESHCUT_SALON_MASTER_RECIPE_SHA256,
  FRESHCUT_SALON_MASTER_RECIPE_VERSION,
  buildFreshCutSalonMasterCommand,
  executeFreshCutSalonMaster,
  parseFreshCutSalonMasterArgs,
} from './compose-freshcut-salon-master.mjs'

const scratchDirectories = []

function scratchDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'freshcut-salon-master-test-'))
  scratchDirectories.push(directory)
  return directory
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function fixture() {
  const directory = scratchDirectory()
  const inputPath = join(directory, 'S0.png')
  writeFileSync(inputPath, 'synthetic-source-png')
  return {
    directory,
    inputPath,
    outputPath: join(directory, 'salon-master.png'),
  }
}

const EXPECTED_PROBE = JSON.stringify({
  streams: [{ codec_name: 'png', width: 2752, height: 1536, pix_fmt: 'rgba' }],
})

function successfulRunner(calls, outputBytes = Buffer.from('deterministic-salon-master-png')) {
  return vi.fn((command, args, options = {}) => {
    calls.push({ command, args: [...args], capture: options.capture === true })
    if (args[0] === '-version') return 'ffmpeg version 9.0-full_build\nconfiguration omitted\n'
    if (command === 'ffprobe-test') return EXPECTED_PROBE
    if (args.includes('-filter_complex')) writeFileSync(args.at(-1), outputBytes)
    return ''
  })
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('FreshCut salon master compositor', () => {
  it('accepts exactly one input PNG and one explicit output PNG', () => {
    expect(
      parseFreshCutSalonMasterArgs(['--input', 'S0.png', '--output', 'salon-master.png']),
    ).toEqual({ inputPath: 'S0.png', outputPath: 'salon-master.png' })
    expect(() => parseFreshCutSalonMasterArgs(['--input', 'S0.png'])).toThrow(/input.*output/i)
    expect(() =>
      parseFreshCutSalonMasterArgs([
        '--input',
        'S0.png',
        '--input',
        'other.png',
        '--output',
        'salon-master.png',
      ]),
    ).toThrow(/duplicate/i)
    expect(() =>
      parseFreshCutSalonMasterArgs([
        '--input',
        'S0.png',
        '--output',
        'salon-master.png',
        '--shift',
        '112',
      ]),
    ).toThrow(/unknown argument/i)
  })

  it('builds only the fixed 2752x1536 two-segment reprojection recipe', () => {
    const { inputPath, outputPath } = fixture()
    const command = buildFreshCutSalonMasterCommand({ inputPath, outputPath })

    expect(command.command).toBe('ffmpeg')
    expect(command.args.filter((argument) => argument === '-i')).toHaveLength(1)
    expect(command.args[command.args.indexOf('-i') + 1]).toBe(
      resolve(inputPath).replaceAll('\\', '/'),
    )
    const filter = command.args[command.args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('crop=2752:1050:0:0')
    expect(filter).toContain('scale=2752:880:flags=lanczos')
    expect(filter).toContain('crop=2752:486:0:1050')
    expect(filter).toContain('scale=2752:656:flags=lanczos')
    expect(filter).toContain('vstack=inputs=2')
    expect(filter).toContain('format=rgba')
    expect(filter).toContain('setsar=1')
    expect(filter).not.toMatch(/overlay|drawtext|subtitles|perspective|pad/i)
    expect(command.args).toContain('+bitexact')
    expect(command.args[command.args.indexOf('-pred') + 1]).toBe('mixed')
    expect(command.args[command.args.indexOf('-pix_fmt') + 1]).toBe('rgba')
    expect(command.args[command.args.indexOf('-threads') + 1]).toBe('1')
    expect(command.args.at(-1)).toBe(resolve(outputPath).replaceAll('\\', '/'))
  })

  it('validates decode geometry and writes a path-free, recipe-bound receipt', () => {
    const { directory, inputPath, outputPath } = fixture()
    const calls = []
    const outputBytes = Buffer.from('canonical-output-png')
    const runCommand = successfulRunner(calls, outputBytes)

    const result = executeFreshCutSalonMaster(
      { inputPath, outputPath },
      { ffmpegPath: 'ffmpeg-test', ffprobePath: 'ffprobe-test', runCommand },
    )

    expect(result).toEqual({
      outputPath: resolve(outputPath).replaceAll('\\', '/'),
      receiptPath: `${resolve(outputPath).replaceAll('\\', '/')}.receipt.json`,
    })
    const probeCalls = calls.filter(({ command }) => command === 'ffprobe-test')
    expect(probeCalls).toHaveLength(2)
    const decodeCalls = calls.filter(
      ({ args }) => args.includes('-f') && args[args.indexOf('-f') + 1] === 'null',
    )
    expect(decodeCalls).toHaveLength(2)

    const receipt = JSON.parse(readFileSync(`${outputPath}.receipt.json`, 'utf8'))
    expect(receipt).toEqual({
      schemaVersion: 1,
      recipeId: FRESHCUT_SALON_MASTER_RECIPE_ID,
      recipeVersion: FRESHCUT_SALON_MASTER_RECIPE_VERSION,
      recipeSha256: FRESHCUT_SALON_MASTER_RECIPE_SHA256,
      sourceSha256: sha256(readFileSync(inputPath)),
      outputSha256: sha256(outputBytes),
      ffmpegVersion: 'ffmpeg version 9.0-full_build',
      input: { codec: 'png', width: 2752, height: 1536, pixelFormat: 'rgba' },
      output: { codec: 'png', width: 2752, height: 1536, pixelFormat: 'rgba' },
    })
    const receiptJson = JSON.stringify(receipt)
    expect(receiptJson).not.toContain(directory)
    expect(receiptJson).not.toContain('S0.png')
    expect(receiptJson).not.toContain('salon-master.png')
    expect(FRESHCUT_SALON_MASTER_RECIPE_SHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(readFileSync(outputPath)).toEqual(outputBytes)
  })

  it('rejects anything except one 2752x1536 RGBA PNG before encoding', () => {
    const expectedStream = { codec_name: 'png', width: 2752, height: 1536, pix_fmt: 'rgba' }
    const invalidProbes = [
      { streams: [{ ...expectedStream, codec_name: 'jpeg' }] },
      { streams: [{ ...expectedStream, width: 2048, height: 1152 }] },
      { streams: [{ ...expectedStream, pix_fmt: 'rgb24' }] },
      { streams: [] },
      { streams: [expectedStream, expectedStream] },
    ]

    for (const probe of invalidProbes) {
      const { inputPath, outputPath } = fixture()
      const runCommand = vi.fn((command, args) => {
        if (args[0] === '-version') return 'ffmpeg version 9.0\n'
        if (command === 'ffprobe-test') return JSON.stringify(probe)
        return ''
      })
      expect(() =>
        executeFreshCutSalonMaster(
          { inputPath, outputPath },
          { ffmpegPath: 'ffmpeg-test', ffprobePath: 'ffprobe-test', runCommand },
        ),
      ).toThrow(/2752x1536 rgba png/i)
      expect(existsSync(outputPath)).toBe(false)
      expect(runCommand.mock.calls.some(([, args]) => args.includes('-filter_complex'))).toBe(false)
    }
  })

  it('fails closed for repository output, existing output, or existing receipt', () => {
    const { inputPath, outputPath } = fixture()
    const runCommand = vi.fn()
    const repositoryOutput = resolve(`salon-master-test-${process.pid}-${Date.now()}.png`)

    expect(() =>
      executeFreshCutSalonMaster({ inputPath, outputPath: repositoryOutput }, { runCommand }),
    ).toThrow(/outside.*repository|repository.*outside/i)
    expect(existsSync(repositoryOutput)).toBe(false)

    writeFileSync(outputPath, 'keep-output')
    expect(() => executeFreshCutSalonMaster({ inputPath, outputPath }, { runCommand })).toThrow(
      /already exists/i,
    )
    expect(readFileSync(outputPath, 'utf8')).toBe('keep-output')
    rmSync(outputPath)

    writeFileSync(`${outputPath}.receipt.json`, 'keep-receipt')
    expect(() => executeFreshCutSalonMaster({ inputPath, outputPath }, { runCommand })).toThrow(
      /already exists/i,
    )
    expect(readFileSync(`${outputPath}.receipt.json`, 'utf8')).toBe('keep-receipt')
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('removes temporary work when the source changes during composition', () => {
    const { directory, inputPath, outputPath } = fixture()
    const calls = []
    const runCommand = successfulRunner(calls)
    runCommand.mockImplementation((command, args, options = {}) => {
      calls.push({ command, args: [...args], capture: options.capture === true })
      if (args[0] === '-version') return 'ffmpeg version 9.0\n'
      if (command === 'ffprobe-test') return EXPECTED_PROBE
      if (args.includes('-filter_complex')) {
        writeFileSync(args.at(-1), 'candidate-output')
        writeFileSync(inputPath, 'mutated-source')
      }
      return ''
    })

    expect(() =>
      executeFreshCutSalonMaster(
        { inputPath, outputPath },
        { ffmpegPath: 'ffmpeg-test', ffprobePath: 'ffprobe-test', runCommand },
      ),
    ).toThrow(/changed during composition/i)
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(`${outputPath}.receipt.json`)).toBe(false)
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith('.freshcut-salon-master-tmp-')),
    ).toEqual([])
  })

  it('never overwrites a competing output created after encoding', () => {
    const { directory, inputPath, outputPath } = fixture()
    const calls = []
    const runCommand = successfulRunner(calls)
    runCommand.mockImplementation((command, args, options = {}) => {
      calls.push({ command, args: [...args], capture: options.capture === true })
      if (args[0] === '-version') return 'ffmpeg version 9.0\n'
      if (command === 'ffprobe-test') return EXPECTED_PROBE
      if (args.includes('-filter_complex')) {
        writeFileSync(args.at(-1), 'candidate-output')
        writeFileSync(outputPath, 'competing-output')
      }
      return ''
    })

    expect(() =>
      executeFreshCutSalonMaster(
        { inputPath, outputPath },
        { ffmpegPath: 'ffmpeg-test', ffprobePath: 'ffprobe-test', runCommand },
      ),
    ).toThrow(/already exists|copyfile/i)
    expect(readFileSync(outputPath, 'utf8')).toBe('competing-output')
    expect(existsSync(`${outputPath}.receipt.json`)).toBe(false)
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith('.freshcut-salon-master-tmp-')),
    ).toEqual([])
  })

  it('publishes byte-identical output across two isolated executions', () => {
    const directory = scratchDirectory()
    const inputPath = join(directory, 'S0.png')
    const firstOutput = join(directory, 'first.png')
    const secondOutput = join(directory, 'second.png')
    writeFileSync(inputPath, 'stable-source')
    const outputBytes = Buffer.from('stable-canonical-output')

    for (const outputPath of [firstOutput, secondOutput]) {
      executeFreshCutSalonMaster(
        { inputPath, outputPath },
        {
          ffmpegPath: 'ffmpeg-test',
          ffprobePath: 'ffprobe-test',
          runCommand: successfulRunner([], outputBytes),
        },
      )
    }

    expect(sha256(readFileSync(firstOutput))).toBe(sha256(readFileSync(secondOutput)))
    expect(JSON.parse(readFileSync(`${firstOutput}.receipt.json`, 'utf8')).outputSha256).toBe(
      JSON.parse(readFileSync(`${secondOutput}.receipt.json`, 'utf8')).outputSha256,
    )
  })
})

const realFfmpegAvailable =
  spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: false }).status === 0 &&
  spawnSync('ffprobe', ['-version'], { stdio: 'ignore', shell: false }).status === 0

describe.runIf(realFfmpegAvailable)('FreshCut salon master real FFmpeg determinism', () => {
  it('encodes the same RGBA fixture to the same bytes twice', () => {
    const directory = scratchDirectory()
    const inputPath = join(directory, 'fixture.png')
    const fixtureResult = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-y',
        '-fflags',
        '+bitexact',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=s=2752x1536:r=1,format=rgba',
        '-frames:v',
        '1',
        '-an',
        '-map_metadata',
        '-1',
        '-c:v',
        'png',
        '-compression_level',
        '6',
        '-pix_fmt',
        'rgba',
        '-threads',
        '1',
        '-flags:v',
        '+bitexact',
        '-update',
        '1',
        inputPath,
      ],
      { encoding: 'utf8', shell: false },
    )
    expect(fixtureResult.status, fixtureResult.stderr).toBe(0)

    const outputs = [join(directory, 'real-first.png'), join(directory, 'real-second.png')]
    for (const outputPath of outputs) executeFreshCutSalonMaster({ inputPath, outputPath })

    expect(sha256(readFileSync(outputs[0]))).toBe(sha256(readFileSync(outputs[1])))
  }, 30_000)
})
