import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import SetupWizard from '@/pages/SetupWizard'
import DashboardPage from '@/pages/DashboardPage'
import POSPage from '@/pages/POSPage'
import ProductsPage from '@/pages/ProductsPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchasesPage from '@/pages/PurchasesPage'
import ShiftsPage from '@/pages/ShiftsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [showChangelog, setShowChangelog] = useState(false)
  const [changelog, setChangelog] = useState('')
  const [currentVersion, setCurrentVersion] = useState('')
  const { isSetupComplete, checkSetupStatus } = useAppStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    checkSetupStatus().finally(() => setLoading(false))
  }, [checkSetupStatus])

  // Check if we need to show the changelog after an update
  useEffect(() => {
    const checkChangelog = async () => {
      try {
        const api = (window as any).api
        const versionRes = await api.updater.getVersion()
        const lastShownRes = await api.updater.getLastShownVersion()
        const version = versionRes?.data || '0.0.0'
        const lastShown = lastShownRes?.data || '0.0.0'
        setCurrentVersion(version)

        if (version !== lastShown && lastShown !== '0.0.0') {
          // Version changed since last shown — show changelog
          const changelogRes = await api.updater.getChangelog()
          if (changelogRes?.success && changelogRes.data) {
            setChangelog(changelogRes.data)
            setShowChangelog(true)
          }
        }
        // Save current version as last shown
        await api.updater.setLastShownVersion(version)
      } catch {
        // Silently ignore — don't block app startup
      }
    }
    checkChangelog()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  // Show setup wizard if not configured
  if (!isSetupComplete) {
    return <SetupWizard />
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Changelog Dialog — shown after an update */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              What's New in v{currentVersion}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 text-sm space-y-2 whitespace-pre-wrap">
            {formatChangelog(changelog, currentVersion)}
          </div>
          <div className="pt-3 flex justify-end">
            <Button onClick={() => setShowChangelog(false)}>Got it!</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Extract only the current version's section from the full changelog */
function formatChangelog(raw: string, version: string): string {
  const lines = raw.split('\n')
  const versionHeader = `## [${version}]`
  let capturing = false
  const result: string[] = []

  for (const line of lines) {
    if (line.startsWith(versionHeader)) {
      capturing = true
      continue // skip the header line itself
    }
    if (capturing && line.startsWith('## [')) {
      break // hit the next version section
    }
    if (capturing) {
      result.push(line)
    }
  }

  return result.join('\n').trim() || raw
}
