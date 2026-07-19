# Corevo Platform PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gör den autentiserade portalen på `superbooking.corevo.se` installerbar som den separata appen **Corevo Platform**.

**Architecture:** Följ samma befintliga mönster som admin- och personal-PWA:n: en statisk manifest-route som endast länkas från portalens egen Next-layout. Återanvänd befintliga Corevo-adminikoner och lägg inte till service worker, global manifest-routing eller databasändring.

**Tech Stack:** Next.js App Router metadata, TypeScript, Vitest.

## Global Constraints

- `booking`, `superbooking` och `minbooking` behåller separata appidentiteter.
- Platformmanifest: `name=Corevo Platform`, `id=/platform`, `start_url=/platform`, `scope=/`, `display=standalone`.
- Manifestet länkas endast från `app/(platform)/layout.tsx`.
- Befintliga `/pwa/admin-icon-{180,192,512}.png` återanvänds.
- Ingen ny dependency, service worker, installationspopup eller migration.

---

### Task 1: Platformmanifest och layoutmetadata

**Files:**
- Create: `5-Kod/apps/web/app/api/pwa/platform-manifest/route.ts`
- Modify: `5-Kod/apps/web/app/(platform)/layout.tsx`
- Test: `5-Kod/apps/web/lib/platform/platform-pwa.test.ts`

**Interfaces:**
- Produces: `GET(): Response` med platformmanifestet.
- Consumes: Next.js `Metadata` och `Viewport` i plattformslayouten.

- [ ] **Step 1: Skriv det röda kontraktstestet**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/pwa/platform-manifest/route'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(path.join(WEB_ROOT, 'public', file.replace(/^\//, '')))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('platform-PWA', () => {
  it('har en egen stabil appidentitet och startar i plattformen', async () => {
    const response = GET()
    const manifest = await response.json()
    expect(response.headers.get('content-type')).toContain('application/manifest+json')
    expect(manifest).toMatchObject({
      name: 'Corevo Platform',
      id: '/platform',
      start_url: '/platform',
      scope: '/',
      display: 'standalone',
    })
  })

  it('annonserar verkliga PNG-ikoner med rätt mått', async () => {
    const manifest = (await GET().json()) as {
      icons: { src: string; sizes: string; type: string }[]
    }
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((candidate) => candidate.sizes === `${size}x${size}`)
      expect(icon?.type).toBe('image/png')
      expect(icon && pngSize(icon.src)).toEqual({ width: size, height: size })
    }
  })

  it('länkas endast från plattformslayouten med iOS- och viewportmetadata', () => {
    const layout = fs.readFileSync(path.join(WEB_ROOT, 'app', '(platform)', 'layout.tsx'), 'utf8')
    expect(layout).toContain("manifest: '/api/pwa/platform-manifest'")
    expect(layout).toContain("title: 'Corevo Platform'")
    expect(layout).toContain("icons: { apple: '/pwa/admin-icon-180.png' }")
    expect(layout).toContain("themeColor: '#121210'")
    expect(layout).toContain("viewportFit: 'cover'")
    expect(layout).not.toContain('userScalable: false')
    expect(layout).not.toContain('maximumScale: 1')
  })
})
```

- [ ] **Step 2: Kör testet och bevisa RED**

Run from `5-Kod/`:

```text
pnpm --filter @corevo/web exec vitest run lib/platform/platform-pwa.test.ts
```

Expected: FAIL eftersom `app/api/pwa/platform-manifest/route.ts` saknas.

- [ ] **Step 3: Implementera minsta manifest-route**

```ts
export const dynamic = 'force-static'

export function GET(): Response {
  return Response.json(
    {
      name: 'Corevo Platform',
      short_name: 'Corevo',
      description: 'Kunder, partners och drift — direkt på hemskärmen.',
      id: '/platform',
      start_url: '/platform',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#121210',
      theme_color: '#121210',
      icons: [
        { src: '/pwa/admin-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  )
}
```

- [ ] **Step 4: Lägg portalens metadata på befintlig layout**

Importera `Metadata, Viewport` från `next` och exportera:

```ts
export const metadata: Metadata = {
  manifest: '/api/pwa/platform-manifest',
  appleWebApp: { capable: true, title: 'Corevo Platform', statusBarStyle: 'black-translucent' },
  icons: { apple: '/pwa/admin-icon-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#121210',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

- [ ] **Step 5: Kör GREEN och närliggande PWA-test**

```text
pnpm --filter @corevo/web exec vitest run lib/platform/platform-pwa.test.ts lib/admin/admin-pwa.test.ts
```

Expected: PASS.

- [ ] **Step 6: Kör verifieringskedjan**

```text
pnpm --filter @corevo/web typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: exit 0 för samtliga.

- [ ] **Step 7: Commit**

```text
git add 5-Kod/apps/web/app/api/pwa/platform-manifest/route.ts 5-Kod/apps/web/app/(platform)/layout.tsx 5-Kod/apps/web/lib/platform/platform-pwa.test.ts
git commit -m "fix(pwa): make platform portal installable"
```
