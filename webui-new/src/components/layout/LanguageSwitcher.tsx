import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage()
  const nextLanguage = language === 'en' ? 'fa' : 'en'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => setLanguage(nextLanguage)}
      aria-label={t('language.switch')}
      title={t(language === 'en' ? 'language.switchToPersian' : 'language.switchToEnglish')}
    >
      {t(language === 'en' ? 'language.switchToPersian' : 'language.switchToEnglish')}
    </Button>
  )
}
