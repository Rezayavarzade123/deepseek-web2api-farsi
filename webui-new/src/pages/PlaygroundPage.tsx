import { useState, useRef, useEffect } from 'react'
import { Send, Square, Trash2, FlaskConical, Info } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import { usePlaygroundSettingsStore } from '@/stores/playground'
import { ApiCallError } from '@/lib/api'
import { ModelSelector } from '@/components/playground/ModelSelector'
import { MessageList, type ChatMessage, type StreamingState } from '@/components/playground/MessageList'
import { useLanguage } from '@/lib/i18n'

/** Messages sent to the backend (OpenAI-compatible subset we support). */
interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function createConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `playground-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function PlaygroundPage() {
  const { t } = useLanguage()
  const token = useAuthStore((s) => s.token)
  const { toast } = useToast()
  const modelLabels = { 'deepseek-flash': t('playground.flashAlias') }

  // These controls send private web-chat hints; their current upstream behavior is unverified.
  // The response model name is a local proxy alias, not proof of upstream model selection.
  const model = usePlaygroundSettingsStore((s) => s.model)
  const setModel = usePlaygroundSettingsStore((s) => s.setModel)
  const systemPrompt = usePlaygroundSettingsStore((s) => s.systemPrompt)
  const setSystemPrompt = usePlaygroundSettingsStore((s) => s.setSystemPrompt)
  const thinking = usePlaygroundSettingsStore((s) => s.thinking)
  const setThinking = usePlaygroundSettingsStore((s) => s.setThinking)
  const search = usePlaygroundSettingsStore((s) => s.search)
  const setSearch = usePlaygroundSettingsStore((s) => s.setSearch)

  const [input, setInput] = useState('')
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState(createConversationId)
  const [streaming, setStreaming] = useState<StreamingState | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const acRef = useRef<AbortController | null>(null)
  // Tracks the latest accumulated stream so stop/abort handlers read the
  // current value instead of a stale render closure.
  const accRef = useRef<StreamingState>({ reasoning: '', content: '' })

  useEffect(() => () => acRef.current?.abort(), [])

  const handleSend = async () => {
    if (!input.trim() || !model || busy) return
    const userMsg: ChatMessage = { role: 'user', content: input }
    const nextHistory = [...history, userMsg]
    setHistory(nextHistory)
    setInput('')
    setBusy(true)
    setStreaming({ reasoning: '', content: '' })

    const apiMessages: ApiMessage[] = []
    if (systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: systemPrompt })
    }
    for (const m of nextHistory) apiMessages.push({ role: m.role, content: m.content })

    const ac = new AbortController()
    acRef.current = ac
    const acc: StreamingState = { reasoning: '', content: '' }
    accRef.current = acc

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(token ? { 'X-DS2API-Admin-Token': token } : {}),
          'X-Conversation-Id': conversationId,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          stream: true,
          thinking_mode: thinking,
          search_enabled: search,
        }),
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        const body = await res.text()
        throw new ApiCallError(res.status, `HTTP ${res.status}: ${body.slice(0, 300)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let streamError: string | null = null

      // Consume one "data: <json>" payload and accumulate its text.
      const handleEvent = (payload: string) => {
        if (payload === '[DONE]') return
        try {
          const obj = JSON.parse(payload)
          if (obj.error) {
            const message = typeof obj.error === 'string' ? obj.error : obj.error.message
            streamError = typeof message === 'string' && message
              ? message.slice(0, 500)
              : t('playground.streamErrorFallback')
            return
          }

          const choice = obj.choices?.[0]
          if (!choice) return
          if (choice.finish_reason === 'error') {
            streamError = t('playground.streamErrorFallback')
            return
          }
          const delta = choice.delta ?? {}
          if (typeof delta.reasoning_content === 'string') {
            acc.reasoning += delta.reasoning_content
          } else if (typeof delta.content === 'string') {
            acc.content += delta.content
          }
          accRef.current = { reasoning: acc.reasoning, content: acc.content }
          setStreaming({ reasoning: acc.reasoning, content: acc.content })
        } catch {
          // ignore malformed chunk
        }
      }

      // Parse SSE: events separated by a blank line, each "data: <json>"
      // line; "data: [DONE]" terminates. CRLF is normalised so the split
      // works no matter which line ending the transport uses.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

        let sep
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const event = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          for (const line of event.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            handleEvent(trimmed.slice(5).trim())
          }
        }
      }

      // Flush any incomplete UTF-8 sequence left at the end of the stream.
      buf += decoder.decode().replace(/\r\n/g, '\n')

      // Flush a trailing event that reached EOF without a closing blank line.
      if (buf.trim()) {
        for (const line of buf.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          handleEvent(trimmed.slice(5).trim())
        }
      }

      if (streamError) throw new ApiCallError(res.status, streamError)

      setHistory([
        ...nextHistory,
        { role: 'assistant', content: acc.content, reasoning: acc.reasoning },
      ])
      setStreaming(null)
    } catch (e) {
      if (ac.signal.aborted) {
        const cur = accRef.current
        if (cur.content.trim() || cur.reasoning.trim()) {
          setHistory([
            ...nextHistory,
            { role: 'assistant', content: cur.content, reasoning: cur.reasoning },
          ])
        } else {
          setHistory(nextHistory)
        }
      } else {
        const msg = e instanceof ApiCallError ? e.message : String(e)
        toast({ title: t('playground.requestFailed'), description: msg, variant: 'destructive' })
      }
      setStreaming(null)
    } finally {
      setBusy(false)
      acRef.current = null
    }
  }

  const handleStop = () => {
    acRef.current?.abort()
  }

  const handleClear = () => {
    setHistory([])
    setConversationId(createConversationId())
    setStreaming(null)
    setClearOpen(false)
  }

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      <PageHeader
        title={t('playground.title')}
        description={t('playground.description')}
        actions={
          <Button
            variant="outline"
            onClick={() => setClearOpen(true)}
            disabled={history.length === 0 || busy}
          >
            <Trash2 className="h-4 w-4" />
            {t('playground.clear')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px,1fr] flex-1 min-h-0">
        {/* Left column: request parameters */}
        <Card className="overflow-y-auto scrollbar-thin">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              {t('playground.parameters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[11px] text-muted-foreground">
              {t('playground.preferencesSaved')}
            </p>

            <div className="space-y-1.5">
              <Label>{t('playground.model')}</Label>
              <ModelSelector value={model} onChange={setModel} labels={modelLabels} />
              <p className="text-[11px] text-muted-foreground">
                {t('playground.modelNote')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="system">{t('playground.systemPrompt')}</Label>
              <textarea
                id="system"
                value={systemPrompt}
              dir="auto"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('playground.systemPlaceholder')}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="thinking">{t('playground.thinking')}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t('playground.thinkingNote')}
                </p>
              </div>
              <Switch id="thinking" checked={thinking} onCheckedChange={setThinking} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="search">{t('playground.search')}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t('playground.searchNote')}
                </p>
              </div>
              <Switch id="search" checked={search} onCheckedChange={setSearch} />
            </div>

            <div className="rounded-md border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground space-y-1">
              <p className="flex items-center gap-1 font-medium text-foreground/80">
                <Info className="h-3.5 w-3.5" />
                {t('playground.rules')}
              </p>
              <p>· {t('playground.envPriority')}</p>
              <p>· {t('playground.legacyExpert')}</p>
              <p>· {t('playground.forceFlags')}</p>
              <p>· {t('playground.ignoredParams')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Right column: conversation */}
        <Card className="flex flex-col min-h-0">
          <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
            <MessageList messages={history} streaming={streaming} />
          </CardContent>
          <div className="border-t p-3 flex items-end gap-2">
            <Input
              value={input}
              dir="auto"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={t('playground.inputPlaceholder')}
              disabled={busy || !model}
              className="flex-1"
            />
            {busy ? (
              <Button variant="destructive" onClick={handleStop} aria-label={t('playground.stop')}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!input.trim() || !model}>
                <Send className="h-4 w-4" />
                {t('playground.send')}
              </Button>
            )}
          </div>
          <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            {t('playground.keyboardHelp')}
          </div>
        </Card>
      </div>

      {/* Clear-confirm dialog */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('playground.clearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('playground.clearDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('playground.clearConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
