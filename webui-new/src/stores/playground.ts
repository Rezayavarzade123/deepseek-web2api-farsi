import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlaygroundSettingsState {
  model: string
  systemPrompt: string
  thinking: boolean
  search: boolean
  setModel: (model: string) => void
  setSystemPrompt: (systemPrompt: string) => void
  setThinking: (thinking: boolean) => void
  setSearch: (search: boolean) => void
}

/**
 * Keep the Playground's request preferences across page reloads. Conversation
 * messages are deliberately not included, so only these settings are stored
 * in this browser's local storage.
 */
export const usePlaygroundSettingsStore = create<PlaygroundSettingsState>()(
  persist(
    (set) => ({
      model: '',
      systemPrompt: '',
      thinking: false,
      search: false,
      setModel: (model) => set({ model }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setThinking: (thinking) => set({ thinking }),
      setSearch: (search) => set({ search }),
    }),
    {
      name: 'ds2api-playground-settings',
      version: 1,
      partialize: (state) => ({
        model: state.model,
        systemPrompt: state.systemPrompt,
        thinking: state.thinking,
        search: state.search,
      }),
    },
  ),
)
