import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  Clock,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  Users
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  shortcut?: string
  permissionKey?: string
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', shortcut: '' },
  { to: '/pos', icon: ShoppingCart, label: 'POS', shortcut: 'F1' },
  { to: '/products', icon: Package, label: 'Products', permissionKey: 'manage_products' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/purchases', icon: Truck, label: 'Purchases', permissionKey: 'manage_purchases' },
  { to: '/shifts', icon: Clock, label: 'Shifts' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: BarChart3, label: 'Reports', permissionKey: 'reports_access' },
  { to: '/settings', icon: Settings, label: 'Settings', permissionKey: 'manage_settings' }
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user, hasPermission } = useAuthStore()

  const visibleItems = navItems.filter((item) => {
    if (!item.permissionKey) return true
    return hasPermission(item.permissionKey)
  })

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-[var(--sidebar-border)] px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]">
          <Store className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold text-[var(--foreground)]">POS System</span>
            <span className="truncate text-xs text-[var(--muted-foreground)]">
              {user?.branch_name ?? 'No Branch'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]'
                    : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-xs opacity-50">{item.shortcut}</span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Bottom section */}
      <div className="p-2">
        {/* User Info */}
        {user && !collapsed && (
          <div className="mb-2 rounded-lg bg-[var(--sidebar-accent)] p-2">
            <p className="truncate text-sm font-medium text-[var(--sidebar-accent-foreground)]">
              {user.display_name}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">{user.role_name}</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => useAuthStore.getState().logout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--destructive)] hover:text-white',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] mt-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
