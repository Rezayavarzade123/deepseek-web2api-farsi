import { Copy } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StateBadge } from './StateBadge'
import { ReloginButton } from './ReloginButton'
import { toast } from '@/hooks/use-toast'
import { formatUptime, stateLabel, truncateMiddle } from '@/lib/utils'
import type { Account } from '@/lib/types'
import { useLanguage } from '@/lib/i18n'

/** Format a unix-seconds timestamp as "YYYY-MM-DD HH:mm:ss" in local time. */
function fmtTs(t: number, language: 'en' | 'fa'): string {
  if (!t) return '—'
  return new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(t * 1000))
}

interface Props {
  account: Account | null
  onClose: () => void
  onRelogin?: () => void
}

export function AccountDetailDrawer({ account, onClose, onRelogin }: Props) {
  const { language, t } = useLanguage()
  const open = !!account

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={language === 'fa' ? 'left' : 'right'} className="w-full sm:max-w-md overflow-y-auto">
        {account && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {account.email || account.id}
              </SheetTitle>
              <SheetDescription>
                <span className="flex items-center gap-2">
                  <StateBadge state={account.state} />
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs">{t('account.persisted')}</span>
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('account.identity')}</h3>
                <DetailRow label="ID" value={account.id} mono copyable copyLabel={t('account.copyAccountId')} />
                <DetailRow label={t('account.identifier')} value={account.email || '—'} />
                <DetailRow label={t('account.source')} value="data/accounts.json" mono />
                <DetailRow label={t('account.status')} value={stateLabel(account.state, language)} />
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('account.credentials')}</h3>
                <DetailRow label={t('account.tokenPreview')} value={account.token_preview || '—'} mono copyable />
                <DetailRow
                  label={t('account.cookiesPreview')}
                  value={account.cookies_preview || '—'}
                />
                <DetailRow
                  label={t('account.credentialFingerprint')}
                  value={account.credential_fingerprint || '—'}
                  mono
                  copyable
                />
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('account.runtime')}</h3>
                <DetailRow label={t('account.errorCount')} value={String(account.error_count)} />
                <DetailRow
                  label={t('account.lastUsed')}
                  value={
                    account.last_used > 0
                      ? t('account.timeAgo', { time: fmtTs(account.last_used, language) + ' · ' + formatUptime(Math.floor(Date.now() / 1000 - account.last_used), language) })
                      : '—'
                  }
                />
                <DetailRow
                  label={t('account.createdAt')}
                  value={account.created_at > 0 ? fmtTs(account.created_at, language) : '—'}
                />
                <DetailRow
                  label={t('account.updatedAt')}
                  value={account.updated_at > 0 ? fmtTs(account.updated_at, language) : '—'}
                />
              </section>

              {account.last_error && (
                <>
                  <Separator />
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('account.lastErrorSection')}</h3>
                    <pre className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive whitespace-pre-wrap break-words font-mono">
                      {truncateMiddle(account.last_error, 240, 0)}
                    </pre>
                  </section>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2">
                {account.state === 'error' && (
                  <ReloginButton accountId={account.id} onDone={onRelogin} />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  copyable = false,
  copyLabel,
}: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
  copyLabel?: string
}) {
  const { t } = useLanguage()

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: t('common.copied'), variant: 'success' })
    } catch {
      toast({ title: t('common.copyFailed'), variant: 'destructive' })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`flex items-center gap-1.5 min-w-0 text-end ${mono ? 'font-mono text-xs' : ''}`}>
        <span className="truncate" title={value}>{value}</span>
        {copyable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => void copyValue()}
            aria-label={copyLabel ?? t('common.copy')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </span>
    </div>
  )
}
