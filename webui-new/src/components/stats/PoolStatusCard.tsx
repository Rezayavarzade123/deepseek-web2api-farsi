import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Account } from '@/lib/types'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/lib/i18n'
import { formatNumber, stateLabel } from '@/lib/utils'

interface Props {
  accounts: Account[]
  total: number
  idle: number
  busy: number
  error: number
}

export function PoolStatusCard({ accounts, total, idle, busy, error }: Props) {
  const { language, t } = useLanguage()
  const idlePct = total > 0 ? (idle / total) * 100 : 0
  const busyPct = total > 0 ? (busy / total) * 100 : 0
  const errorPct = total > 0 ? (error / total) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('pool.title')}</CardTitle>
          <Link to="/accounts" className="text-xs text-muted-foreground hover:text-primary">
            {t('pool.manage')}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold tabular-nums">{formatNumber(total, language)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('pool.total')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-success">{formatNumber(idle, language)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('pool.idle')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-primary">{formatNumber(busy, language)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('pool.busy')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-warning">{formatNumber(error, language)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('pool.error')}</div>
          </div>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="bg-success transition-all" style={{ width: `${idlePct}%` }} />
          <div className="bg-primary transition-all" style={{ width: `${busyPct}%` }} />
          <div className="bg-warning transition-all" style={{ width: `${errorPct}%` }} />
        </div>
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {accounts.slice(0, 16).map((a) => (
              <Badge key={a.id} variant={a.state as 'idle' | 'busy' | 'error'} title={`${a.email || a.id} · ${stateLabel(a.state, language)}`}>
                {a.email || a.id.slice(0, 6)}
              </Badge>
            ))}
            {accounts.length > 16 && (
              <span className="text-xs text-muted-foreground">{t('pool.more', { count: formatNumber(accounts.length - 16, language) })}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
