import { PageHeader } from '@/components/layout/PageHeader'
import { ApiKeyManager } from '@/components/settings/ApiKeyManager'
import { EnvPreview } from '@/components/settings/EnvPreview'
import { useLanguage } from '@/lib/i18n'

export default function SettingsPage() {
  const { t } = useLanguage()
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />
      <ApiKeyManager />
      <EnvPreview />
    </div>
  )
}
