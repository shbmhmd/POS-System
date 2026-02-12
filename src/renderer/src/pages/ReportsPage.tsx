import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart3, Loader2, Download, Calendar, TrendingUp, DollarSign, PieChart } from 'lucide-react'

type ReportType = 'daily-sales' | 'by-product' | 'by-category' | 'payment' | 'profit' | 'tax' | 'cashier'

const REPORT_CSV_COLUMNS: Record<ReportType, { headers: string[]; fields: string[] }> = {
  'daily-sales': { headers: ['Date', 'Transactions', 'Revenue'], fields: ['date', 'total_transactions', 'total_sales'] },
  'by-product': { headers: ['Product', 'Qty Sold', 'Revenue'], fields: ['product_name', 'qty_sold', 'revenue'] },
  'by-category': { headers: ['Category', 'Qty Sold', 'Revenue'], fields: ['category_name', 'qty_sold', 'revenue'] },
  payment: { headers: ['Method', 'Count', 'Amount'], fields: ['method', 'count', 'total'] },
  profit: { headers: ['Date', 'Revenue', 'Cost', 'Profit', 'Margin %'], fields: ['date', 'revenue', 'cost', 'profit', 'margin_pct'] },
  tax: { headers: ['Date', 'Taxable', 'Tax', 'Total'], fields: ['date', 'taxable_amount', 'tax_collected', 'total_with_tax'] },
  cashier: { headers: ['Cashier', 'Sales', 'Revenue', 'Avg Sale'], fields: ['cashier_name', 'sales_count', 'total_sales', 'avg_sale_value'] }
}

function exportCSV(reportType: ReportType, data: any[]) {
  if (!data || data.length === 0) return
  const { headers, fields } = REPORT_CSV_COLUMNS[reportType]
  const csvRows = [headers.join(',')]
  for (const row of data) {
    csvRows.push(
      fields
        .map((f) => {
          const val = row[f] ?? ''
          const str = String(val)
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
        })
        .join(',')
    )
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { currentBranch, business } = useAppStore()
  const currency = business?.currency || 'USD'

  const [reportType, setReportType] = useState<ReportType>('daily-sales')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1) // first of month
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadReport = async () => {
    if (!currentBranch) return
    setLoading(true)
    setData(null)

    try {
      let result: any

      switch (reportType) {
        case 'daily-sales':
          result = await window.api.reports.dailySales(currentBranch.id, dateFrom, dateTo)
          break
        case 'by-product':
          result = await window.api.reports.salesByProduct(currentBranch.id, dateFrom, dateTo)
          break
        case 'by-category':
          result = await window.api.reports.salesByCategory(currentBranch.id, dateFrom, dateTo)
          break
        case 'payment':
          result = await window.api.reports.paymentBreakdown(currentBranch.id, dateFrom, dateTo)
          break
        case 'profit':
          result = await window.api.reports.profit(currentBranch.id, dateFrom, dateTo)
          break
        case 'tax':
          result = await window.api.reports.taxSummary(currentBranch.id, dateFrom, dateTo)
          break
        case 'cashier':
          result = await window.api.reports.cashierPerformance(currentBranch.id, dateFrom, dateTo)
          break
      }

      if (result?.success) setData(result.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Load on params change
  useEffect(() => {
    loadReport()
  }, [reportType, dateFrom, dateTo, currentBranch])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Analyze your business performance</p>
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Report</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily-sales">Daily Sales</SelectItem>
              <SelectItem value="by-product">Sales by Product</SelectItem>
              <SelectItem value="by-category">Sales by Category</SelectItem>
              <SelectItem value="payment">Payment Breakdown</SelectItem>
              <SelectItem value="profit">Profit Report</SelectItem>
              <SelectItem value="tax">Tax Summary</SelectItem>
              <SelectItem value="cashier">Cashier Performance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={loadReport}>
          <BarChart3 className="h-4 w-4 mr-1" /> Refresh
        </Button>
        {data && Array.isArray(data) && data.length > 0 && (
          <Button variant="outline" onClick={() => exportCSV(reportType, data)}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {/* Report Content */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !data ? (
            <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No data available</p>
          ) : (
            <ScrollArea>
              {reportType === 'daily-sales' && <DailySalesReport data={data} currency={currency} />}
              {reportType === 'by-product' && <ProductSalesReport data={data} currency={currency} />}
              {reportType === 'by-category' && <CategoryReport data={data} currency={currency} />}
              {reportType === 'payment' && <PaymentReport data={data} currency={currency} />}
              {reportType === 'profit' && <ProfitReport data={data} currency={currency} />}
              {reportType === 'tax' && <TaxReport data={data} currency={currency} />}
              {reportType === 'cashier' && <CashierReport data={data} currency={currency} />}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DailySalesReport({ data, currency }: { data: any[]; currency: string }) {
  const totalRevenue = data.reduce((s, d) => s + (d.total_sales || 0), 0)
  const totalSales = data.reduce((s, d) => s + (d.total_transactions || 0), 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 p-4">
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--muted-foreground)]">Total Revenue</p><p className="text-xl font-bold">{formatCurrency(totalRevenue, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--muted-foreground)]">Total Sales</p><p className="text-xl font-bold">{totalSales}</p></CardContent></Card>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}><TableCell>{formatDate(row.date)}</TableCell><TableCell className="text-right">{row.total_transactions}</TableCell><TableCell className="text-right font-medium">{formatCurrency(row.total_sales, currency)}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProductSalesReport({ data, currency }: { data: any[]; currency: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}><TableCell>{row.product_name}</TableCell><TableCell className="text-right">{row.qty_sold}</TableCell><TableCell className="text-right font-medium">{formatCurrency(row.revenue, currency)}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CategoryReport({ data, currency }: { data: any[]; currency: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}><TableCell>{row.category_name || 'Uncategorized'}</TableCell><TableCell className="text-right">{row.qty_sold}</TableCell><TableCell className="text-right font-medium">{formatCurrency(row.revenue, currency)}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PaymentReport({ data, currency }: { data: any[]; currency: string }) {
  const total = data.reduce((s, d) => s + (d.total || 0), 0)
  return (
    <div>
      <div className="p-4">
        <p className="text-xs text-[var(--muted-foreground)]">Total Collected</p>
        <p className="text-2xl font-bold">{formatCurrency(total, currency)}</p>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="capitalize">{row.method}</TableCell>
              <TableCell className="text-right">{row.count}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(row.total, currency)}</TableCell>
              <TableCell className="text-right">{total ? ((row.total / total) * 100).toFixed(1) : 0}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProfitReport({ data, currency }: { data: any[]; currency: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}>
            <TableCell>{formatDate(row.date)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.revenue, currency)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.cost, currency)}</TableCell>
            <TableCell className={`text-right font-medium ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(row.profit, currency)}</TableCell>
            <TableCell className="text-right">{(row.margin_pct || 0).toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TaxReport({ data, currency }: { data: any[]; currency: string }) {
  const totalTaxable = Array.isArray(data) ? data.reduce((s, d) => s + (d.taxable_amount || 0), 0) : 0
  const totalTax = Array.isArray(data) ? data.reduce((s, d) => s + (d.tax_collected || 0), 0) : 0
  const totalWithTax = Array.isArray(data) ? data.reduce((s, d) => s + (d.total_with_tax || 0), 0) : 0
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--muted-foreground)]">Taxable Sales</p><p className="text-xl font-bold">{formatCurrency(totalTaxable, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--muted-foreground)]">Total Tax Collected</p><p className="text-xl font-bold">{formatCurrency(totalTax, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--muted-foreground)]">Total with Tax</p><p className="text-xl font-bold">{formatCurrency(totalWithTax, currency)}</p></CardContent></Card>
      </div>
      {Array.isArray(data) && data.length > 0 && (
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.taxable_amount, currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.tax_collected, currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.total_with_tax, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function CashierReport({ data, currency }: { data: any[]; currency: string }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Avg Sale</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}>
            <TableCell>{row.cashier_name}</TableCell>
            <TableCell className="text-right">{row.sales_count}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(row.total_sales, currency)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.avg_sale_value, currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
