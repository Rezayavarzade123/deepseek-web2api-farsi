import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { translate, type Language } from './i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function numberLocale(language: Language) {
  return language === 'fa' ? 'fa-IR' : 'en-US'
}

/** Format a duration in seconds using the selected UI language. */
export function formatUptime(seconds: number | null | undefined, language: Language = 'en'): string {
  if (!seconds || seconds < 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const format = (key: Parameters<typeof translate>[1], count: number) =>
    translate(language, key, { count: count.toLocaleString(numberLocale(language)) })
  const parts: string[] = []
  if (d > 0) parts.push(format(language === 'fa' ? 'duration.daysFa' : 'duration.days', d))
  if (h > 0) parts.push(format(language === 'fa' ? 'duration.hoursFa' : 'duration.hours', h))
  if (parts.length === 0 && m > 0) parts.push(format(language === 'fa' ? 'duration.minutesFa' : 'duration.minutes', m))
  if (parts.length === 0) parts.push(format(language === 'fa' ? 'duration.secondsFa' : 'duration.seconds', s))
  return parts.join(' ')
}

/** Format a millisecond latency: < 1s → "NNNms", else "N.NNs". */
export function formatLatency(ms: number | null | undefined, language: Language = 'en'): string {
  if (ms === null || ms === undefined || ms < 0) return '-'
  const locale = numberLocale(language)
  if (ms < 1000) {
    return `${Math.round(ms).toLocaleString(locale)}${language === 'fa' ? ' میلی‌ثانیه' : 'ms'}`
  }
  return `${(ms / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${language === 'fa' ? ' ثانیه' : 's'}`
}

/** Format a number with locale-aware digits and separators. */
export function formatNumber(n: number | null | undefined, language: Language = 'en'): string {
  if (n === null || n === undefined) return '-'
  return n.toLocaleString(numberLocale(language))
}

/** Format a success rate 0..1 as a locale-aware percentage. */
export function formatPercent(rate: number | null | undefined, language: Language = 'en'): string {
  if (rate === null || rate === undefined) return '-'
  return new Intl.NumberFormat(numberLocale(language), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate)
}

/** Map backend account.state to a locale-aware display label. */
export function stateLabel(state: string, language: Language = 'en'): string {
  const key = state === 'idle' ? 'state.idle' : state === 'busy' ? 'state.busy' : state === 'error' ? 'state.error' : null
  return key ? translate(language, key) : state
}

/** Truncate a long string in the middle (for token previews). */
export function truncateMiddle(s: string, head = 8, tail = 4): string {
  if (!s) return ''
  if (s.length <= head + tail + 3) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}
