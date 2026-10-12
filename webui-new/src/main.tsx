import React from 'react'
import ReactDOM from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { App } from './App'
import { LanguageProvider } from './lib/i18n'
import './styles/globals.css'

// Apply the persisted theme as early as possible so we don't flash a
// light UI for users who prefer dark.
import { useThemeStore, applyTheme } from './stores/theme'
applyTheme(useThemeStore.getState().theme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={200}>
      <LanguageProvider>
        <App />
        <Toaster />
      </LanguageProvider>
    </TooltipProvider>
  </React.StrictMode>,
)
