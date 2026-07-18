import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const UNITS = {
  B: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
}

export function parseWranglerBundleSize(output) {
  const match = output.match(/gzip:\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KiB|MiB)/i)
  if (!match) throw new Error('Wrangler gzip size not found')
  const canonicalUnit = Object.keys(UNITS).find(
    (unit) => unit.toLowerCase() === match[2].toLowerCase(),
  )
  const displayedValue = Number(match[1])
  const gzipBytes = Math.round(displayedValue * UNITS[canonicalUnit])
  if (!Number.isSafeInteger(gzipBytes) || gzipBytes <= 0) {
    throw new Error('Wrangler gzip size is invalid')
  }
  const decimals = match[1].split('.')[1]?.length ?? 0
  const roundingHalfStep = 0.5 * 10 ** -decimals * UNITS[canonicalUnit]
  const maxPossibleGzipBytes = Math.ceil(gzipBytes + roundingHalfStep)
  return { gzipBytes, maxPossibleGzipBytes }
}

export function verifyBundleSize(measurement, maxGzipBytes) {
  const guardedGzipBytes = measurement.maxPossibleGzipBytes ?? measurement.gzipBytes
  const ratio = guardedGzipBytes / maxGzipBytes
  return {
    ok: guardedGzipBytes <= maxGzipBytes,
    gzipBytes: measurement.gzipBytes,
    guardedGzipBytes,
    maxGzipBytes,
    ratio,
  }
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1]
}

function main() {
  const args = process.argv.slice(2)
  const input = valueAfter(args, '--input')
  if (!input) throw new Error('--input is required')
  const max = Number(valueAfter(args, '--max-gzip-bytes') ?? 3 * 1024 * 1024)
  if (!Number.isSafeInteger(max) || max <= 0) throw new Error('invalid gzip budget')

  const result = verifyBundleSize(
    parseWranglerBundleSize(readFileSync(resolve(input), 'utf8')),
    max,
  )
  const kib = (result.gzipBytes / 1024).toFixed(1)
  const percent = (result.ratio * 100).toFixed(1)
  console.log(`Worker bundle: ${kib} KiB gzip (${percent}% of ${max} bytes)`)
  if (result.ratio >= 0.9) {
    console.warn(`::warning::Worker bundle uses ${percent}% of the gzip budget`)
  }
  if (!result.ok) {
    throw new Error(
      `Worker bundle may exceed gzip budget by ${result.guardedGzipBytes - max} bytes after display rounding`,
    )
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(`worker bundle gate failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
