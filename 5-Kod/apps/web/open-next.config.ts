import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Cloudflare Workers adapter for Next.js (App Router) via OpenNext.
// R2 incremental cache / queue can be wired here later (G11); default config
// is sufficient for build + preview.
export default defineCloudflareConfig()
