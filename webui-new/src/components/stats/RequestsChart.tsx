import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryPoint } from '@/lib/types'
import { useLanguage, type Language } from '@/lib/i18n'
import { formatNumber } from '@/lib/utils'

interface Props {
  points: HistoryPoint[]
  language: Language
}

export function RequestsChart({ points, language }: Props) {
  const { t } = useLanguage()
  const locale = language === 'fa' ? 'fa-IR' : 'en-US'
  const data = points.map((p) => ({
    t: new Date(p.t * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    success: p.success,
    failed: p.failed,
  }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [formatNumber(value, language), name]}
          />
          <Area type="monotone" dataKey="success" name={t('dashboard.successful')} stroke="hsl(160 84% 39%)" fill="url(#gradSuccess)" strokeWidth={2} />
          <Area type="monotone" dataKey="failed" name={t('dashboard.failed')} stroke="hsl(0 84% 60%)" fill="url(#gradFailed)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
