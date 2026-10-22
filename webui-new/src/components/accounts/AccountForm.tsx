import { useState } from 'react'
import { Eye, EyeOff, Loader2, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { post, put, ApiCallError } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { Account } from '@/lib/types'
import { useLanguage } from '@/lib/i18n'

interface Props {
  /** When set, the form is in "edit" mode. */
  account?: Account | null
  onSaved: (saved: Account) => void
  onCancel?: () => void
}

export function AccountForm({ account, onSaved, onCancel }: Props) {
  const { t } = useLanguage()
  const isEdit = !!account
  const [email, setEmail] = useState(account?.email ?? '')
  const [token, setToken] = useState('')
  const [cookies, setCookies] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showCookies, setShowCookies] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (isEdit && account) {
        const body: Record<string, string> = { email }
        if (token) body.token = token
        if (cookies) body.cookies = cookies
        await put(`/admin/api/accounts/${encodeURIComponent(account.id)}`, body)
        toast({ title: t('account.saved'), variant: 'success' })
        // Refetch the account to get the fresh data.
        const saved: Account = { ...account, email: email || account.email }
        onSaved(saved)
      } else {
        if (!token || !cookies) {
          toast({ title: t('account.credentialsRequired'), variant: 'destructive' })
          setBusy(false)
          return
        }
        const res = await post<{ ok: boolean; account: Account }>('/admin/api/accounts', {
          token,
          cookies,
          email: email || '',
        })
        toast({ title: t('account.added'), variant: 'success' })
        onSaved(res.account)
        setEmail('')
        setToken('')
        setCookies('')
        setShowToken(false)
        setShowCookies(false)
      }
    } catch (e) {
      const msg = e instanceof ApiCallError ? e.message : String(e)
      toast({ title: t('account.saveFailed'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="acct-email">{t('account.identifier')}</Label>
        <Input
          id="acct-email"
          dir="auto"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('account.identifierPlaceholder')}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acct-token">{t('account.token')}</Label>
        <div className="relative">
          <Input
            id="acct-token"
            type={showToken ? 'text' : 'password'}
            dir="ltr"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t(isEdit ? 'account.tokenKeepPlaceholder' : 'account.tokenPlaceholder')}
            autoComplete="off"
            className="pe-10 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-9 w-9 text-muted-foreground"
            onClick={() => setShowToken((show) => !show)}
            aria-label={t(showToken ? 'account.hideCredential' : 'account.showCredential')}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acct-cookies">{t('account.cookies')}</Label>
        <div className="relative">
          <Input
            id="acct-cookies"
            type={showCookies ? 'text' : 'password'}
            dir="ltr"
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder={t(isEdit ? 'account.cookiesKeepPlaceholder' : 'account.cookiesPlaceholder')}
            autoComplete="off"
            className="pe-10 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-9 w-9 text-muted-foreground"
            onClick={() => setShowCookies((show) => !show)}
            aria-label={t(showCookies ? 'account.hideCredential' : 'account.showCredential')}
          >
            {showCookies ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t(isEdit ? 'common.save' : 'common.add')}
        </Button>
        {isEdit && onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
      {!isEdit && (
        <p className="text-xs text-muted-foreground">
          {t('account.savedToFile')}
        </p>
      )}
    </div>
  )
}
