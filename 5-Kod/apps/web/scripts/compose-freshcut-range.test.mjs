import { createHash } from 'node:crypto'
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
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FRESHCUT_RANGE_RECIPE_VERSION,
  buildFreshCutRangeCompositeCommand,
  executeFreshCutRangeComposite,
  parseFreshCutRangeArgs,
} from './compose-freshcut-range.mjs'

const scratchDirectories = []

function scratchDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'freshcut-range-test-'))
  scratchDirectories.push(directory)
  return directory
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function fixture() {
  const directory = scratchDirectory()
  const inputs = Array.from({ length: 5 }, (_, index) => {
    const path = join(directory, `R${index + 1}.png`)
    writeFileSync(path, `accepted-still-${index + 1}`)
    return path
  })
  return {
    directory,
    inputs,
    outputPath: join(directory, 'range-composite.png'),
  }
}

function successfulRunner(calls, outputBytes = Buffer.from('composited-png')) {
  return vi.fn((command, args, options = {}) => {
    calls.push({ command, args: [...args], capture: options.capture === true })
    if (args[0] === '-version') return 'ffmpeg version 7.1.1-full_build\nconfiguration omitted\n'
    if (args.includes('-filter_complex')) {
      writeFileSync(args.at(-1), outputBytes)
    }
    return ''
  })
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('FreshCut Range composite CLI', () => {
  it('maps exactly R1-R5 and one explicit output without accepting extra arguments', () => {
    const parsed = parseFreshCutRangeArgs([
      '--r1',
      'one.png',
      '--r2',
      'two.png',
      '--r3',
      'three.png',
      '--r4',
      'four.png',
      '--r5',
      'five.png',
      '--output',
      'range.png',
    ])

    expect(parsed).toEqual({
      inputs: ['one.png', 'two.png', 'three.png', 'four.png', 'five.png'],
      outputPath: 'range.png',
    })
    expect(() => parseFreshCutRangeArgs(['--r1', 'one.png', '--output', 'range.png'])).toThrow(
      /exactly r1-r5/i,
    )
    expect(() =>
      parseFreshCutRangeArgs([
        '--r1',
        'one.png',
        '--r2',
        'two.png',
        '--r3',
        'three.png',
        '--r4',
        'four.png',
        '--r5',
        'five.png',
        '--output',
        'range.png',
        '--r6',
        'six.png',
      ]),
    ).toThrow(/unknown argument/i)
  })

  it('builds one fixed 1920x1080 text-free layout with R1 centered and four smaller right tiles', () => {
    const { inputs, outputPath } = fixture()
    const command = buildFreshCutRangeCompositeCommand({ inputs, outputPath })

    expect(command.command).toBe('ffmpeg')
    expect(command.args.filter((argument) => argument === '-i')).toHaveLength(5)
    expect(
      command.args.flatMap((argument, index) =>
        argument === '-i' ? [command.args[index + 1]] : [],
      ),
    ).toEqual(inputs.map((path) => resolve(path).replaceAll('\\', '/')))

    const filter = command.args[command.args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('color=c=0x080808:s=1920x1080')
    expect(filter).toContain('[0:v]scale=768:1080:force_original_aspect_ratio=increase')
    expect(filter).toContain('overlay=576:0')
    expect(filter).toContain('drawbox=x=0:y=0:w=768:h=1080:color=0x080808@1:t=fill')
    for (const position of ['1348:4', '1634:4', '1348:542', '1634:542']) {
      expect(filter).toContain(`overlay=${position}`)
    }
    expect(filter.match(/scale=282:534:force_original_aspect_ratio=increase/g)).toHaveLength(4)
    expect(filter).not.toMatch(/drawtext|subtitles|\bass\b/i)
    expect(command.args).toContain('-frames:v')
    expect(command.args[command.args.indexOf('-frames:v') + 1]).toBe('1')
    expect(command.args.at(-1)).toBe(resolve(outputPath).replaceAll('\\', '/'))
  })

  it('decodes all five images before composition and writes a path-free hashed receipt', () => {
    const { directory, inputs, outputPath } = fixture()
    const calls = []
    const outputBytes = Buffer.from('deterministic-composited-png')
    const runCommand = successfulRunner(calls, outputBytes)

    const result = executeFreshCutRangeComposite(
      { inputs, outputPath },
      { ffmpegPath: 'ffmpeg-test', runCommand },
    )

    expect(result).toEqual({
      outputPath: resolve(outputPath).replaceAll('\\', '/'),
      receiptPath: `${resolve(outputPath).replaceAll('\\', '/')}.receipt.json`,
    })
    const decodeCalls = calls.filter(
      ({ args }) => args.includes('-f') && args[args.indexOf('-f') + 1] === 'null',
    )
    expect(decodeCalls).toHaveLength(6)
    expect(decodeCalls.slice(0, 5).map(({ args }) => args[args.indexOf('-i') + 1])).toEqual(
      inputs.map((path) => resolve(path).replaceAll('\\', '/')),
    )
    const compositeCallIndex = calls.findIndex(({ args }) => args.includes('-filter_complex'))
    const lastInputDecodeCallIndex = calls.findLastIndex(
      ({ args }) =>
        args.includes('-f') &&
        inputs
          .map((path) => resolve(path).replaceAll('\\', '/'))
          .includes(args[args.indexOf('-i') + 1]),
    )
    expect(compositeCallIndex).toBeGreaterThan(lastInputDecodeCallIndex)

    const receipt = JSON.parse(readFileSync(`${outputPath}.receipt.json`, 'utf8'))
    expect(receipt).toEqual({
      schemaVersion: 1,
      recipeVersion: FRESHCUT_RANGE_RECIPE_VERSION,
      orderedInputSha256: inputs.map((path) => sha256(readFileSync(path))),
      outputSha256: sha256(outputBytes),
      ffmpegVersion: 'ffmpeg version 7.1.1-full_build',
    })
    const receiptJson = JSON.stringify(receipt)
    expect(receiptJson).not.toContain(directory)
    expect(receiptJson).not.toContain('R1.png')
    expect(readFileSync(outputPath)).toEqual(outputBytes)
  })

  it('fails closed before FFmpeg for output below public or an existing output/receipt', () => {
    const { inputs, outputPath } = fixture()
    const runCommand = vi.fn()
    const publicOutput = resolve('public', `range-composite-test-${process.pid}-${Date.now()}.png`)

    expect(() =>
      executeFreshCutRangeComposite({ inputs, outputPath: publicOutput }, { runCommand }),
    ).toThrow(/outside public/i)
    expect(existsSync(publicOutput)).toBe(false)

    writeFileSync(outputPath, 'keep-output')
    expect(() => executeFreshCutRangeComposite({ inputs, outputPath }, { runCommand })).toThrow(
      /already exists/i,
    )
    expect(readFileSync(outputPath, 'utf8')).toBe('keep-output')
    rmSync(outputPath)

    writeFileSync(`${outputPath}.receipt.json`, 'keep-receipt')
    expect(() => executeFreshCutRangeComposite({ inputs, outputPath }, { runCommand })).toThrow(
      /already exists/i,
    )
    expect(readFileSync(`${outputPath}.receipt.json`, 'utf8')).toBe('keep-receipt')
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('removes all temporary work when any accepted still is unreadable', () => {
    const { directory, inputs, outputPath } = fixture()
    let decodeCount = 0
    const runCommand = vi.fn((_command, args) => {
      if (args[0] === '-version') return 'ffmpeg version 7.1.1\n'
      if (args.includes('-f') && args[args.indexOf('-f') + 1] === 'null') {
        decodeCount += 1
        if (decodeCount === 3) throw new Error('corrupt image data')
      }
      return ''
    })

    expect(() =>
      executeFreshCutRangeComposite(
        { inputs, outputPath },
        { ffmpegPath: 'ffmpeg-test', runCommand },
      ),
    ).toThrow(/corrupt image data/i)
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(`${outputPath}.receipt.json`)).toBe(false)
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith('.freshcut-range-tmp-')),
    ).toEqual([])
  })

  it('does not overwrite a competing output created after encoding', () => {
    const { directory, inputs, outputPath } = fixture()
    const calls = []
    const runCommand = successfulRunner(calls)
    runCommand.mockImplementation((command, args, options = {}) => {
      calls.push({ command, args: [...args], capture: options.capture === true })
      if (args[0] === '-version') return 'ffmpeg version 7.1.1\n'
      if (args.includes('-filter_complex')) {
        writeFileSync(args.at(-1), 'candidate-output')
        writeFileSync(outputPath, 'competing-output')
      }
      return ''
    })

    expect(() =>
      executeFreshCutRangeComposite(
        { inputs, outputPath },
        { ffmpegPath: 'ffmpeg-test', runCommand },
      ),
    ).toThrow(/already exists|copyfile/i)
    expect(readFileSync(outputPath, 'utf8')).toBe('competing-output')
    expect(existsSync(`${outputPath}.receipt.json`)).toBe(false)
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith('.freshcut-range-tmp-')),
    ).toEqual([])
  })

  it('fails closed when an accepted still changes while FFmpeg is composing', () => {
    const { directory, inputs, outputPath } = fixture()
    const runCommand = vi.fn((_command, args) => {
      if (args[0] === '-version') return 'ffmpeg version 7.1.1\n'
      if (args.includes('-filter_complex')) {
        writeFileSync(args.at(-1), 'candidate-output')
        writeFileSync(inputs[0], 'mutated-after-validation')
      }
      return ''
    })

    expect(() =>
      executeFreshCutRangeComposite(
        { inputs, outputPath },
        { ffmpegPath: 'ffmpeg-test', runCommand },
      ),
    ).toThrow(/changed during composition/i)
    expect(existsSync(outputPath)).toBe(false)
    expect(existsSync(`${outputPath}.receipt.json`)).toBe(false)
    expect(
      readdirSync(directory).filter((entry) => entry.startsWith('.freshcut-range-tmp-')),
    ).toEqual([])
  })

  it('rejects missing, duplicate, non-image, or empty inputs before FFmpeg', () => {
    const { directory, inputs, outputPath } = fixture()
    const runCommand = vi.fn()

    expect(() =>
      executeFreshCutRangeComposite({ inputs: inputs.slice(0, 4), outputPath }, { runCommand }),
    ).toThrow(/exactly five/i)
    expect(() =>
      executeFreshCutRangeComposite(
        { inputs: [inputs[0], inputs[0], ...inputs.slice(2)], outputPath },
        { runCommand },
      ),
    ).toThrow(/distinct/i)

    const textPath = join(directory, 'R5.txt')
    writeFileSync(textPath, 'not an image')
    expect(() =>
      executeFreshCutRangeComposite(
        { inputs: [...inputs.slice(0, 4), textPath], outputPath },
        { runCommand },
      ),
    ).toThrow(/image file/i)

    const emptyPath = join(directory, 'empty.png')
    writeFileSync(emptyPath, '')
    expect(() =>
      executeFreshCutRangeComposite(
        { inputs: [...inputs.slice(0, 4), emptyPath], outputPath },
        { runCommand },
      ),
    ).toThrow(/empty/i)
    expect(runCommand).not.toHaveBeenCalled()
  })
})
