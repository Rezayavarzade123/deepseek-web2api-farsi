import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import type { HistoryPoint } from '@/lib/types'
import { useLanguage, type Language } from '@/lib/i18n'
import { formatLatency } from '@/lib/utils'

interface Props {
  points: HistoryPoint[]
  /** Optional p95 reference value. */
  p95?: number
  language: Language
}

export function LatencyChart({ points, p95, language }: Props) {
  const { t } = useLanguage()
  const locale = language === 'fa' ? 'fa-IR' : 'en-US'
  const data = points.map((p) => ({
    t: new Date(p.t * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    avgLatency: Math.round(p.avg_latency_ms),
  }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatLatency(Number(v), language)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatLatency(value, language), t('dashboard.averageLatency')]}
          />
          {p95 !== undefined && (
            <ReferenceLine y={p95} stroke="hsl(38 92% 50%)" strokeDasharray="3 3" label={{ value: 'p95', fill: 'hsl(38 92% 50%)', fontSize: 10, position: 'right' }} />
          )}
          <Line type="monotone" dataKey="avgLatency" name={t('dashboard.averageLatency')} stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
