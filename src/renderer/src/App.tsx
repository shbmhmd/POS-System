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
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const { isSetupComplete, checkSetupStatus } = useAppStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    checkSetupStatus().finally(() => setLoading(false))
  }, [checkSetupStatus])

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
  )
}
