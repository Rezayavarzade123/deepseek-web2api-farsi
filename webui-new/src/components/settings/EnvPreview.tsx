import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { get } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/lib/i18n'
import { formatNumber } from '@/lib/utils'

interface EnvInfo {
  name: string
  value: string
  is_default: boolean
  source?: string
  description?: string
}

interface EnvInfoResponse {
  host: string
  port: number
  insecure_public_defaults: boolean
  admin_password_set: boolean
  admin_password_weak: boolean
  accounts_total: number
  crypto: {
    enabled: boolean
    fernet_configured: boolean
  }
  cors: {
    origins: string[]
    allow_credentials: boolean
  }
  trusted_proxies: string[]
  model_routes_configured: boolean
  rate_limit: {
    enabled: boolean
    per_key: number
    per_ip: number
  }
  session_cache_ttl: number
  log_level: string
  log_format: string
  dsml_max_buffer_bytes: number
  uptime_secs: number
  server_version: string
  env_overrides: EnvInfo[]
}

export function EnvPreview() {
  const [info, setInfo] = useState<EnvInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { language, t } = useLanguage()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    get<EnvInfoResponse>('/admin/api/env')
      .then((d) => !cancelled && setInfo(d))
      .catch((e) => {
        if (cancelled) return
        setError(String(e?.message ?? e))
        toast({ title: t('env.loadFailed'), description: String(e?.message ?? e), variant: 'destructive' })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [toast, t])

  if (loading && !info) {
    return <div className="text-sm text-muted-foreground">{t('env.loading')}</div>
  }
  if (error || !info) {
    return <div className="text-sm text-destructive">{error ?? t('env.error')}</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('env.runtime')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row k={t('env.serverVersion')} v={info.server_version} />
          <Row k={t('env.bindAddress')} v={`${info.host}:${info.port}`} />
          <Row k={t('dashboard.uptime')} v={info.uptime_secs > 0 ? t('env.uptime', { minutes: formatNumber(Math.floor(info.uptime_secs / 60), language) }) : '—'} />
          <Row k={t('env.logging')} v={`${info.log_level} / ${info.log_format}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('env.security')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row
            k={t('env.adminPassword')}
            v={info.admin_password_weak ? `⚠ ${t('env.weakPassword')}` : t('env.strongPassword')}
            warn={info.admin_password_weak}
          />
          <Row
            k="ALLOW_INSECURE_PUBLIC_DEFAULTS"
            v={info.insecure_public_defaults ? t('env.insecureAllowed') : t('env.secureFalse')}
            warn={info.insecure_public_defaults}
          />
          <Row
            k={t('env.credentialEncryption')}
            v={info.crypto.enabled ? `Fernet (${t(info.crypto.fernet_configured ? 'env.fernetConfigured' : 'env.fernetMissing')})` : t('env.plaintext')}
            warn={!info.crypto.enabled}
          />
          <Row
            k={t('env.corsOrigins')}
            v={info.cors.origins.length === 0 ? t('env.sameOrigin') : info.cors.origins.join(', ')}
          />
          <Row
            k={t('env.cookieCredentials')}
            v={info.cors.allow_credentials ? t('env.yes') : t('env.no')}
          />
          <Row
            k={t('env.trustedProxies')}
            v={info.trusted_proxies.length === 0 ? t('env.trustedProxiesMissing') : info.trusted_proxies.join(', ')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('env.accountPool')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row k={t('env.total')} v={formatNumber(info.accounts_total, language)} />
          <Row k={t('env.configMethod')} v="WebUI / data/accounts.json" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('env.behavior')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row k="MODEL_ROUTES" v={info.model_routes_configured ? t('env.routesConfigured') : t('env.routesNotConfigured')} />
          <Row k={t('env.rateLimit')} v={info.rate_limit.enabled ? t('env.rateLimitOn', { perKey: formatNumber(info.rate_limit.per_key, language), perIp: formatNumber(info.rate_limit.per_ip, language) }) : t('env.rateLimitOff')} />
          <Row k="SESSION_CACHE_TTL" v={info.session_cache_ttl === 0 ? t('env.cacheDisabled') : t('env.seconds', { seconds: formatNumber(info.session_cache_ttl, language) })} />
          <Row k="DSML_MAX_BUFFER_BYTES" v={formatNumber(info.dsml_max_buffer_bytes, language)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('env.allVariables')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">{t('env.name')}</TableHead>
                <TableHead>{t('env.value')}</TableHead>
                <TableHead className="w-[100px] text-end">{t('env.source')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {info.env_overrides.map((e) => (
                <TableRow key={e.name}>
                  <TableCell className="font-mono text-xs">{e.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground break-all">
                    {e.value || <span className="italic">{t('common.empty')}</span>}
                  </TableCell>
                  <TableCell className="text-end">
                    {e.is_default ? (
                      <Badge variant="outline">{t('env.default')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('env.set')}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={warn ? 'text-warning font-medium' : 'text-end'}>{v}</span>
    </div>
  )
}
