import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertPreviewTarget,
  buildAcceptanceMatrix,
  parseManifestDocument,
  validateCatalogContract,
} from './goal93-catalog-acceptance.mjs'

const palette = {
  primary: '#112233',
  primaryD: '#102030',
  bg: '#ffffff',
  surface: '#f7f7f7',
  fg: '#111111',
  fg2: '#555555',
  line: '#dddddd',
  accentSoft: '#eeeeee',
}
const caps = {
  heroEyebrow: true,
  homeStats: false,
  homeGallery: false,
  homeAbout: true,
}

function manifest(overrides = {}) {
  return {
    key: 'fixture',
    name: 'Fixture',
    desc: 'Testmanifest',
    bransch: 'florist',
    palette,
    fonts: { heading: 'Manrope', body: 'Manrope' },
    radius: '0px',
    navHeight: { desktop: '68px', mobile: '56px' },
    caps,
    pages: {
      hem: { module: null, route: '/' },
      butik: { module: 'shop', route: '/shop' },
    },
    mock: ['products'],
    verbatim: ['all copy'],
    ...overrides,
  }
}

function runtimeEntry(overrides = {}) {
  return {
    schemaVersion: 1,
    key: 'fixture',
    name: 'Fixture',
    owner: 'corevo',
    status: 'active',
    replacementKey: null,
    vertical: 'florist',
    requiredModules: ['shop'],
    selectable: true,
    palette,
    fonts: {
      display: 'var(--font-manrope), system-ui, sans-serif',
      body: 'var(--font-manrope), system-ui, sans-serif',
    },
    radius: '0px',
    navHeight: { desktop: '68px', mobile: '56px' },
    caps,
    hasLayout: true,
    hasContent: true,
    hasCapabilities: true,
    editorFields: ['heroTitle'],
    ...overrides,
  }
}

function dbProjection(overrides = {}) {
  return {
    templates: [
      {
        key: 'fixture',
        name: 'Fixture',
        contract_version: 1,
        owner: 'corevo',
        status: 'active',
        selectable: true,
        replacement_key: null,
        tokens: {
          color: palette,
          font: { heading: 'Manrope', body: 'Manrope' },
          layout: { radius: '0px', navHeight: { desktop: '68px', mobile: '56px' } },
          caps,
        },
        sections: ['hem', 'butik'],
        tags: { scope: 'corevo-12', bransch: 'florist', design_bransch: 'florist' },
      },
      {
        key: 'legacy-fixture',
        name: 'Legacy fixture',
        contract_version: 0,
        owner: 'legacy',
        status: 'active',
        selectable: false,
        replacement_key: null,
      },
    ],
    templateVerticals: [{ template_key: 'fixture', vertical_key: 'florist' }],
    templateRequiredModules: [{ template_key: 'fixture', module_key: 'shop' }],
    templateSlots: [
      { template_key: 'fixture', slot_key: 'copy.heroTitle', module_key: null, kind: 'text' },
    ],
    modules: [{ key: 'shop' }],
    verticals: [{ key: 'florist', default_template: 'fixture' }],
    ...overrides,
  }
}

function contract(overrides = {}) {
  return {
    design: [manifest()],
    runtime: {
      schemaVersion: 1,
      knownModules: ['shop'],
      renderableThemes: ['fixture', 'legacy-fixture'],
      moduleStates: ['off', 'draft', 'live', 'paused'],
      copyOverrideKeys: ['heroTitle'],
      catalog: [runtimeEntry()],
    },
    db: dbProjection(),
    ...overrides,
  }
}

test('rejects duplicate manifest blocks and duplicate theme keys', () => {
  const body = JSON.stringify(manifest())
  assert.throws(
    () =>
      parseManifestDocument(
        `<script id="corevo-manifest" type="application/json">${body}</script>` +
          `<script id="corevo-manifest" type="application/json">${body}</script>`,
        'duplicate.dc.html',
      ),
    /manifest-count/,
  )
  assert.throws(
    () => validateCatalogContract({ ...contract(), design: [manifest(), manifest()] }),
    /duplicate-key/,
  )
})

test('rejects a missing required field and unknown future schema version', () => {
  const missing = manifest()
  delete missing.desc
  assert.throws(
    () =>
      parseManifestDocument(
        `<script id="corevo-manifest" type="application/json">${JSON.stringify(missing)}</script>`,
        'missing.dc.html',
      ),
    /manifest-field:desc/,
  )
  assert.throws(
    () => validateCatalogContract({ ...contract(), design: [manifest({ schemaVersion: 2 })] }),
    /manifest-version/,
  )
})

test('rejects unknown modules and invalid routes', () => {
  assert.throws(
    () =>
      validateCatalogContract({
        ...contract(),
        design: [
          manifest({
            pages: { hem: { module: 'unknown', route: '/' } },
          }),
        ],
      }),
    /manifest-module/,
  )
  assert.throws(
    () =>
      validateCatalogContract({
        ...contract(),
        design: [
          manifest({
            pages: { hem: { module: null, route: 'https:\/\/example.com' } },
          }),
        ],
      }),
    /manifest-route/,
  )
})

test('rejects design/code drift and code/DB drift', () => {
  assert.throws(
    () =>
      validateCatalogContract({
        ...contract(),
        runtime: {
          ...contract().runtime,
          catalog: [runtimeEntry({ palette: { ...palette, primary: '#000000' } })],
        },
      }),
    /design-code:fixture:palette/,
  )
  assert.throws(
    () =>
      validateCatalogContract({
        ...contract(),
        db: dbProjection({
          templates: [
            { ...dbProjection().templates[0], owner: 'other' },
            dbProjection().templates[1],
          ],
        }),
      }),
    /code-db:fixture:owner/,
  )
})

test('rejects a renderable legacy theme missing from the DB projection', () => {
  assert.throws(
    () =>
      validateCatalogContract({
        ...contract(),
        db: dbProjection({ templates: [dbProjection().templates[0]] }),
      }),
    /legacy-db:legacy-fixture/,
  )
})

test('requires both viewports and all module fixture states', () => {
  assert.throws(
    () =>
      buildAcceptanceMatrix({
        ...contract(),
        viewports: [{ key: 'desktop', width: 1360 }],
      }),
    /viewport:mobile/,
  )
  assert.throws(
    () =>
      buildAcceptanceMatrix({
        ...contract(),
        fixtureStates: { shop: ['full', 'off-empty'] },
      }),
    /fixture-state:shop:paused/,
  )
  assert.equal(buildAcceptanceMatrix(contract()).length, 8)
})

test('accepts only the Goal preview and rejects production', () => {
  assert.equal(
    assertPreviewTarget({
      projectRef: 'cwnhpesrgolflkmyjbrm',
      supabaseUrl: 'https://cwnhpesrgolflkmyjbrm.supabase.co',
    }).projectRef,
    'cwnhpesrgolflkmyjbrm',
  )
  assert.throws(
    () =>
      assertPreviewTarget({
        projectRef: 'clylvowtowbtotrahuad',
        supabaseUrl: 'https://clylvowtowbtotrahuad.supabase.co',
      }),
    /production-ref/,
  )
})
