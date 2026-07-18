import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseWranglerBundleSize, verifyBundleSize } from './check-worker-bundle.mjs'

describe('Cloudflare Worker bundle gate', () => {
  it('parses Wrangler gzip output and reports the exact byte budget', () => {
    const result = parseWranglerBundleSize('Total Upload: 18.2 MiB / gzip: 2.91 MiB')
    assert.equal(result.gzipBytes, Math.round(2.91 * 1024 * 1024))
    assert.equal(verifyBundleSize(result, 3 * 1024 * 1024).ok, true)
  })

  it('fails closed when no gzip measurement exists or the worker exceeds 3 MiB', () => {
    assert.throws(() => parseWranglerBundleSize('dry run complete'), /gzip size not found/)
    assert.equal(
      verifyBundleSize({ gzipBytes: 3.01 * 1024 * 1024 }, 3 * 1024 * 1024).ok,
      false,
    )
  })

  it('fails closed at a rounded 3.00 MiB display value', () => {
    const result = parseWranglerBundleSize('Total Upload: 18.2 MiB / gzip: 3.00 MiB')
    assert.equal(result.gzipBytes, 3 * 1024 * 1024)
    assert.ok(result.maxPossibleGzipBytes > result.gzipBytes)
    assert.equal(verifyBundleSize(result, 3 * 1024 * 1024).ok, false)
  })
})
