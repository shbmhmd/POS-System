import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { Badge } from '@/components/ui/badge'
import { Clock, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Header() {
  const { user } = useAuthStore()
  const { currentShift } = useAppStore()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4">
      {/* Left: Branch info */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">{user?.branch_name ?? 'POS System'}</h1>

        {/* Shift indicator */}
        {currentShift ? (
          <Badge variant="success" className="gap-1">
            <Clock className="h-3 w-3" />
            Shift Active
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            No Shift
          </Badge>
        )}
      </div>

      {/* Right: Status, clock, user */}
      <div className="flex items-center gap-4">
        {/* Online status */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-[var(--success)]" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-[var(--destructive)]" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Clock */}
        <div className="text-sm font-mono text-[var(--muted-foreground)]">
          {currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>

        {/* User */}
        {user && (
          <div className="text-right">
            <p className="text-sm font-medium">{user.display_name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{user.role_name}</p>
          </div>
        )}
      </div>
    </header>
  )
}
