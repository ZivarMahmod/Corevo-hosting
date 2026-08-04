#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
export const PRODUCTION_REF = 'clylvowtowbtotrahuad'
export const MANIFEST_SCHEMA_VERSION = 1
export const GOAL93_VIEWPORTS = Object.freeze([
  Object.freeze({ key: 'desktop', width: 1360 }),
  Object.freeze({ key: 'mobile', width: 390 }),
])

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(SCRIPT_DIR, '..')
const CODE_DIR = path.resolve(WEB_DIR, '..', '..')
const REPO_ROOT = path.resolve(CODE_DIR, '..')
const MANIFEST_DIR = path.join(REPO_ROOT, '4-Dokument-Underlag', '01-acceptans', 'handoff mallar')
const RUNTIME_SCRIPT = path.join(SCRIPT_DIR, 'goal93-catalog-runtime.ts')
const SELF_TEST_FILE = path.join(SCRIPT_DIR, 'goal93-catalog-acceptance.self-test.mjs')
const PROJECT_REF_FILE = path.join(CODE_DIR, 'supabase', '.temp', 'project-ref')
const REQUIRED_MANIFEST_FIELDS = [
  'key',
  'name',
  'desc',
  'bransch',
  'palette',
  'fonts',
  'radius',
  'navHeight',
  'caps',
  'pages',
  'mock',
  'verbatim',
]
const PALETTE_FIELDS = ['primary', 'primaryD', 'bg', 'surface', 'fg', 'fg2', 'line', 'accentSoft']
const CAP_FIELDS = ['heroEyebrow', 'homeStats', 'homeGallery', 'homeAbout']
const FONT_VARIABLE_BY_FAMILY = new Map(
  Object.entries({
    manrope: 'manrope',
    lora: 'lora',
    nunitosans: 'nunito',
    archivo: 'archivo',
    newsreader: 'newsreader',
    instrumentserif: 'instrumentserif',
    instrumentsans: 'instrumentsans',
    cormorantgaramond: 'cormorant',
    mulish: 'mulish',
    poiretone: 'poiret',
    jost: 'jost',
    spacegrotesk: 'spacegrotesk',
    ibmplexmono: 'plexmono',
    fraunces: 'fraunces',
    hankengrotesk: 'hanken',
    dmserifdisplay: 'dmserif',
    figtree: 'figtree',
    marcellus: 'marcellus',
    karla: 'karla',
    bodonimoda: 'bodoni',
    schibstedgrotesk: 'schibsted',
    anton: 'anton',
    worksans: 'worksans',
  }),
)

function fail(code, detail = '') {
  throw new Error(`goal93:${code}${detail ? `:${detail}` : ''}`)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keysEqual(value, expected) {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
  )
}

function uniqueStrings(values, code) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'string' || value.length === 0) ||
    new Set(values).size !== values.length
  ) {
    fail(code)
  }
  return values
}

function normalizeHexObject(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === 'string' ? item.toLowerCase() : item,
    ]),
  )
}

function sortedJson(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort())
  if (!isRecord(value)) return JSON.stringify(value)
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          isRecord(value[key]) ? JSON.parse(sortedJson(value[key])) : value[key],
        ]),
    ),
  )
}

function sameValue(left, right) {
  return sortedJson(left) === sortedJson(right)
}

function assertSameSet(actual, expected, code) {
  const left = [...new Set(actual)].sort()
  const right = [...new Set(expected)].sort()
  if (!sameValue(left, right)) {
    fail(code, `expected=${right.join(',')};actual=${left.join(',')}`)
  }
}

function manifestVertical(bransch) {
  if (bransch === 'florist') return 'florist'
  if (bransch === 'salong') return 'frisör'
  fail('manifest-branch', String(bransch))
}

function normalizeFamily(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function designFontVariable(value, key, role) {
  const variable = FONT_VARIABLE_BY_FAMILY.get(normalizeFamily(value))
  if (!variable) fail('manifest-font', `${key}:${role}:${value}`)
  return variable
}

function runtimeFontVariable(value, key, role) {
  const match = String(value).match(/var\(--font-([a-z0-9-]+)\)/i)
  if (!match) fail('runtime-font', `${key}:${role}`)
  return match[1].toLowerCase()
}

function validateManifestShape(manifest, source, knownModules = null) {
  if (!isRecord(manifest)) fail('manifest-object', source)
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!Object.hasOwn(manifest, field)) fail(`manifest-field:${field}`, source)
  }
  if (
    Object.hasOwn(manifest, 'schemaVersion') &&
    manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION
  ) {
    fail('manifest-version', `${source}:${manifest.schemaVersion}`)
  }
  for (const field of ['key', 'name', 'desc', 'bransch', 'radius']) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0) {
      fail(`manifest-type:${field}`, source)
    }
  }
  if (!/^[a-z0-9]+$/.test(manifest.key)) fail('manifest-key', manifest.key)
  manifestVertical(manifest.bransch)

  if (!keysEqual(manifest.palette, PALETTE_FIELDS)) fail('manifest-palette', manifest.key)
  for (const [field, color] of Object.entries(manifest.palette)) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
      fail('manifest-color', `${manifest.key}:${field}`)
    }
  }
  if (
    !keysEqual(manifest.fonts, ['heading', 'body']) ||
    Object.values(manifest.fonts).some((font) => typeof font !== 'string' || font.length === 0)
  ) {
    fail('manifest-fonts', manifest.key)
  }
  designFontVariable(manifest.fonts.heading, manifest.key, 'heading')
  designFontVariable(manifest.fonts.body, manifest.key, 'body')
  if (!/^\d+px$/.test(manifest.radius)) fail('manifest-radius', manifest.key)
  if (
    !keysEqual(manifest.navHeight, ['desktop', 'mobile']) ||
    Object.values(manifest.navHeight).some(
      (height) => typeof height !== 'string' || !/^\d+px$/.test(height),
    )
  ) {
    fail('manifest-navHeight', manifest.key)
  }
  if (
    !keysEqual(manifest.caps, CAP_FIELDS) ||
    Object.values(manifest.caps).some((capability) => typeof capability !== 'boolean')
  ) {
    fail('manifest-caps', manifest.key)
  }
  if (!isRecord(manifest.pages) || Object.keys(manifest.pages).length === 0) {
    fail('manifest-pages', manifest.key)
  }
  const seenRoutes = new Set()
  for (const [pageKey, page] of Object.entries(manifest.pages)) {
    if (!/^[a-z0-9]+$/.test(pageKey) || !isRecord(page)) {
      fail('manifest-page', `${manifest.key}:${pageKey}`)
    }
    if (
      typeof page.route !== 'string' ||
      !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(page.route)
    ) {
      fail('manifest-route', `${manifest.key}:${pageKey}`)
    }
    if (seenRoutes.has(page.route))
      fail('manifest-route-duplicate', `${manifest.key}:${page.route}`)
    seenRoutes.add(page.route)
    if (page.module !== null && typeof page.module !== 'string') {
      fail('manifest-module', `${manifest.key}:${pageKey}`)
    }
    if (page.module !== null && knownModules && !knownModules.has(page.module)) {
      fail('manifest-module', `${manifest.key}:${pageKey}:${page.module}`)
    }
  }
  uniqueStrings(manifest.mock, `manifest-mock:${manifest.key}`)
  uniqueStrings(manifest.verbatim, `manifest-verbatim:${manifest.key}`)
  return manifest
}

export function parseManifestDocument(html, source = '<manifest>') {
  if (typeof html !== 'string') fail('manifest-document', source)
  const matches = [
    ...html.matchAll(/<script\b(?=[^>]*\bid=["']corevo-manifest["'])[^>]*>([\s\S]*?)<\/script>/gi),
  ]
  if (matches.length !== 1) fail('manifest-count', `${source}:${matches.length}`)
  const openingTag = matches[0][0].slice(0, matches[0][0].indexOf('>') + 1)
  if (!/\btype=["']application\/json["']/i.test(openingTag)) {
    fail('manifest-type-attribute', source)
  }
  let manifest
  try {
    manifest = JSON.parse(matches[0][1])
  } catch {
    fail('manifest-json', source)
  }
  return validateManifestShape(manifest, source)
}

function validateRuntime(runtime) {
  if (!isRecord(runtime) || runtime.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    fail('runtime-version')
  }
  const knownModules = new Set(uniqueStrings(runtime.knownModules, 'runtime-modules'))
  const renderableThemes = uniqueStrings(
    runtime.renderableThemes,
    'runtime-renderable-themes',
  )
  const copyOverrideKeys = new Set(
    uniqueStrings(runtime.copyOverrideKeys, 'runtime-copy-override-keys'),
  )
  const moduleStates = new Set(uniqueStrings(runtime.moduleStates ?? [], 'runtime-module-states'))
  if (moduleStates.size !== 2 || !moduleStates.has('live') || !moduleStates.has('off')) {
    fail('runtime-module-states')
  }
  if (!Array.isArray(runtime.catalog)) fail('runtime-catalog')
  const byKey = new Map()
  for (const entry of runtime.catalog) {
    if (!isRecord(entry) || typeof entry.key !== 'string') fail('runtime-entry')
    if (byKey.has(entry.key)) fail('runtime-duplicate-key', entry.key)
    byKey.set(entry.key, entry)
    if (entry.schemaVersion !== runtime.schemaVersion) fail('runtime-version', entry.key)
    if (entry.owner !== 'corevo') fail('runtime-owner', entry.key)
    if (!['active', 'deprecated', 'archived'].includes(entry.status)) {
      fail('runtime-status', entry.key)
    }
    if (!['florist', 'frisör'].includes(entry.vertical)) fail('runtime-vertical', entry.key)
    uniqueStrings(entry.requiredModules, `runtime-required-modules:${entry.key}`)
    for (const moduleKey of entry.requiredModules) {
      if (!knownModules.has(moduleKey)) fail('runtime-module', `${entry.key}:${moduleKey}`)
    }
    if (typeof entry.selectable !== 'boolean' || (entry.selectable && entry.status !== 'active')) {
      fail('runtime-selectable', entry.key)
    }
    if (entry.status === 'deprecated') {
      if (typeof entry.replacementKey !== 'string' || entry.replacementKey === entry.key) {
        fail('runtime-replacement', entry.key)
      }
    } else if (entry.replacementKey !== null && entry.replacementKey !== undefined) {
      fail('runtime-replacement', entry.key)
    }
    if (!entry.hasLayout) fail('runtime-layout', entry.key)
    if (!entry.hasContent) fail('runtime-content', entry.key)
    if (!entry.hasCapabilities) fail('runtime-capabilities', entry.key)
    const fields = uniqueStrings(entry.editorFields, `runtime-editor-fields:${entry.key}`)
    if (fields.length === 0) fail('runtime-editor-fields', entry.key)
    for (const field of fields) {
      if (!copyOverrideKeys.has(field)) fail('runtime-editor-consumer', `${entry.key}:${field}`)
    }
  }
  for (const entry of byKey.values()) {
    if (entry.status !== 'deprecated') continue
    const replacement = byKey.get(entry.replacementKey)
    if (!replacement || replacement.status !== 'active') {
      fail('runtime-replacement', entry.key)
    }
  }
  for (const key of byKey.keys()) {
    if (!renderableThemes.includes(key)) fail('runtime-renderable-theme', key)
  }
  const legacyKeys = renderableThemes.filter((key) => !byKey.has(key)).sort()
  return { knownModules, copyOverrideKeys, moduleStates, byKey, legacyKeys }
}

function compareDesignToRuntime(manifest, entry) {
  const key = manifest.key
  if (entry.name !== manifest.name) fail('design-code', `${key}:name`)
  if (entry.vertical !== manifestVertical(manifest.bransch)) {
    fail('design-code', `${key}:vertical`)
  }
  if (!sameValue(normalizeHexObject(entry.palette), normalizeHexObject(manifest.palette))) {
    fail('design-code', `${key}:palette`)
  }
  const runtimeHeading = runtimeFontVariable(entry.fonts?.display, key, 'heading')
  const runtimeBody = runtimeFontVariable(entry.fonts?.body, key, 'body')
  if (runtimeHeading !== designFontVariable(manifest.fonts.heading, key, 'heading')) {
    fail('design-code', `${key}:fonts.heading`)
  }
  if (runtimeBody !== designFontVariable(manifest.fonts.body, key, 'body')) {
    fail('design-code', `${key}:fonts.body`)
  }
  if (entry.radius !== manifest.radius) fail('design-code', `${key}:radius`)
  if (!sameValue(entry.navHeight, manifest.navHeight)) {
    fail('design-code', `${key}:navHeight`)
  }
  if (!sameValue(entry.caps, manifest.caps)) fail('design-code', `${key}:caps`)
  const manifestModules = [
    ...new Set(
      Object.values(manifest.pages)
        .map((page) => page.module)
        .filter(Boolean),
    ),
  ]
  for (const moduleKey of manifestModules) {
    if (!entry.requiredModules.includes(moduleKey)) {
      fail('design-code', `${key}:required-module:${moduleKey}`)
    }
  }
}

function validateDbProjection({ designByKey, runtimeByKey, legacyKeys, runtime, db }) {
  if (!isRecord(db)) fail('db-projection')
  for (const name of [
    'templates',
    'templateVerticals',
    'templateRequiredModules',
    'templateSlots',
    'modules',
    'verticals',
  ]) {
    if (!Array.isArray(db[name])) fail('db-projection', name)
  }
  const templates = new Map(db.templates.map((row) => [row.key, row]))
  const dbSelectable = db.templates.filter((row) => row.selectable === true).map((row) => row.key)
  assertSameSet(dbSelectable, [...designByKey.keys()], 'design-code-db-selectable')
  const moduleKeys = new Set(db.modules.map((row) => row.key))
  const verticalKeys = new Set(db.verticals.map((row) => row.key))

  for (const key of legacyKeys) {
    const template = templates.get(key)
    if (
      !template ||
      template.contract_version !== 0 ||
      template.owner !== 'legacy' ||
      template.status !== 'active' ||
      template.selectable !== false ||
      template.replacement_key !== null
    ) {
      fail('legacy-db', key)
    }
  }

  for (const relation of db.templateVerticals) {
    if (!templates.has(relation.template_key) || !verticalKeys.has(relation.vertical_key)) {
      fail('db-orphan', `vertical:${relation.template_key}:${relation.vertical_key}`)
    }
  }
  for (const relation of db.templateRequiredModules) {
    if (!templates.has(relation.template_key) || !moduleKeys.has(relation.module_key)) {
      fail('db-orphan', `module:${relation.template_key}:${relation.module_key}`)
    }
  }
  for (const slot of db.templateSlots) {
    if (
      !templates.has(slot.template_key) ||
      (slot.module_key !== null && !moduleKeys.has(slot.module_key))
    ) {
      fail('db-orphan', `slot:${slot.template_key}:${slot.slot_key}`)
    }
  }
  for (const vertical of db.verticals) {
    if (vertical.default_template !== null && !templates.has(vertical.default_template)) {
      fail('db-orphan', `vertical-default:${vertical.key}:${vertical.default_template}`)
    }
  }

  for (const [key, manifest] of designByKey) {
    const entry = runtimeByKey.get(key)
    const template = templates.get(key)
    if (!template) fail('code-db', `${key}:missing`)
    if (template.contract_version !== entry.schemaVersion) {
      fail('code-db', `${key}:contract-version`)
    }
    if (template.owner !== entry.owner) fail('code-db', `${key}:owner`)
    if (template.status !== entry.status) fail('code-db', `${key}:status`)
    if (template.selectable !== entry.selectable) fail('code-db', `${key}:selectable`)
    if ((template.replacement_key ?? null) !== (entry.replacementKey ?? null)) {
      fail('code-db', `${key}:replacement`)
    }
    if (
      !sameValue(
        normalizeHexObject(template.tokens?.color ?? {}),
        normalizeHexObject(manifest.palette),
      )
    ) {
      fail('design-db', `${key}:palette`)
    }
    if (
      normalizeFamily(template.tokens?.font?.heading) !== normalizeFamily(manifest.fonts.heading) ||
      normalizeFamily(template.tokens?.font?.body) !== normalizeFamily(manifest.fonts.body)
    ) {
      fail('design-db', `${key}:fonts`)
    }
    if (template.tokens?.layout?.radius !== manifest.radius) {
      fail('design-db', `${key}:radius`)
    }
    if (!sameValue(template.tokens?.layout?.navHeight, manifest.navHeight)) {
      fail('design-db', `${key}:navHeight`)
    }
    if (!sameValue(template.tokens?.caps, manifest.caps)) fail('design-db', `${key}:caps`)
    assertSameSet(template.sections ?? [], Object.keys(manifest.pages), `design-db:${key}:pages`)
    if (
      template.tags?.scope !== 'corevo-12' ||
      template.tags?.bransch !== entry.vertical ||
      template.tags?.design_bransch !== manifest.bransch
    ) {
      fail('design-db', `${key}:tags`)
    }

    const projectedVerticals = db.templateVerticals
      .filter((row) => row.template_key === key)
      .map((row) => row.vertical_key)
    assertSameSet(projectedVerticals, [entry.vertical], `code-db:${key}:vertical`)
    const projectedModules = db.templateRequiredModules
      .filter((row) => row.template_key === key)
      .map((row) => row.module_key)
    assertSameSet(projectedModules, entry.requiredModules, `code-db:${key}:required-modules`)
    for (const moduleKey of entry.requiredModules) {
      if (!moduleKeys.has(moduleKey) || !runtime.knownModules.includes(moduleKey)) {
        fail('code-db', `${key}:module:${moduleKey}`)
      }
    }
    for (const editorField of entry.editorFields) {
      if (
        !db.templateSlots.some(
          (slot) =>
            slot.template_key === key &&
            slot.slot_key === `copy.${editorField}` &&
            slot.kind === 'text',
        )
      ) {
        fail('code-db', `${key}:editor-slot:${editorField}`)
      }
    }
  }

  for (const template of db.templates.filter((row) => row.status === 'deprecated')) {
    if (
      template.selectable ||
      typeof template.replacement_key !== 'string' ||
      template.replacement_key === template.key ||
      templates.get(template.replacement_key)?.status !== 'active'
    ) {
      fail('db-deprecation', template.key)
    }
  }
}

export function validateCatalogContract({ design, runtime, db = null }) {
  if (!Array.isArray(design) || design.length === 0) fail('design-manifests')
  const runtimeState = validateRuntime(runtime)
  const designByKey = new Map()
  for (const manifest of design) {
    validateManifestShape(manifest, manifest.key ?? '<manifest>', runtimeState.knownModules)
    if (designByKey.has(manifest.key)) fail('duplicate-key', manifest.key)
    designByKey.set(manifest.key, manifest)
  }
  const selectableRuntime = runtime.catalog.filter(
    (entry) => entry.status === 'active' && entry.selectable,
  )
  assertSameSet(
    [...designByKey.keys()],
    selectableRuntime.map((entry) => entry.key),
    'design-code-selectable',
  )
  for (const manifest of designByKey.values()) {
    compareDesignToRuntime(manifest, runtimeState.byKey.get(manifest.key))
  }
  if (db !== null) {
    validateDbProjection({
      designByKey,
      runtimeByKey: runtimeState.byKey,
      legacyKeys: runtimeState.legacyKeys,
      runtime,
      db,
    })
  }
  return {
    themeCount: designByKey.size,
    routeCount: [...designByKey.values()].reduce(
      (sum, manifest) => sum + Object.keys(manifest.pages).length,
      0,
    ),
    keys: [...designByKey.keys()].sort(),
    legacyCount: runtimeState.legacyKeys.length,
    legacyKeys: runtimeState.legacyKeys,
  }
}

function validateViewports(viewports) {
  if (!Array.isArray(viewports)) fail('viewport')
  const expected = new Map(GOAL93_VIEWPORTS.map((viewport) => [viewport.key, viewport.width]))
  for (const key of expected.keys()) {
    if (!viewports.some((viewport) => viewport.key === key)) fail(`viewport:${key}`)
  }
  if (viewports.length !== expected.size) fail('viewport-count')
  for (const viewport of viewports) {
    if (!isRecord(viewport) || expected.get(viewport.key) !== viewport.width) {
      fail(`viewport:${viewport?.key ?? 'unknown'}`)
    }
  }
}

function statesFor(moduleKey, fixtureStates) {
  const states = fixtureStates?.[moduleKey] ?? ['full', 'off-empty']
  uniqueStrings(states, `fixture-state:${moduleKey}`)
  for (const required of ['full', 'off-empty']) {
    if (!states.includes(required)) fail(`fixture-state:${moduleKey}:${required}`)
  }
  if (states.some((state) => !['full', 'off-empty'].includes(state))) {
    fail(`fixture-state:${moduleKey}:unknown`)
  }
  return states
}

export function buildAcceptanceMatrix({
  design,
  runtime,
  db = null,
  viewports = GOAL93_VIEWPORTS,
  fixtureStates = null,
}) {
  validateCatalogContract({ design, runtime, db })
  validateViewports(viewports)
  const runtimeState = validateRuntime(runtime)
  const rows = []
  const moduleRepresentatives = new Map()
  for (const manifest of [...design].sort((left, right) => left.key.localeCompare(right.key))) {
    const entry = runtimeState.byKey.get(manifest.key)
    for (const [pageKey, page] of Object.entries(manifest.pages)) {
      if (page.module !== null && !moduleRepresentatives.has(page.module)) {
        moduleRepresentatives.set(page.module, { manifest, entry, pageKey, page })
      }
      for (const viewport of viewports) {
        rows.push({
          id: `${manifest.key}__${pageKey}__${viewport.key}__full`,
          themeKey: manifest.key,
          designBranch: manifest.bransch,
          vertical: entry.vertical,
          pageKey,
          route: page.route,
          module: page.module,
          requiredModules: [...entry.requiredModules],
          viewport: { ...viewport },
          state: 'full',
        })
      }
    }
  }
  for (const moduleKey of [...moduleRepresentatives.keys()].sort()) {
    const { manifest, entry, pageKey, page } = moduleRepresentatives.get(moduleKey)
    const states = statesFor(moduleKey, fixtureStates).filter((state) => state !== 'full')
    for (const viewport of viewports) {
      for (const state of states) {
        rows.push({
          id: `${manifest.key}__${pageKey}__${viewport.key}__${state}`,
          themeKey: manifest.key,
          designBranch: manifest.bransch,
          vertical: entry.vertical,
          pageKey,
          route: page.route,
          module: page.module,
          requiredModules: [...entry.requiredModules],
          viewport: { ...viewport },
          state,
        })
      }
    }
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) fail('matrix-duplicate')
  for (const key of runtimeState.byKey.keys()) {
    const themeRows = rows.filter((row) => row.themeKey === key)
    if (themeRows.length === 0) fail('matrix-theme', key)
    for (const viewport of GOAL93_VIEWPORTS) {
      if (!themeRows.some((row) => row.viewport.key === viewport.key)) {
        fail('matrix-viewport', `${key}:${viewport.key}`)
      }
    }
  }
  return rows
}

export function assertPreviewTarget({ projectRef, supabaseUrl }) {
  const ref = String(projectRef ?? '').trim()
  const rawUrl = String(supabaseUrl ?? '').trim()
  if (ref === PRODUCTION_REF || rawUrl.includes(PRODUCTION_REF)) {
    fail('production-ref')
  }
  if (ref !== PREVIEW_REF) fail('preview-ref', ref || '<missing>')
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    fail('preview-url')
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== `${PREVIEW_REF}.supabase.co` ||
    parsed.pathname !== '/'
  ) {
    fail('preview-url')
  }
  return { projectRef: ref, supabaseUrl: parsed.origin }
}

function loadRuntimeContract() {
  const require = createRequire(import.meta.url)
  const viteNode = require.resolve('vite-node/vite-node.mjs')
  const result = spawnSync(
    process.execPath,
    [viteNode, '-c', path.join(WEB_DIR, 'vitest.config.ts'), RUNTIME_SCRIPT],
    {
      cwd: CODE_DIR,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
      maxBuffer: 16 * 1024 * 1024,
    },
  )
  if (result.status !== 0) {
    fail('runtime-loader', String(result.stderr || result.stdout).trim())
  }
  const line = String(result.stdout)
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith('GOAL93_RUNTIME_JSON='))
  if (!line) fail('runtime-loader', 'missing-json')
  try {
    return JSON.parse(line.slice('GOAL93_RUNTIME_JSON='.length))
  } catch {
    fail('runtime-loader', 'invalid-json')
  }
}

function readDesignManifests() {
  if (!existsSync(MANIFEST_DIR)) fail('manifest-directory')
  const files = readdirSync(MANIFEST_DIR)
    .filter((name) => name.endsWith('.dc.html'))
    .sort((left, right) => left.localeCompare(right, 'sv'))
  if (files.length !== 12) fail('manifest-file-count', String(files.length))
  return files.map((name) => {
    const manifest = parseManifestDocument(
      readFileSync(path.join(MANIFEST_DIR, name), 'utf8'),
      name,
    )
    Object.defineProperty(manifest, '__sourceFile', { value: name, enumerable: false })
    return manifest
  })
}

function parseEnvFile(file) {
  if (!existsSync(file)) return {}
  const values = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

async function readPreviewProjection() {
  const fileEnv = parseEnvFile(path.join(WEB_DIR, '.env.local'))
  const env = { ...fileEnv, ...process.env }
  const projectRef = readFileSync(PROJECT_REF_FILE, 'utf8').trim()
  const target = assertPreviewTarget({
    projectRef,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  })
  const anonKey = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (anonKey.length < 20) fail('preview-anon-key')
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(target.supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const query = async (promise, label) => {
    const result = await promise
    if (result.error) fail('preview-query', `${label}:${result.error.code ?? 'error'}`)
    return result.data ?? []
  }
  const [templates, templateVerticals, templateRequiredModules, templateSlots, modules, verticals] =
    await Promise.all([
      query(
        supabase
          .from('templates')
          .select(
            'key,name,tags,tokens,sections,status,contract_version,owner,selectable,replacement_key',
          ),
        'templates',
      ),
      query(
        supabase.from('template_verticals').select('template_key,vertical_key'),
        'template_verticals',
      ),
      query(
        supabase.from('template_required_modules').select('template_key,module_key'),
        'template_required_modules',
      ),
      query(
        supabase.from('template_slots').select('template_key,slot_key,module_key,kind'),
        'template_slots',
      ),
      query(supabase.from('modules').select('key'), 'modules'),
      query(supabase.from('verticals').select('key,default_template'), 'verticals'),
    ])
  return {
    projectRef,
    templates,
    templateVerticals,
    templateRequiredModules,
    templateSlots,
    modules,
    verticals,
  }
}

function parseCli(argv) {
  const known = new Set(['--self-test', '--contract', '--preview', '--json'])
  for (const argument of argv) {
    if (!known.has(argument)) fail('cli-argument', argument)
  }
  const modes = ['--self-test', '--contract', '--preview'].filter((mode) => argv.includes(mode))
  if (modes.length !== 1) fail('cli-mode')
  if (modes[0] === '--self-test' && argv.includes('--json')) fail('cli-json')
  return {
    mode: modes[0].slice(2),
    json: argv.includes('--json'),
  }
}

function runSelfTest() {
  const result = spawnSync(process.execPath, ['--test', SELF_TEST_FILE], {
    cwd: WEB_DIR,
    encoding: 'utf8',
  })
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  if (result.status !== 0) process.exitCode = result.status || 1
  else process.stdout.write('goal93:self-test OK\n')
}

async function runAcceptance({ mode, json }) {
  const design = readDesignManifests()
  const runtime = loadRuntimeContract()
  const db = mode === 'preview' ? await readPreviewProjection() : null
  const summary = validateCatalogContract({ design, runtime, db })
  const matrix = buildAcceptanceMatrix({ design, runtime, db })
  const payload = {
    goal: 93,
    mode,
    previewRef: db?.projectRef ?? null,
    themeCount: summary.themeCount,
    routeCount: summary.routeCount,
    matrixCount: matrix.length,
    keys: summary.keys,
    legacyCount: summary.legacyCount,
    legacyKeys: summary.legacyKeys,
    designFiles: design
      .map((manifest) => ({ key: manifest.key, file: manifest.__sourceFile }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    viewports: GOAL93_VIEWPORTS,
    matrix,
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`)
    return
  }
  process.stdout.write(
    `goal93:${mode} OK — ${summary.themeCount} teman, ${summary.routeCount} routes, ${matrix.length} matrixfall\n`,
  )
}

async function main() {
  const cli = parseCli(process.argv.slice(2))
  if (cli.mode === 'self-test') {
    runSelfTest()
    return
  }
  await runAcceptance(cli)
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
