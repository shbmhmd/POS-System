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
import CustomersPage from '@/pages/CustomersPage'
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
          <Route path="customers" element={<CustomersPage />} />
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
          <div className="flex-1 overflow-y-auto pr-2">
            <ChangelogContent raw={changelog} version={currentVersion} />
          </div>
          <div className="pt-3 flex justify-end">
            <Button onClick={() => setShowChangelog(false)}>Got it!</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Extract only the current version's section and render as styled JSX */
function ChangelogContent({ raw, version }: { raw: string; version: string }) {
  const lines = raw.split('\n')
  const versionHeader = `## [${version}]`
  let capturing = false
  const result: string[] = []

  for (const line of lines) {
    if (line.startsWith(versionHeader)) {
      capturing = true
      continue
    }
    if (capturing && line.startsWith('## [')) break
    if (capturing) result.push(line)
  }

  const content = result.join('\n').trim() || raw

  // Parse markdown into structured sections
  const sections: { title: string; items: string[] }[] = []
  let currentSection: { title: string; items: string[] } | null = null

  for (const line of content.split('\n')) {
    const sectionMatch = line.match(/^###\s+(.+)/)
    if (sectionMatch) {
      currentSection = { title: sectionMatch[1], items: [] }
      sections.push(currentSection)
      continue
    }
    const itemMatch = line.match(/^-\s+(.+)/)
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1])
    }
  }

  if (sections.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">{content}</p>
  }

  const sectionIcon: Record<string, string> = {
    Added: '✨',
    Changed: '🔄',
    Fixed: '🐛',
    Removed: '🗑️',
    Security: '🔒',
    Deprecated: '⚠️'
  }

  const sectionColor: Record<string, string> = {
    Added: 'text-green-500',
    Changed: 'text-blue-500',
    Fixed: 'text-orange-500',
    Removed: 'text-red-500',
    Security: 'text-purple-500',
    Deprecated: 'text-yellow-500'
  }

  // Render inline bold **text**
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/)
      if (boldMatch) {
        return <strong key={i} className="font-semibold text-[var(--foreground)]">{boldMatch[1]}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={si}>
          <div className={`flex items-center gap-2 text-sm font-semibold mb-2 ${sectionColor[section.title] || 'text-[var(--foreground)]'}`}>
            <span>{sectionIcon[section.title] || '📋'}</span>
            <span>{section.title}</span>
          </div>
          <ul className="space-y-1.5 ml-1">
            {section.items.map((item, ii) => (
              <li key={ii} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
                <span>{renderText(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
