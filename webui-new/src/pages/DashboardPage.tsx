import {
  Activity,
  CheckCircle2,
  XCircle,
  Percent,
  Clock,
  Hourglass,
  Users,
  KeyRound,
  Coins,
  BarChart3,
} from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/stats/StatCard'
import { RequestsChart } from '@/components/stats/RequestsChart'
import { LatencyChart } from '@/components/stats/LatencyChart'
import { PoolStatusCard } from '@/components/stats/PoolStatusCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiCallError } from '@/lib/api'
import { formatLatency, formatNumber, formatPercent, formatUptime } from '@/lib/utils'
import type { AccountsResponse, HistoryResponse, StatsResponse } from '@/lib/types'
import { useLanguage, type Language } from '@/lib/i18n'

export default function DashboardPage() {
  const { language, t } = useLanguage()
  const stats = useApi<StatsResponse>('/admin/api/stats', { pollMs: 5000 })
  const accts = useApi<AccountsResponse>('/admin/api/accounts', { pollMs: 10000 })
  const history = useApi<HistoryResponse>('/admin/api/history', { pollMs: 30000 })

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={t('dashboard.totalRequests')}
          value={formatNumber(stats.data?.total_requests, language)}
          icon={Activity}
          loading={stats.loading && !stats.data}
        />
        <StatCard
          label={t('dashboard.successful')}
          value={formatNumber(stats.data?.success_requests, language)}
          tone="success"
          icon={CheckCircle2}
          loading={stats.loading && !stats.data}
        />
        <StatCard
          label={t('dashboard.failed')}
          value={formatNumber(stats.data?.failed_requests, language)}
          tone="destructive"
          icon={XCircle}
          loading={stats.loading && !stats.data}
        />
        <StatCard
          label={t('dashboard.successRate')}
          value={formatPercent(stats.data?.success_rate, language)}
          tone="primary"
          icon={Percent}
          loading={stats.loading && !stats.data}
        />
        <StatCard
          label={t('dashboard.averageLatency')}
          value={formatLatency(stats.data?.avg_latency_ms, language)}
          icon={Clock}
          loading={stats.loading && !stats.data}
        />
        <StatCard
          label={t('dashboard.uptime')}
          value={formatUptime(stats.data?.uptime_secs, language)}
          icon={Hourglass}
          loading={stats.loading && !stats.data}
        />
      </div>

      {/* 2 charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.requestTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {history.loading && !history.data ? (
              <Skeleton className="h-64 w-full" />
            ) : history.error ? (
              <ChartError err={history.error} />
            ) : history.data && history.data.points.length > 0 ? (
              <RequestsChart points={history.data.points} language={language} />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.latencyTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {history.loading && !history.data ? (
              <Skeleton className="h-64 w-full" />
            ) : history.error ? (
              <ChartError err={history.error} />
            ) : history.data && history.data.points.length > 0 ? (
              <LatencyChart points={history.data.points} p95={stats.data?.p95_latency_ms} language={language} />
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pool status + percentile + token counters */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PoolStatusCard
          accounts={accts.data?.accounts ?? []}
          total={accts.data?.total ?? 0}
          idle={accts.data?.idle ?? 0}
          busy={accts.data?.busy ?? 0}
          error={accts.data?.error ?? 0}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('dashboard.latencyPercentiles')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <PercentileRow label="p50" value={stats.data?.p50_latency_ms} />
            <PercentileRow label="p95" value={stats.data?.p95_latency_ms} tone="warning" />
            <PercentileRow label="p99" value={stats.data?.p99_latency_ms} tone="destructive" />
            <div className="pt-1 text-[11px] text-muted-foreground">
              {t('dashboard.lastRequests', { count: formatNumber(stats.data?.latency_window_size ?? 0, language) })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" />
              {t('dashboard.tokenTotals')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TokenRow icon={KeyRound} label={t('dashboard.prompt')} value={stats.data?.total_prompt_tokens} language={language} />
            <TokenRow icon={Coins} label={t('dashboard.completion')} value={stats.data?.total_completion_tokens} language={language} />
            <div className="pt-1 text-[11px] text-muted-foreground">{t('dashboard.localEstimate')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-model breakdown */}
      {stats.data && Object.keys(stats.data.models).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('dashboard.byModel')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.data.models).map(([model, m]) => (
                <div key={model} className="rounded-md border bg-card p-3 text-sm">
                  <div className="font-medium">{model}</div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{t('dashboard.requestCount', { count: formatNumber(m.requests, language) })}</span>
                    <span>
                      {t('dashboard.modelSuccessFailure', { success: formatNumber(m.requests - m.errors, language), failed: formatNumber(m.errors, language) })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PercentileRow({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value?: number
  tone?: 'default' | 'warning' | 'destructive'
}) {
  const { language } = useLanguage()
  const toneClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${toneClass}`}>{formatLatency(value, language)}</span>
    </div>
  )
}

function TokenRow({
  icon: Icon,
  label,
  value,
  language,
}: {
  icon: typeof KeyRound
  label: string
  value?: number
  language: Language
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{formatNumber(value, language)}</span>
    </div>
  )
}

function ChartError({ err }: { err: ApiCallError }) {
  const { t } = useLanguage()
  return (
    <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
      <XCircle className="mb-2 h-6 w-6 text-destructive" />
      <div>{t('dashboard.historyError')}</div>
      <div className="mt-1 text-xs">{err.message}</div>
    </div>
  )
}

function EmptyChart() {
  const { t } = useLanguage()
  return (
    <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
      <BarChart3 className="mb-2 h-6 w-6 opacity-50" />
      {t('dashboard.noData')}
    </div>
  )
}
