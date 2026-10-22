import { NavLink, useLocation } from 'react-router-dom'
import { Activity, Users, FlaskConical, Settings, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useLanguage, type TranslationKey } from '@/lib/i18n'

interface NavItem {
  to: string
  label: TranslationKey
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'nav.overview', icon: Activity, end: true },
  { to: '/accounts', label: 'nav.accounts', icon: Users },
  { to: '/playground', label: 'nav.playground', icon: FlaskConical },
  { to: '/settings', label: 'nav.settings', icon: Settings },
]

const SIDEBAR_STORAGE_KEY = 'ds2api-sidebar-collapsed'

function getInitialCollapsedState(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState)
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch {
      // The panel remains usable when browser storage is unavailable.
    }
  }, [collapsed])
  const location = useLocation()
  const { t } = useLanguage()

  return (
    <aside
      className={cn(
        'flex flex-col border-e bg-card transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-sm">
          D
        </div>
        {!collapsed && (
          <div className="ms-2.5 flex-1 overflow-hidden">
            <div className="truncate text-sm font-semibold">DS2API</div>
            <div className="truncate text-[10px] text-muted-foreground tracking-wider">
              {t('nav.adminPanel')}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
              title={collapsed ? t(item.label) : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{t(item.label)}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 rtl-flip" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 rtl-flip" />
              <span>{t('common.collapse')}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
