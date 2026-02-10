import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Clock, PlayCircle, StopCircle, Loader2, Banknote, Eye
} from 'lucide-react'
import type { Shift } from '@/types'

export default function ShiftsPage() {
  const { currentBranch, currentShift, setCurrentShift, business } = useAppStore()
  const { user } = useAuthStore()
  const currency = business?.currency || 'USD'

  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any>(null)

  // Open shift
  const [opening, setOpening] = useState(false)
  const [lastClosingCash, setLastClosingCash] = useState<number | null>(null)

  // Close shift form
  const [closing, setClosing] = useState(false)
  const [closeReport, setCloseReport] = useState<any>(null)

  useEffect(() => {
    loadShifts()
    loadCurrentShift()
  }, [currentBranch])

  const loadShifts = async () => {
    if (!currentBranch) return
    setLoading(true)
    try {
      const result = await window.api.shifts.list({ branch_id: currentBranch.id, limit: 50 })
      if (result.success) setShifts(result.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentShift = async () => {
    if (!currentBranch || !user) return
    const result = await window.api.shifts.getCurrent(user.id, currentBranch.id)
    if (result.success && result.data) {
      setCurrentShift(result.data)
    }
  }

  const handleOpenShift = async () => {
    if (!currentBranch || !user) return
    setOpening(true)
    try {
      const result = await window.api.shifts.open({
        branch_id: currentBranch.id,
        user_id: user.id
      })
      if (result.success) {
        await loadCurrentShift()
        setShowOpen(false)
        loadShifts()
      } else {
        alert(result.error || 'Failed to open shift')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setOpening(false)
    }
  }

  const handleCloseShift = async () => {
    if (!currentShift) return
    setClosing(true)
    try {
      const result = await window.api.shifts.close(currentShift.id)
      if (result.success) {
        setCurrentShift(null)
        setShowClose(false)
        loadShifts()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setClosing(false)
    }
  }

  const viewReport = async (shiftId: number) => {
    const result = await window.api.shifts.getReport(shiftId)
    if (result.success) {
      setSelectedShift(result.data)
      setShowReport(true)
    }
  }

  const prepareClose = async () => {
    if (!currentShift) return
    // Pre-fetch report data
    const result = await window.api.shifts.getReport(currentShift.id)
    if (result.success) setCloseReport(result.data)
    setShowClose(true)
  }

  const prepareOpen = async () => {
    // Get last closed shift's closing cash to show as opening amount
    if (!currentBranch) return
    const result = await window.api.shifts.list({ branch_id: currentBranch.id, status: 'closed', limit: 1 })
    if (result.success && result.data?.length > 0) {
      setLastClosingCash(result.data[0].closing_cash ?? 0)
    } else {
      setLastClosingCash(0)
    }
    setShowOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shifts</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Manage cash register shifts</p>
        </div>
        <div className="flex gap-2">
          {currentShift ? (
            <Button variant="destructive" onClick={prepareClose}>
              <StopCircle className="h-4 w-4 mr-1" /> Close Shift
            </Button>
          ) : (
            <Button onClick={prepareOpen}>
              <PlayCircle className="h-4 w-4 mr-1" /> Open Shift
            </Button>
          )}
        </div>
      </div>

      {/* Active Shift Card */}
      {currentShift && (
        <Card className="border-[var(--primary)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" /> Active Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Started:</span>
                <p className="font-medium">{formatDateTime(currentShift.opened_at)}</p>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Opening Cash:</span>
                <p className="font-medium">{formatCurrency(currentShift.opening_cash, currency)}</p>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Sales:</span>
                <p className="font-medium">{(currentShift as any).total_transactions || 0} ({formatCurrency(currentShift.total_sales || 0, currency)})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shifts History */}
      <Card>
        <CardHeader>
          <CardTitle>Shift History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shifts.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No shifts recorded</p>
          ) : (
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opened</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="text-xs">{formatDateTime(shift.opened_at)}</TableCell>
                      <TableCell className="text-xs">{shift.closed_at ? formatDateTime(shift.closed_at) : '—'}</TableCell>
                      <TableCell>{(shift as any).user_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(shift.opening_cash, currency)}</TableCell>
                      <TableCell className="text-right">{(shift as any).total_transactions || 0}</TableCell>
                      <TableCell className="text-right">{formatCurrency(shift.total_sales || 0, currency)}</TableCell>
                      <TableCell>
                        <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                          {shift.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewReport(shift.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Open Shift Dialog */}
      <Dialog open={showOpen} onOpenChange={() => setShowOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Opening Cash (auto):</span>
                <strong>{formatCurrency(lastClosingCash ?? 0, currency)}</strong>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Based on the last closed shift's closing cash.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpen(false)}>Cancel</Button>
            <Button onClick={handleOpenShift} disabled={opening}>
              {opening && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Open Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showClose} onOpenChange={() => setShowClose(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {closeReport && (() => {
              const cashTotal = (closeReport.payment_breakdown || []).find((p: any) => p.method === 'cash')?.total || 0
              const cardTotal = (closeReport.payment_breakdown || []).find((p: any) => p.method === 'card')?.total || 0
              const refunds = currentShift?.total_refunds || 0
              const expectedCash = (currentShift?.opening_cash || 0) + cashTotal - refunds
              return (
              <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Opening Cash:</span><strong>{formatCurrency(currentShift?.opening_cash || 0, currency)}</strong></div>
                <div className="flex justify-between"><span>Total Sales:</span><strong>{closeReport.total_sales || 0}</strong></div>
                <div className="flex justify-between"><span>Cash Sales:</span><strong>{formatCurrency(cashTotal, currency)}</strong></div>
                <div className="flex justify-between"><span>Card Sales:</span><strong>{formatCurrency(cardTotal, currency)}</strong></div>
                {refunds > 0 && (
                  <div className="flex justify-between text-[var(--destructive)]"><span>Refunds:</span><strong>-{formatCurrency(refunds, currency)}</strong></div>
                )}
                <hr className="border-[var(--border)]" />
                <div className="flex justify-between text-base font-bold">
                  <span>Closing Cash (auto):</span>
                  <span>{formatCurrency(expectedCash, currency)}</span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Automatically calculated from opening cash + cash sales − refunds.
                </p>
              </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClose(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCloseShift} disabled={closing}>
              {closing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Close Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Report Dialog */}
      <Dialog open={showReport} onOpenChange={() => setShowReport(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shift Report</DialogTitle>
          </DialogHeader>
          {selectedShift && (() => {
            const cashTotal = (selectedShift.payment_breakdown || []).find((p: any) => p.method === 'cash')?.total || 0
            const cardTotal = (selectedShift.payment_breakdown || []).find((p: any) => p.method === 'card')?.total || 0
            const mobileTotal = (selectedShift.payment_breakdown || []).find((p: any) => p.method === 'mobile')?.total || 0
            const totalRevenue = (selectedShift.payment_breakdown || []).reduce((s: number, p: any) => s + (p.total || 0), 0)
            return (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2">
                <div className="flex justify-between"><span>Total Sales:</span><strong>{selectedShift.total_sales || 0}</strong></div>
                <div className="flex justify-between"><span>Revenue:</span><strong>{formatCurrency(totalRevenue, currency)}</strong></div>
                <div className="flex justify-between"><span>Cash:</span><strong>{formatCurrency(cashTotal, currency)}</strong></div>
                <div className="flex justify-between"><span>Card:</span><strong>{formatCurrency(cardTotal, currency)}</strong></div>
                <div className="flex justify-between"><span>Mobile:</span><strong>{formatCurrency(mobileTotal, currency)}</strong></div>
              </div>
              {selectedShift.top_products?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Top Products</h4>
                  {selectedShift.top_products.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{p.product_name}</span>
                      <span>×{p.qty_sold}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
