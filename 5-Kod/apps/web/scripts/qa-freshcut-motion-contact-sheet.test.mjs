import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import * as qaHarness from './qa-freshcut-motion-contact-sheet.mjs'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const harnessPath = join(scriptsDirectory, 'qa-freshcut-motion-contact-sheet.mjs')
const repositoryRoot = resolve(scriptsDirectory, '../../../..')
const scratchDirectories = []

function scratchDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'freshcut-motion-qa-'))
  scratchDirectories.push(directory)
  return directory
}

function validInput(overrides = {}) {
  const scratch = scratchDirectory()
  const candidatePath = join(scratch, 'candidate.png')
  writeFileSync(candidatePath, 'not-real-media-but-a-real-private-path')
  return {
    candidatePath,
    sceneId: 'entrance',
    copyPlacement: 'left',
    outputDir: join(scratch, 'output'),
    baseUrl: 'http://motiontest.localhost:3000',
    ...overrides,
  }
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('FreshCut motion contact-sheet QA harness', () => {
  it('fails closed without media or required acceptance inputs', () => {
    const result = spawnSync(process.execPath, [harnessPath], {
      cwd: scriptsDirectory,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Candidate, scene, copy placement and output directory are required',
    )
    expect(result.stderr).not.toMatch(/https?:\/\//i)
  })

  it('rejects candidates that are missing, relative, unsupported or inside the repository', () => {
    const missing = join(scratchDirectory(), 'missing.png')
    const repositoryMedia = join(
      repositoryRoot,
      '5-Kod/apps/web/public/images/freshcut/freshcut-hero.webp',
    )

    for (const candidatePath of [
      missing,
      'candidate.png',
      join(scratchDirectory(), 'candidate.txt'),
      repositoryMedia,
    ]) {
      if (candidatePath.endsWith('.txt')) writeFileSync(candidatePath, 'not media')
      expect(() =>
        qaHarness.resolveQaHarnessInput(
          [],
          {
            FRESHCUT_QA_CANDIDATE: candidatePath,
            FRESHCUT_QA_SCENE: 'entrance',
            FRESHCUT_QA_COPY_PLACEMENT: 'left',
            FRESHCUT_QA_OUTPUT_DIR: join(scratchDirectory(), 'output'),
          },
          { repositoryRoot },
        ),
      ).toThrow(/candidate/i)
    }
  })

  it('rejects repository output, invalid scene/copy pairs and non-local browser origins', () => {
    const cases = [
      validInput({ outputDir: join(repositoryRoot, '6-Testing/freshcut-motiontest/evidence') }),
      validInput({ sceneId: 'unknown' }),
      validInput({ copyPlacement: 'right' }),
      validInput({ baseUrl: 'https://motiontest.corevo.se' }),
    ]

    for (const input of cases) {
      expect(() =>
        qaHarness.resolveQaHarnessInput(
          [
            '--candidate',
            input.candidatePath,
            '--scene',
            input.sceneId,
            '--copy-placement',
            input.copyPlacement,
            '--output',
            input.outputDir,
            '--base-url',
            input.baseUrl,
          ],
          {},
          { repositoryRoot },
        ),
      ).toThrow()
    }
  })

  it('plans a still desktop mask, three exact centre crops and a 1440x900 DOM capture', () => {
    const input = qaHarness.resolveQaHarnessInput(
      [],
      {
        FRESHCUT_QA_CANDIDATE: validInput().candidatePath,
        FRESHCUT_QA_SCENE: 'entrance',
        FRESHCUT_QA_COPY_PLACEMENT: 'left',
        FRESHCUT_QA_OUTPUT_DIR: join(scratchDirectory(), 'output'),
      },
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: 'a'.repeat(64),
    })
    const commands = qaHarness.buildFreshCutQaFfmpegCommands(plan, {
      ffmpegPath: 'ffmpeg-test',
    })

    expect(commands.map(({ kind }) => kind)).toEqual([
      'still-desktop-overlay',
      'still-center-360x800',
      'still-center-390x844',
      'still-center-430x932',
    ])
    expect(commands[0].args.join(' ')).toContain('drawbox=x=0:y=0:w=iw*0.46:h=ih')
    for (const { width, height } of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      const command = commands.find(({ kind }) => kind === `still-center-${width}x${height}`)
      expect(command.args.join(' ')).toContain(
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
      )
    }
    expect(plan.browserCapture).toEqual({
      enabled: true,
      height: 900,
      output: expect.stringMatching(/entrance-dom-1440x900\.png$/),
      responsive: [],
      width: 1440,
    })
  })

  it('plans first, middle and final frame crop matrices for a video without browser capture', () => {
    const candidate = validInput({ sceneId: 'chair', copyPlacement: 'right' })
    const videoPath = candidate.candidatePath.replace(/\.png$/, '.mp4')
    writeFileSync(videoPath, 'not-real-video-but-a-real-private-path')
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        videoPath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
      ],
      {},
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: 'b'.repeat(64),
      durationSeconds: 5,
    })
    const commands = qaHarness.buildFreshCutQaFfmpegCommands(plan, {
      ffmpegPath: 'ffmpeg-test',
    })

    expect(plan.browserCapture.enabled).toBe(false)
    expect(plan.samples.map(({ label, seconds }) => ({ label, seconds }))).toEqual([
      { label: 'first', seconds: 0 },
      { label: 'middle', seconds: 2.5 },
      { label: 'final', seconds: 5 - 1 / 30 },
    ])
    expect(commands).toHaveLength(12)
    expect(commands.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        'first-desktop-overlay',
        'middle-center-390x844',
        'final-center-430x932',
      ]),
    )
  })

  it('builds only documented transition pairs when neighbouring private inputs are provided', () => {
    const candidate = validInput({ sceneId: 'chair', copyPlacement: 'right' })
    const chairPath = candidate.candidatePath.replace(/\.png$/, '.mp4')
    const entrancePath = join(scratchDirectory(), 'entrance.mp4')
    writeFileSync(chairPath, 'private-chair-video')
    writeFileSync(entrancePath, 'private-entrance-video')
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        chairPath,
        '--scene',
        'chair',
        '--copy-placement',
        'right',
        '--output',
        candidate.outputDir,
        '--transition-input',
        `entrance=${entrancePath}`,
      ],
      {},
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: 'c'.repeat(64),
      durationSeconds: 5,
      transitionDurations: { entrance: 4 },
    })
    const commands = qaHarness.buildFreshCutQaFfmpegCommands(plan, {
      ffmpegPath: 'ffmpeg-test',
    })

    expect(plan.transitionPairs.map(({ fromScene, toScene }) => ({ fromScene, toScene }))).toEqual([
      { fromScene: 'entrance', toScene: 'chair' },
    ])
    expect(commands.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        'transition-entrance-to-chair-desktop',
        'transition-entrance-to-chair-mobile-390x844',
      ]),
    )
    const desktop = commands.find(({ kind }) => kind === 'transition-entrance-to-chair-desktop')
    expect(desktop.args.join(' ')).toContain('hstack=inputs=2')
  })

  it('fails closed when supplied transition inputs cannot form a documented pair', () => {
    const candidate = validInput({ sceneId: 'chair', copyPlacement: 'right' })
    const unrelatedPath = join(scratchDirectory(), 'team.png')
    writeFileSync(unrelatedPath, 'private-team-image')
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        'chair',
        '--copy-placement',
        'right',
        '--output',
        candidate.outputDir,
        '--transition-input',
        `team=${unrelatedPath}`,
      ],
      {},
      { repositoryRoot },
    )

    expect(() =>
      qaHarness.buildFreshCutQaArtifactPlan(input, {
        candidateSha256: 'd'.repeat(64),
      }),
    ).toThrow(/documented transition pair/i)
  })

  it('rejects every supplied transition input that is not consumed by a documented pair', () => {
    const candidate = validInput()
    const chairPath = join(scratchDirectory(), 'chair.png')
    const teamPath = join(scratchDirectory(), 'team.png')
    writeFileSync(chairPath, 'private-chair-image')
    writeFileSync(teamPath, 'private-team-image')
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
        '--transition-input',
        `chair=${chairPath}`,
        '--transition-input',
        `team=${teamPath}`,
      ],
      {},
      { repositoryRoot },
    )

    expect(() =>
      qaHarness.buildFreshCutQaArtifactPlan(input, {
        candidateSha256: '2'.repeat(64),
      }),
    ).toThrow(/unused transition input.*team/i)
  })

  it('publishes a private-path-free still QA package without requiring real media in tests', async () => {
    const candidate = validInput()
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
      ],
      {},
      { repositoryRoot },
    )
    const commands = []
    const runCommand = (command, args) => {
      commands.push({ command, args: [...args] })
      if (command === 'ffprobe-test') {
        return JSON.stringify({
          streams: [{ codec_type: 'video', width: 2048, height: 1152 }],
          format: {},
        })
      }
      const output = args.at(-1)
      mkdirSync(dirname(output), { recursive: true })
      writeFileSync(output, `generated:${command}`)
      return ''
    }
    const captureBrowser = async (plan) => {
      mkdirSync(dirname(plan.browserCapture.output), { recursive: true })
      writeFileSync(plan.browserCapture.output, 'real-dom-capture-test-double')
    }

    const result = await qaHarness.executeFreshCutQaHarness(input, {
      captureBrowser,
      ffmpegPath: 'ffmpeg-test',
      ffprobePath: 'ffprobe-test',
      runCommand,
    })

    expect(existsSync(result.artifactDirectory)).toBe(true)
    expect(readdirSync(result.artifactDirectory).sort()).toEqual(
      expect.arrayContaining([
        'contact-sheet.html',
        'entrance-dom-1440x900.png',
        'entrance-still-center-360x800.png',
        'entrance-still-center-390x844.png',
        'entrance-still-center-430x932.png',
        'entrance-still-desktop-overlay.png',
        'qa-manifest.json',
      ]),
    )
    const manifest = readFileSync(join(result.artifactDirectory, 'qa-manifest.json'), 'utf8')
    const contactSheet = readFileSync(join(result.artifactDirectory, 'contact-sheet.html'), 'utf8')
    expect(manifest).not.toContain(input.candidatePath)
    expect(manifest).not.toMatch(/https?:\/\//i)
    expect(contactSheet).not.toContain(input.candidatePath)
    expect(contactSheet).toContain('FreshCut motion contact sheet')
    expect(commands.some(({ command }) => command === 'ffprobe-test')).toBe(true)
    expect(commands.filter(({ command }) => command === 'ffmpeg-test')).toHaveLength(4)
  })

  it('intercepts only same-origin FreshCut motion poster requests', () => {
    const baseUrl = 'http://motiontest.localhost:3000'

    expect(
      qaHarness.isFreshCutMotionMediaRequest(
        'http://motiontest.localhost:3000/images/freshcut/freshcut-hero.webp',
        baseUrl,
      ),
    ).toBe(true)
    expect(
      qaHarness.isFreshCutMotionMediaRequest(
        'http://motiontest.localhost:3000/media/freshcut-motion/hero-v1-a/hero.webp',
        baseUrl,
      ),
    ).toBe(true)
    expect(
      qaHarness.isFreshCutMotionMediaRequest(
        'https://signed.example.test/images/freshcut/freshcut-hero.webp?token=secret',
        baseUrl,
      ),
    ).toBe(false)
    expect(
      qaHarness.isFreshCutMotionMediaRequest(
        'http://motiontest.localhost:3000/images/corevo-logo.svg',
        baseUrl,
      ),
    ).toBe(false)
  })

  it('accepts only a current poster source that was served by the candidate intercept', () => {
    const baseUrl = 'http://motiontest.localhost:3000'
    const currentSrc = `${baseUrl}/images/freshcut/freshcut-entrance.webp`

    expect(qaHarness.isInterceptedFreshCutPoster(currentSrc, baseUrl, new Set([currentSrc]))).toBe(
      true,
    )
    expect(qaHarness.isInterceptedFreshCutPoster(currentSrc, baseUrl, new Set())).toBe(false)
    expect(
      qaHarness.isInterceptedFreshCutPoster(
        'https://signed.example.test/freshcut-entrance.webp?token=secret',
        baseUrl,
        new Set([currentSrc]),
      ),
    ).toBe(false)
  })

  it('rejects an output directory symlink that resolves back into the repository', () => {
    const candidate = validInput()
    const linkedOutput = join(scratchDirectory(), 'linked-output')
    symlinkSync(
      join(repositoryRoot, '6-Testing/freshcut-motiontest'),
      linkedOutput,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    expect(() =>
      qaHarness.resolveQaHarnessInput(
        [
          '--candidate',
          candidate.candidatePath,
          '--scene',
          candidate.sceneId,
          '--copy-placement',
          candidate.copyPlacement,
          '--output',
          linkedOutput,
        ],
        {},
        { repositoryRoot },
      ),
    ).toThrow(/outside the repository/i)
  })

  it('removes temporary artifacts when a media command fails', async () => {
    const candidate = validInput()
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
      ],
      {},
      { repositoryRoot },
    )
    const runCommand = (command) => {
      if (command === 'ffprobe-test') {
        return JSON.stringify({
          streams: [{ codec_type: 'video', width: 2048, height: 1152 }],
          format: {},
        })
      }
      throw new Error('synthetic ffmpeg failure')
    }

    await expect(
      qaHarness.executeFreshCutQaHarness(input, {
        ffmpegPath: 'ffmpeg-test',
        ffprobePath: 'ffprobe-test',
        runCommand,
      }),
    ).rejects.toThrow('synthetic ffmpeg failure')
    expect(existsSync(input.outputDir) ? readdirSync(input.outputDir) : []).toEqual([])
  })

  it('accepts a safe desktop/mobile object-position pair and plans responsive DOM captures', () => {
    const candidate = validInput()
    const input = qaHarness.resolveQaHarnessInput(
      [],
      {
        FRESHCUT_QA_CANDIDATE: candidate.candidatePath,
        FRESHCUT_QA_SCENE: candidate.sceneId,
        FRESHCUT_QA_COPY_PLACEMENT: candidate.copyPlacement,
        FRESHCUT_QA_OUTPUT_DIR: candidate.outputDir,
        FRESHCUT_QA_DESKTOP_OBJECT_POSITION: '40% center',
        FRESHCUT_QA_MOBILE_OBJECT_POSITION: 'center',
      },
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: 'e'.repeat(64),
    })

    expect(plan.objectPosition).toEqual({ desktop: '40% center', mobile: 'center' })
    expect(plan.browserCapture.responsive.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ])
  })

  it('orchestrates responsive captures through the enhanced motion owner', async () => {
    const candidate = validInput()
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
        '--desktop-object-position',
        '40% center',
        '--mobile-object-position',
        'center',
      ],
      {},
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: 'f'.repeat(64),
    })
    const viewports = []
    const screenshots = []
    const sceneStyles = []
    const videoStates = []
    const posterRequestUrl = `${plan.baseUrl}/images/freshcut/freshcut-entrance.webp`
    let activeRouteHandler
    let enhancedWaitObserved = false
    let decodeWaits = 0
    let posterSourceChecks = 0
    const playwrightLoader = async () => ({
      chromium: {
        launch: async () => ({
          close: async () => {},
          newContext: async ({ viewport }) => {
            viewports.push(viewport)
            return {
              close: async () => {},
              newPage: async () => ({
                addStyleTag: async () => {},
                evaluate: async () => {},
                goto: async () => {
                  await activeRouteHandler({
                    continue: async () => {},
                    fulfill: async () => {},
                    request: () => ({
                      resourceType: () => 'image',
                      url: () => posterRequestUrl,
                    }),
                  })
                  return { status: () => 200 }
                },
                locator: (selector) => {
                  if (selector === '[data-storefront-experience="freshcut-motiontest"]') {
                    return {
                      waitFor: async () => {},
                    }
                  }
                  if (selector.includes('[data-motion-mode]')) {
                    return { waitFor: async () => {} }
                  }
                  if (selector.startsWith('nav[')) {
                    return {
                      click: async () => {
                        if (!enhancedWaitObserved) {
                          throw new Error('Checkpoint clicked before enhanced mode')
                        }
                      },
                      count: async () => 1,
                    }
                  }
                  if (selector === '[data-motion-stage] video') {
                    return {
                      evaluateAll: async (hideVideos) => {
                        const attributes = new Set(['autoplay'])
                        const properties = new Map()
                        const video = {
                          paused: false,
                          pause() {
                            this.paused = true
                          },
                          removeAttribute: (name) => attributes.delete(name),
                          style: {
                            setProperty: (name, value, priority) =>
                              properties.set(name, { priority, value }),
                          },
                        }
                        hideVideos([video])
                        videoStates.push({
                          autoplay: attributes.has('autoplay'),
                          display: properties.get('display'),
                          paused: video.paused,
                        })
                      },
                    }
                  }
                  if (selector.includes('[data-motion-stage]')) {
                    return {
                      evaluate: async (applyPositions, positions) => {
                        const style = new Map()
                        applyPositions(
                          { style: { setProperty: (name, value) => style.set(name, value) } },
                          positions,
                        )
                        sceneStyles.push(Object.fromEntries(style))
                      },
                      getAttribute: async () => candidate.copyPlacement,
                      locator: () => ({
                        evaluate: async (predicate) => {
                          if (String(predicate).includes('.decode')) decodeWaits += 1
                          if (String(predicate).includes('.currentSrc')) {
                            posterSourceChecks += 1
                            return posterRequestUrl
                          }
                          return true
                        },
                        waitFor: async () => {},
                      }),
                      waitFor: async () => {},
                    }
                  }
                  throw new Error(`Unexpected locator: ${selector}`)
                },
                route: async (_pattern, handler) => {
                  activeRouteHandler = handler
                },
                screenshot: async ({ path }) => screenshots.push(path),
                waitForFunction: async (predicate) => {
                  if (String(predicate).includes('data-motion-mode')) enhancedWaitObserved = true
                },
              }),
            }
          },
        }),
      },
    })

    await qaHarness.captureFreshCutMotionDom(plan, { playwrightLoader })

    expect(viewports).toEqual([
      { width: 1440, height: 900 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ])
    expect(screenshots.map((path) => path.split(/[\\/]/).at(-1))).toEqual([
      'entrance-dom-1440x900.png',
      'entrance-dom-360x800.png',
      'entrance-dom-390x844.png',
      'entrance-dom-430x932.png',
    ])
    expect(sceneStyles).toEqual(
      Array.from({ length: 4 }, () => ({
        '--motion-scene-crop': '40% center',
        '--motion-scene-mobile-crop': 'center',
      })),
    )
    expect(enhancedWaitObserved).toBe(true)
    expect(decodeWaits).toBe(4)
    expect(posterSourceChecks).toBe(4)
    expect(videoStates).toEqual(
      Array.from({ length: 4 }, () => ({
        autoplay: false,
        display: { priority: 'important', value: 'none' },
        paused: true,
      })),
    )
  })

  it('does not launch Chromium when the candidate becomes unreadable', async () => {
    const candidate = validInput()
    const input = qaHarness.resolveQaHarnessInput(
      [
        '--candidate',
        candidate.candidatePath,
        '--scene',
        candidate.sceneId,
        '--copy-placement',
        candidate.copyPlacement,
        '--output',
        candidate.outputDir,
      ],
      {},
      { repositoryRoot },
    )
    const plan = qaHarness.buildFreshCutQaArtifactPlan(input, {
      candidateSha256: '1'.repeat(64),
    })
    rmSync(candidate.candidatePath)
    let launched = false

    const error = await qaHarness
      .captureFreshCutMotionDom(plan, {
        playwrightLoader: async () => ({
          chromium: {
            launch: async () => {
              launched = true
              return { close: async () => {} }
            },
          },
        }),
      })
      .then(
        () => null,
        (captureError) => captureError,
      )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/candidate media could not be read/i)
    expect(error.message).not.toContain(candidate.candidatePath)
    expect(launched).toBe(false)
  })

  it('does not expose a private media path when hashing loses read access', async () => {
    const privatePath = join(scratchDirectory(), 'removed-transition.png')

    const error = await qaHarness.hashQaMediaFile(privatePath).then(
      () => null,
      (hashError) => hashError,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/media file could not be read/i)
    expect(error.message).not.toContain(privatePath)
  })

  it('rejects incomplete or unsafe object-position overrides', () => {
    const candidate = validInput()
    const baseEnvironment = {
      FRESHCUT_QA_CANDIDATE: candidate.candidatePath,
      FRESHCUT_QA_SCENE: candidate.sceneId,
      FRESHCUT_QA_COPY_PLACEMENT: candidate.copyPlacement,
      FRESHCUT_QA_OUTPUT_DIR: candidate.outputDir,
    }

    for (const override of [
      { FRESHCUT_QA_DESKTOP_OBJECT_POSITION: '40% center' },
      {
        FRESHCUT_QA_DESKTOP_OBJECT_POSITION: '40%; background:url(secret)',
        FRESHCUT_QA_MOBILE_OBJECT_POSITION: 'center',
      },
    ]) {
      expect(() =>
        qaHarness.resolveQaHarnessInput(
          [],
          { ...baseEnvironment, ...override },
          { repositoryRoot },
        ),
      ).toThrow(/object-position/i)
    }
  })
})
