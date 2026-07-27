import type { ResolvedThemeContent } from '@/components/storefront/theme-content'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { SiteEditorField, SiteEditorManifest, SiteEditorTab } from '@/components/platform/SidaStudioV2.manifest'

export type EditorManifestKind = 'kalla' | 'snitt' | 'generic'

const field = (defaults: ResolvedThemeContent, key: string, label: string): SiteEditorField => ({
  key,
  label,
  ...((defaults as unknown as Record<string, unknown>)[key]
    ? { defaultValue: (defaults as unknown as Record<string, string>)[key] }
    : {}),
})

/** Shared data only; client and server surfaces use the same manifest contract. */
export function buildSiteEditorManifest(
  kind: EditorManifestKind,
  defaults: ResolvedThemeContent,
  _theme: StorefrontTheme,
): SiteEditorManifest {
  const tabs: SiteEditorTab[] = [
    { id: 'allmant', label: 'Allmänt', sub: 'Namn · färger · sökresultat', path: '', cards: [] },
    { id: 'hem', label: kind === 'snitt' ? 'Postern' : 'Hem', sub: 'Rubriker · texter · bilder', path: '', cards: [] },
    { id: 'tjanster', label: kind === 'kalla' ? 'Behandlingar' : 'Tjänster', sub: 'Utbud och priser', path: '/tjanster', cards: [] },
    { id: 'team', label: kind === 'kalla' ? 'Terapeuter' : kind === 'snitt' ? 'Teamet' : 'Team', sub: 'Teamsidan', path: '/team', cards: [] },
    { id: 'kontakt', label: 'Kontakt', sub: 'Adress · öppettider', path: '/kontakt', cards: [] },
    { id: 'bokning', label: 'Bokning', sub: 'Bokningssätt · tider · bilder', path: '?boka=1', cards: [] },
  ]
  const moduleRows: [string, string, string, string, string][] = [
    ['shop', 'Butik', '/shop', 'shop', '/admin/webshop'],
    ['kurser', 'Kurser', '/kurser', 'kurser', '/admin/kurser'],
    ['blogg', 'Blogg', '/blogg', 'blogg', '/admin/blogg'],
    ['offert', 'Offert', '/offert', 'offert', '/admin/offerter'],
    ['presentkort', 'Presentkort', '/presentkort', 'presentkort', '/admin/presentkort'],
    ['klubb', 'Klubb', '/klubb', 'lojalitet', '/admin/lojalitet'],
    ['galleri', 'Galleri', '/galleri', 'galleri', '/admin/media'],
  ]
  const modules: SiteEditorTab[] = moduleRows.map(([id, label, path, module, href]) => ({
    id, label, sub: `${label}ssidan`, path, module, cards: [{
      id: `${id}-copy`, title: `${label}-sidans texter`, fields: [field(defaults, `${id}Title`, 'Sidrubrik')],
      info: { text: 'Sidans data hanteras i sin modul.', href, label: id === 'galleri' ? 'Bildbibliotek' : `Öppna ${label}` },
    }],
  }))
  return { tabs, modules: kind === 'generic' ? modules : [], swatches: {} }
}
