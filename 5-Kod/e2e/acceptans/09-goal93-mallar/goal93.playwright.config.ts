import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const root = path.resolve(__dirname)
const captureDesignSource = process.env.GOAL93_CAPTURE_DESIGN_SOURCE === '1'

export default defineConfig({
  testDir: root,
  testMatch: '**/*.accept.spec.ts',
  fullyParallel: false,
  workers: 4,
  forbidOnly: true,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixels: 0,
    },
  },
  updateSnapshots: captureDesignSource ? 'missing' : 'none',
  snapshotPathTemplate: path.join(root, 'baselines', '{arg}{ext}'),
  outputDir: path.join(root, 'artifacts', 'test-results'),
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
