import { chromium } from 'playwright'

const LINES = [
  { variantId: 'v1', productId: 'p1', productName: 'Vårbukett Lilja', variantName: 'Mellan', priceCents: 49900, currency: 'SEK', quantity: 2, imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400', maxQty: 5 },
  { variantId: 'v2', productId: 'p2', productName: 'Krukväxt Monstera', variantName: 'Standard', priceCents: 29900, currency: 'SEK', quantity: 1, imageUrl: null, maxQty: 3 },
]

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const p = await ctx.newPage()
await p.route('**/*', (r) => {
  const u = new URL(r.request().url())
  if (u.hostname === 'florist.localhost') return r.continue()
  return r.continue()
})
await p.goto('http://florist.localhost:3111/varukorg')
await p.evaluate((l) => localStorage.setItem('corevo-shop-cart', JSON.stringify(l)), LINES)
await p.reload()
await p.waitForTimeout(1200)

const out = await p.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)]
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const small = q('a,button,input,select').filter(e => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)
  }).map(e => ({ tag: e.tagName, txt: (e.innerText || '').slice(0, 24).replace(/\n/g, ' '), ...box(e) }))
  const rows = q('[class*="row"]').map(box)
  const panel = q('[class*="panel"]').map(box)
  const thumbs = q('[class*="thumb"]').map(e => ({ ...box(e), tag: e.tagName }))
  return { rows: rows.slice(0, 4), panel, thumbs, smallCount: small.length, small: small.slice(0, 14) }
})
console.log(JSON.stringify(out, null, 1))
await p.screenshot({ path: 'C:/Users/Zivar-PC/AppData/Local/Temp/claude/C--Users-Zivar-PC-Desktop-firs-r-sas/138da733-3a54-45c4-a2dc-1b3bf09e1690/scratchpad/cart.png', fullPage: true })
await b.close()
