import { Copy, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/lib/i18n'

export function ApiEndpointCard() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const apiBaseUrl = `${window.location.origin}/v1`

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(apiBaseUrl)
      toast({ title: t('apiEndpoint.copied') })
    } catch {
      toast({
        title: t('apiEndpoint.copyFailed'),
        description: t('apiEndpoint.copyManual'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          {t('apiEndpoint.title')}
        </CardTitle>
        <CardDescription>{t('apiEndpoint.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="api-base-url" className="text-sm font-medium">
            {t('apiEndpoint.baseUrl')}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="api-base-url"
              value={apiBaseUrl}
              readOnly
              dir="ltr"
              className="font-mono text-sm"
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t('apiEndpoint.baseUrl')}
            />
            <Button variant="outline" onClick={() => void copyAddress()} aria-label={t('apiEndpoint.copy')}>
              <Copy className="h-4 w-4" />
              {t('apiEndpoint.copy')}
            </Button>
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t('apiEndpoint.openaiRoutes')}</p>
          <p>{t('apiEndpoint.anthropicRoute')}</p>
          <p>{t('apiEndpoint.authNote')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
