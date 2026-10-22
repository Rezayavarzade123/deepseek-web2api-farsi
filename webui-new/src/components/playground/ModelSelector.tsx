import { useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/hooks/useApi'
import { ApiCallError } from '@/lib/api'
import type { ModelsResponse } from '@/lib/types'
import { useLanguage } from '@/lib/i18n'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Optional display-label map (e.g. mark quick/expert modes). */
  labels?: Record<string, string>
}

export function ModelSelector({ value, onChange, labels }: Props) {
  const { t } = useLanguage()
  const { data, error } = useApi<ModelsResponse>('/v1/models')
  const models = data?.data ?? []

  // Restore the saved model when it is still available. If the server's model
  // list changed, select a valid first model instead of keeping a stale value.
  useEffect(() => {
    if (models.length > 0 && !models.some((model) => model.id === value)) {
      onChange(models[0].id)
    }
  }, [models, value, onChange])

  if (error) {
    return (
      <div className="text-xs text-destructive">
        {t('model.loadFailed', { error: error instanceof ApiCallError ? error.message : String(error) })}
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t('model.selectPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {labels?.[m.id] ?? m.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
