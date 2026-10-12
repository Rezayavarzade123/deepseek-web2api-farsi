import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n'

export default function NotFoundPage() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Compass className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">{t('notFound.message')}</p>
        <Button asChild className="mt-6">
          <Link to="/">
            <Home className="h-4 w-4" />
            {t('notFound.home')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
