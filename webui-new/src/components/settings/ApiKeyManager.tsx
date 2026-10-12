import { useEffect, useState } from 'react'
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { del, get, post } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import { formatNumber } from '@/lib/utils'

interface ApiKeyRecord {
  id: string
  name: string
  prefix: string
  created_at: number
}

interface ApiKeyListResponse {
  keys: ApiKeyRecord[]
}

interface ApiKeyCreateResponse {
  key: string
  api_key: ApiKeyRecord
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { language, t } = useLanguage()

  useEffect(() => {
    let cancelled = false
    get<ApiKeyListResponse>('/admin/api/api-keys')
      .then((result) => {
        if (!cancelled) setKeys(result.keys)
      })
      .catch((e) => {
        if (cancelled) return
        const message = String(e?.message ?? e)
        setError(message)
        toast({ title: t('apikey.loadFailed'), description: message, variant: 'destructive' })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [toast, t])

  async function createKey() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast({ title: t('apikey.nameRequired'), variant: 'destructive' })
      return
    }

    setCreating(true)
    setError(null)
    try {
      const result = await post<ApiKeyCreateResponse>('/admin/api/api-keys', { name: trimmedName })
      setKeys((current) => [result.api_key, ...current])
      setNewKey(result.key)
      setName('')
      setConfirmingId(null)
      toast({ title: t('apikey.generated'), description: t('apikey.copyNow') })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      toast({ title: t('apikey.createFailed'), description: message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(key: ApiKeyRecord) {
    setRevokingId(key.id)
    setError(null)
    try {
      await del(`/admin/api/api-keys/${encodeURIComponent(key.id)}`)
      setKeys((current) => current.filter((item) => item.id !== key.id))
      setConfirmingId(null)
      toast({ title: t('apikey.revoked'), description: t('apikey.revokedDetail', { name: key.name }) })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      toast({ title: t('apikey.revokeFailed'), description: message, variant: 'destructive' })
    } finally {
      setRevokingId(null)
    }
  }

  async function copyKey() {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      toast({ title: t('apikey.copied') })
    } catch {
      toast({
        title: t('apikey.copyUnavailable'),
        description: t('apikey.copyManual'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              {t('apikey.title')}
            </CardTitle>
            <CardDescription>
              {t('apikey.description')}
            </CardDescription>
          </div>
          <Badge variant="secondary">{t('apikey.count', { count: formatNumber(keys.length, language) })}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            dir="auto"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void createKey()}
            placeholder={t('apikey.namePlaceholder')}
            maxLength={64}
            aria-label={t('apikey.nameLabel')}
            disabled={creating}
          />
          <Button onClick={() => void createKey()} disabled={creating || !name.trim()}>
            <Plus className="h-4 w-4" />
            {creating ? t('apikey.generating') : t('apikey.create')}
          </Button>
        </div>

        {newKey && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="text-sm font-medium">{t('apikey.copyNow')}</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={newKey} dir="ltr" readOnly className="font-mono text-xs select-all" aria-label={t('apikey.newKeyLabel')} />
              <Button variant="outline" onClick={() => void copyKey()}>
                <Copy className="h-4 w-4" />{t('apikey.copy')}
              </Button>
              <Button variant="ghost" onClick={() => setNewKey(null)}>{t('apikey.done')}</Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('apikey.loading')}</p>
        ) : keys.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t('apikey.empty')}
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-sm font-medium">{key.name}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <code className="font-mono">{key.prefix}…</code>
                    <span>{t('apikey.createdAt', { date: new Date(key.created_at * 1000).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') })}</span>
                  </div>
                </div>
                {confirmingId === key.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-destructive">{t('apikey.confirmRevoke')}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void revokeKey(key)}
                      disabled={revokingId === key.id}
                    >
                      {revokingId === key.id ? t('apikey.revoking') : t('apikey.confirm')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)} disabled={revokingId === key.id}>
                      {t('apikey.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmingId(key.id)}
                    aria-label={`${t('apikey.revoke')} ${key.name}`}
                  >
                    <Trash2 className="h-4 w-4" />{t('apikey.revoke')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
