import { Moon, Sun, Monitor, LogOut, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, applyTheme } from '@/stores/theme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/lib/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

interface TopBarProps {
  onRefresh?: () => void
  refreshing?: boolean
}

export function TopBar({ onRefresh, refreshing }: TopBarProps) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { effective } = useTheme()
  const { t } = useLanguage()

  const handleLogout = async () => {
    try {
      await fetch('/admin/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      })
    } catch {
      // ignore — local logout still works
    }
    logout()
    navigate('/login', { replace: true })
  }

  const ThemeIcon = effective === 'dark' ? Moon : Sun

  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b bg-card/40 px-4 backdrop-blur">
      {onRefresh && (
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing} aria-label={t('common.refresh')}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}

      <LanguageSwitcher />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('topbar.switchTheme')}>
            <ThemeIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t('topbar.theme')}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => { setTheme('light'); applyTheme('light') }}>
            <Sun className="me-2 h-4 w-4" /> {t('topbar.light')}
            {theme === 'light' && <span className="ms-auto text-primary">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setTheme('dark'); applyTheme('dark') }}>
            <Moon className="me-2 h-4 w-4" /> {t('topbar.dark')}
            {theme === 'dark' && <span className="ms-auto text-primary">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setTheme('system'); applyTheme('system') }}>
            <Monitor className="me-2 h-4 w-4" /> {t('topbar.system')}
            {theme === 'system' && <span className="ms-auto text-primary">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t('topbar.logout')}>
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  )
}
