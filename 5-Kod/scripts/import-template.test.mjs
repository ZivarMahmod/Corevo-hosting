// Unit tests for the import-template codemod's pure transforms (goal-36 R1).
// Run: node --test 5-Kod/scripts/import-template.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripChrome, extractBody, rewriteAssets, extractCssHrefs, extractCanonTokens, detectRegions,
} from './import-template.mjs'

test('stripChrome removes <script> but keeps inert carousel markup', () => {
  const out = stripChrome('<div data-bs-ride="carousel" data-bs-target="#x"><script>alert(1)</script><a class="wow fadeInUp btn">x</a></div>')
  assert.ok(!out.includes('<script'), 'script removed')
  assert.ok(out.includes('data-bs-ride="carousel"'), 'data-bs-ride kept')
  assert.ok(!out.includes('data-bs-target'), 'data-bs-target stripped')
  assert.ok(out.includes('class="btn"'), 'anim classes stripped, btn kept')
  assert.ok(!out.includes('wow') && !out.includes('fadeInUp'), 'wow/fadeInUp gone')
})

test('stripChrome removes spinner + back-to-top + navbar-toggler', () => {
  const out = stripChrome('<div id="spinner" class="show"><div class="sk"></div></div><a class="btn back-to-top"><i></i></a><button type="button" class="navbar-toggler"><span></span></button><main>keep</main>')
  assert.ok(!out.includes('id="spinner"'), 'spinner gone')
  assert.ok(!out.includes('back-to-top'), 'back-to-top gone')
  assert.ok(!out.includes('navbar-toggler'), 'toggler gone')
  assert.ok(out.includes('<main>keep</main>'), 'real content kept')
})

test('extractBody pulls inner body', () => {
  assert.equal(extractBody('<html><head><title>x</title></head><body><h1>Hi</h1></body></html>'), '<h1>Hi</h1>')
  assert.equal(extractBody('<h1>nofull</h1>'), '<h1>nofull</h1>')
})

test('rewriteAssets rewrites relative img/css, keeps http + #', () => {
  assert.equal(rewriteAssets('<img src="img/a.jpg">', 'carserv'), '<img src="/sajtbyggare/carserv/img/a.jpg">')
  assert.equal(rewriteAssets('<a href="https://x.com/y">', 'carserv'), '<a href="https://x.com/y">')
  assert.equal(rewriteAssets('<a href="#about">', 'carserv'), '<a href="#about">')
  assert.equal(rewriteAssets('<a href="">x</a>', 'carserv'), '<a href="#">x</a>')
  assert.ok(rewriteAssets('<div style="background:url(img/bg.jpg)">', 'carserv').includes('/sajtbyggare/carserv/img/bg.jpg'))
})

test('extractCssHrefs collects stylesheets, drops animate.css, rewrites relative', () => {
  const head = '<head><link rel="stylesheet" href="css/bootstrap.min.css"><link rel="stylesheet" href="lib/animate/animate.min.css"><link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="https://cdn/x.css"></head>'
  const hrefs = extractCssHrefs(head, 'carserv')
  assert.ok(hrefs.includes('/sajtbyggare/carserv/css/bootstrap.min.css'))
  assert.ok(hrefs.includes('/sajtbyggare/carserv/css/style.css'))
  assert.ok(hrefs.includes('https://cdn/x.css'), 'CDN kept verbatim')
  assert.ok(!hrefs.some((h) => h.includes('animate')), 'animate.css dropped')
})

test('extractCanonTokens lifts --primary + body bg/color/font', () => {
  const css = ':root{--primary:#D81324;--secondary:#112233}\nbody{background-color:#fff;color:#596277;font-family:"Ubuntu",sans-serif;}'
  const t = extractCanonTokens(css)
  assert.equal(t.colorPrimary, '#D81324')
  assert.equal(t.colorBg, '#fff')
  assert.equal(t.colorFg, '#596277')
  assert.equal(t.colorAccent, '#112233')
  assert.match(t.fontBody, /Ubuntu/)
})

test('detectRegions always emits color/font/logo with token defaults', () => {
  const t = { colorPrimary: '#D81324', colorBg: '#fff', colorFg: '#596277', colorAccent: '#D81324', fontBody: '"Ubuntu", sans-serif' }
  const regions = detectRegions('<h1>Hello World</h1><img src="/sajtbyggare/x/img/about.jpg">', t, 'x')
  const byKey = Object.fromEntries(regions.map((r) => [r.key, r]))
  assert.equal(byKey['color.primary'].default, '#D81324')
  assert.equal(byKey['font.body'].default, '"Ubuntu", sans-serif')
  assert.equal(byKey['logo'].default, null)
  assert.equal(byKey['hero.title'].default, 'Hello World')
  assert.equal(byKey['hero.title'].binding.field, 'heroTitle', 'copy field camelCased')
  assert.ok(regions.length >= 8, 'meets proof floor region count')
})
