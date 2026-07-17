import { PageHead } from '@/components/portal/ui'
import { settingsCategories, type SettingsCategoryId } from '@/lib/admin/settings-map'
import { SettingsWorkspace } from './SettingsWorkspace'

export function SettingsWorkspaceEmpty({
  currentCategory,
  title,
}: {
  currentCategory: SettingsCategoryId
  title: string
}) {
  return (
    <SettingsWorkspace categories={settingsCategories()} currentCategory={currentCategory}>
      <section className="portal-section">
        <PageHead eyebrow="Inställningar" title={title} />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    </SettingsWorkspace>
  )
}
