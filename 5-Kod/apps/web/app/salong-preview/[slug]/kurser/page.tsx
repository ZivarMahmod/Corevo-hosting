import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import KurserPage from '@/app/(public)/kurser/page'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: kursernas preview-tvilling. Kurssidan är DELAD över alla
// mallar (ingen tema-dispatch), så tvillingen återanvänder den publika sidkomponenten
// rakt av — middleware sätter x-corevo-tenant-slug ur preview-URL:en, så currentTenant()
// inne i den resolvar rätt tenant. Modul AV → ärligt besked i stället för dess notFound.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Kurser', robots: { index: false } }

export default async function PreviewKurserPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'kurser') && !isModulePaused(states, 'kurser')

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {off ? <PreviewModuleOff moduleLabel="Kurser & event" /> : <KurserPage />}
    </PreviewShell>
  )
}
