import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  AlertTriangle, Clock, Loader2
} from 'lucide-react'

interface DashboardData {
  today_sales: { count: number; total: number }
  low_stock_count: number
  total_products: number
  recent_sales: Array<{
    id: number
    invoice_number: string
    total: number
    status: string
    created_at: string
    cashier_name?: string
  }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { currentBranch, business } = useAppStore()
  const currency = business?.currency || 'USD'

  useEffect(() => {
    loadDashboard()
  }, [currentBranch])

  const loadDashboard = async () => {
    if (!currentBranch) return
    setLoading(true)
    try {
      const result = await window.api.reports.dashboard(currentBranch.id)
      if (result.success) {
        setData(result.data)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Overview for {currentBranch?.name || 'your branch'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.today_sales?.total || 0, currency)}</div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {data?.today_sales?.count || 0} sales today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.total_products || 0}</div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Active in catalog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales Count</CardTitle>
            <ShoppingCart className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.today_sales?.count || 0}</div>
            <p className="text-xs text-[var(--muted-foreground)]">Completed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.low_stock_count || 0) > 0 ? 'text-amber-600' : ''}`}>
              {data?.low_stock_count || 0}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Below minimum level</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recent_sales?.length ? (
            <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">
              No sales yet today. Start selling!
            </p>
          ) : (
            <div className="space-y-2">
              {data.recent_sales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                  <div>
                    <p className="text-sm font-medium">{sale.invoice_number}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {new Date(sale.created_at).toLocaleTimeString()}
                      {(sale as any).cashier_name && ` • ${(sale as any).cashier_name}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {formatCurrency(sale.total, currency)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LowStockList branchId={currentBranch?.id} currency={currency} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LowStockList({ branchId, currency }: { branchId?: number; currency: string }) {
  const [items, setItems] = useState<Array<{ name: string; quantity: number; low_stock_threshold: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    window.api.inventory
      .getLowStock(branchId)
      .then((r: any) => {
        if (r.success) setItems(r.data?.slice(0, 10) || [])
      })
      .finally(() => setLoading(false))
  }, [branchId])

  if (loading) return <Loader2 className="h-5 w-5 animate-spin mx-auto" />

  if (!items.length) {
    return <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">All stock levels are healthy</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span>{item.name}</span>
          <Badge variant={item.quantity <= 0 ? 'destructive' : 'outline'}>
            {item.quantity} / {item.low_stock_threshold}
          </Badge>
        </div>
      ))}
    </div>
  )
}
