import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repo = path.resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(path.join(repo, relativePath), 'utf8')

const entrySource = read('apps/web/app/(admin)/admin/sida/page.tsx')
const legacyEntrySource = read('apps/web/app/(admin)/admin/sida/redigera/page.tsx')
const studioSource = read('apps/web/components/platform/SidaStudioV2.tsx')
const studioCss = read('apps/web/components/platform/SidaStudioV2.module.css')
const bridgeSource = read('apps/web/components/platform/SidaPreviewBridge.tsx')
const bookingSource = read('apps/web/components/storefront/BookingProvider.tsx')
const revisionActionSource = read('apps/web/lib/platform/actions/site-revisions.ts')
const shellCss = read('apps/web/components/portal/Topnav.module.css')

test.describe('03 Redigera sidan v2 — source contract @readonly @contract', () => {
  test('03-C01 direct entry redirects into the editor', () => {
    expect(entrySource).toContain('SidaStudio')
    expect(entrySource).not.toContain('Öppna redigeraren')
    expect(legacyEntrySource).toMatch(/redirect\(['"]\/admin\/sida['"]\)/)
  })

  test('03-C02 stable acceptance hooks cover the complete editor shell', () => {
    for (const hook of [
      'editor-shell',
      'editor-toolbar',
      'editor-tabs',
      'editor-status',
      'editor-panel',
      'editor-preview',
      'draft-banner',
      'leave-dialog',
    ]) {
      expect(studioSource, `missing data-accept=${hook}`).toContain(`data-accept="${hook}"`)
    }
  })

  test('03-C03 geometry and shared theme tokens are locked in CSS', () => {
    expect(studioCss).toMatch(/grid-template-columns:\s*470px\s+minmax\(0,\s*1fr\)/)
    expect(studioCss).toMatch(/--editor-bg:\s*var\(--c-cream\)/i)
    expect(studioCss).toMatch(/--editor-panel:\s*var\(--c-paper\)/i)
    expect(studioCss).toMatch(/--editor-card:\s*var\(--c-paper-2\)/i)
    expect(studioCss).toMatch(/--editor-line:\s*var\(--c-line\)/i)
    expect(studioCss).toMatch(/--editor-text:\s*var\(--c-ink\)/i)
    expect(studioCss).toMatch(/\.mobileDevice[^}]*width:\s*390px/is)
    expect(studioCss).toMatch(/\.toolbar[^}]*padding:\s*12px 24px/is)
    expect(studioCss).toMatch(/\.panel[^}]*padding:\s*16px 18px 40px/is)
    expect(studioCss).toMatch(/\.card[^}]*border-radius:\s*14px/is)
    expect(studioCss).toMatch(/\.card[^}]*padding:\s*16px 18px/is)
    expect(studioCss).toMatch(/\.swatches button[^}]*width:\s*24px/is)
    expect(studioCss).toMatch(/\.previewUrl[^}]*display:\s*none/is)
    expect(shellCss).toContain(':global(.sida-studio-host)')
  })

  test('03-C04 draft actions are real aggregate editor operations', () => {
    expect(studioSource).toContain('saveSiteDraft')
    expect(studioSource).toContain('publishSiteDraft')
    expect(studioSource).toContain('discardSiteDraft')
    expect(studioSource).toContain('restoreSiteRevision')
  })

  test('03-C05 images, facts and every realtime channel are complete', () => {
    expect(studioSource).toContain('uploadSiteDraftImage')
    expect(studioSource).toContain('cropFocusedImage')
    expect(studioSource).toContain('type="file"')
    expect(studioSource).toContain('Byt bild')
    expect(studioSource).toContain('function StatsFields')
    expect(studioSource).toContain('Typsnitten är valda för att passa ihop')
    expect(studioSource).not.toContain('const BODY_FONTS')
    expect(entrySource).toContain("path: '?boka=1'")
    expect(entrySource).toContain("title: 'Google-recensionslänk'")
    expect(entrySource).toContain('Ingen betygs- eller recensionsdata hämtas automatiskt.')
    expect(entrySource).toContain('scheduleHours={deriveSiteScheduleHours(detail)}')
    expect(bridgeSource).toContain("data.type === 'site-field-flash'")
    expect(bridgeSource).toContain("data.type === 'img-flash'")
    expect(bridgeSource).toContain("new CustomEvent('corevo-booking-preview'")
    expect(bookingSource).toContain("addEventListener('corevo-booking-preview'")
    expect(revisionActionSource).toContain('storefront-drafts')
  })
})

const baseUrl = process.env.ACCEPT_BASE_URL
const email = process.env.ACCEPT_ADMIN_EMAIL
const password = process.env.ACCEPT_ADMIN_PASSWORD
const theme = process.env.ACCEPT_THEME
const canRunBrowser = Boolean(baseUrl && email && password && theme)

test.describe('03 Redigera sidan v2 — browser oracle @readonly @browser', () => {
  test.skip(!canRunBrowser, 'ACCEPT_BASE_URL, ACCEPT_ADMIN_EMAIL, ACCEPT_ADMIN_PASSWORD och ACCEPT_THEME krävs')

  test('03-B01 exact desktop and mobile editor behavior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel('E-post').fill(email!)
    await page.getByLabel('Lösenord').fill(password!)
    await page.getByRole('button', { name: 'Logga in' }).click()
    await expect(page).not.toHaveURL(/\/login/)

    await page.getByRole('link', { name: 'Redigera sidan' }).click()
    await expect(page).toHaveURL(/\/admin\/sida\/?$/)
    await expect(page.getByText('Öppna redigeraren')).toHaveCount(0)

    const shell = page.locator('[data-accept="editor-shell"]')
    const toolbar = page.locator('[data-accept="editor-toolbar"]')
    const panel = page.locator('[data-accept="editor-panel"]')
    const preview = page.locator('[data-accept="editor-preview"]')
    await expect(shell).toBeVisible()
    await expect(toolbar).toBeVisible()

    const panelBox = await panel.boundingBox()
    const previewBox = await preview.boundingBox()
    expect(panelBox?.width).toBeCloseTo(470, 0)
    expect(previewBox?.x).toBeCloseTo((panelBox?.x ?? 0) + (panelBox?.width ?? 0), 0)

    const tokens = await shell.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        color: style.color,
        font: style.fontFamily,
      }
    })
    expect(tokens.background).toBe('rgb(18, 18, 16)')
    expect(tokens.color).toBe('rgb(240, 240, 234)')
    expect(tokens.font).toContain('Instrument Sans')

    const expectedTabs =
      theme === 'kalla'
        ? ['Allmänt', 'Hem', 'Behandlingar', 'Terapeuter', 'Om oss', 'Kontakt', 'Bokning', 'Apoteket', 'Anteckningar']
        : ['Allmänt', 'Postern', 'Tjänster', 'Teamet', 'Galleriet', 'Kontakt', 'Bokning']
    await expect(page.locator('[data-accept="editor-tabs"] button')).toHaveText(expectedTabs)
    await expect(page.locator('[data-accept="template-picker"]')).toHaveCount(0)
    await expect(page.getByText(/mall/i)).toHaveCount(0)
    const fontCard = panel.locator('section').filter({ has: page.getByRole('heading', { name: 'Typsnitt' }) })
    await expect(fontCard).toContainText('Typsnitten är valda för att passa ihop')
    await expect(fontCard.locator('select')).toHaveCount(0)

    await page.getByRole('button', { name: theme === 'kalla' ? 'Hem' : 'Postern', exact: true }).click()
    await expect(panel.locator('input[type="file"]')).toHaveCount(1)
    await expect(panel.getByRole('button', { name: 'Byt bild' }).first()).toBeVisible()
    if (theme === 'snitt') await expect(panel.getByRole('heading', { name: 'Google-recensionslänk' })).toBeVisible()

    const businessPosts: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && !request.url().includes('/_next/')) businessPosts.push(request.url())
    })
    const hero = page.locator('[data-corevo-editor-field="heroTitle"]')
    await hero.fill(`Acceptans ${Date.now()}`)
    await expect(page.locator('[data-accept="editor-status"]')).toContainText('Osparat')
    expect(businessPosts).toHaveLength(0)

    const frame = page.locator('[data-accept="editor-preview"] iframe').contentFrame()
    await expect(frame.locator('[data-corevo-editor-field="heroTitle"]')).toContainText('Acceptans')
    await page.locator('[data-accept="show-field-heroTitle"]').click()
    await expect(frame.locator('[data-corevo-editor-field="heroTitle"]')).toHaveCSS(
      'outline',
      'rgb(214, 172, 106) solid 2px',
    )

    await page.getByRole('button', { name: 'Mobil' }).click()
    const deviceBox = await page.locator('[data-accept="preview-device"]').boundingBox()
    expect(deviceBox?.width).toBeCloseTo(390, 0)

    await page.getByRole('button', { name: 'Kontakt', exact: true }).click()
    await expect(toolbar).toContainText('/kontakt')
    await expect(page.locator('[data-accept="editor-preview"] iframe')).toHaveAttribute('src', /\/kontakt/)
    for (const field of ['contact.email', 'contact.phone', 'location.address', 'social.instagram', 'social.facebook', 'social.tiktok']) {
      await expect(page.locator(`[data-accept="show-field-${field}"]`)).toBeVisible()
    }

    await page.getByRole('button', { name: 'Bokning', exact: true }).click()
    await expect(toolbar).toContainText('/?boka=1')
    await expect(page.locator('[data-accept="editor-preview"] iframe')).toHaveAttribute('src', /\?boka=1/)
    for (const field of ['booking.variant', 'booking.pickerMode', 'booking.staffAvatars']) {
      await expect(page.locator(`[data-accept="show-field-${field}"]`)).toBeVisible()
    }

    await page.getByRole('link', { name: 'Inställningar' }).click()
    const leaveDialog = page.locator('[data-accept="leave-dialog"]')
    await expect(leaveDialog).toBeVisible()
    await expect(leaveDialog.getByRole('button')).toHaveText(['Spara utkast och lämna', 'Kasta ändringarna', 'Stanna kvar'])
    await leaveDialog.getByRole('button', { name: 'Stanna kvar' }).click()
    await expect(page).toHaveURL(/\/admin\/sida\/?$/)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Panel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Förhandsvisning' })).toBeVisible()
    const publish = page.getByRole('button', { name: 'Publicera', exact: true })
    const publishBox = await publish.boundingBox()
    expect(publishBox?.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

const allowMutation = process.env.ACCEPT_ALLOW_MUTATION === 'staging'
const safeMutationTarget = Boolean(baseUrl && !/corevo\.se/i.test(baseUrl))

test.describe('03 Redigera sidan v2 — persisted draft @mutating', () => {
  test.skip(!canRunBrowser || !allowMutation || !safeMutationTarget, 'Kräver uttrycklig disposable staging')

  test('03-M01 save, reload, publish and discard preserve the live boundary', async ({ page }) => {
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel('E-post').fill(email!)
    await page.getByLabel('Lösenord').fill(password!)
    await page.getByRole('button', { name: 'Logga in' }).click()
    await page.getByRole('link', { name: 'Redigera sidan' }).click()

    const hero = page.locator('[data-corevo-editor-field="heroTitle"]')
    const baseline = await hero.inputValue()
    const draft = `Draft ${Date.now()}`
    try {
      await hero.fill(draft)
      await page.getByRole('button', { name: 'Spara utkast' }).click()
      await expect(page.locator('[data-accept="draft-banner"]')).toBeVisible()
      await page.reload()
      await expect(hero).toHaveValue(draft)
      await page.getByRole('button', { name: 'Publicera', exact: true }).click()
      await expect(page.locator('[data-accept="editor-status"]')).toContainText('Live')

      await hero.fill(`${draft} kasta`)
      await page.getByRole('button', { name: 'Spara utkast' }).click()
      await page.getByRole('button', { name: 'Kasta utkast' }).click()
      await expect(hero).toHaveValue(draft)
    } finally {
      await hero.fill(baseline)
      await page.getByRole('button', { name: 'Spara utkast' }).click()
      await page.getByRole('button', { name: 'Publicera', exact: true }).click()
    }
  })
})
