import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Search, Loader2, Package, ArrowRightLeft, BarChart3,
  AlertTriangle, Plus, Minus
} from 'lucide-react'
import type { StockItem, StockMove, Category } from '@/types'

export default function InventoryPage() {
  const { currentBranch, business, branches } = useAppStore()
  const { user } = useAuthStore()
  const currency = business?.currency || 'USD'

  const [tab, setTab] = useState('stock')
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  // Dialogs
  const [showAdjust, setShowAdjust] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null)
  const [stockHistory, setStockHistory] = useState<StockMove[]>([])

  // Adjust form
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<'set' | 'add' | 'subtract'>('set')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // Transfer form
  const [transferQty, setTransferQty] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    window.api.categories.list().then((r: any) => {
      if (r.success) setCategories(r.data || [])
    })
  }, [])

  useEffect(() => {
    loadStock()
  }, [currentBranch, search, filterCategory, showLowOnly])

  const loadStock = async () => {
    if (!currentBranch) return
    setLoading(true)
    try {
      const result = await window.api.inventory.getStock(currentBranch.id, {
        search: search || undefined,
        category_id: filterCategory ? Number(filterCategory) : undefined,
        low_stock_only: showLowOnly
      })
      if (result.success) setStock(result.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openAdjust = (item: StockItem) => {
    setSelectedProduct(item)
    setAdjustQty(String(item.quantity))
    setAdjustType('set')
    setAdjustReason('')
    setShowAdjust(true)
  }

  const openTransfer = (item: StockItem) => {
    setSelectedProduct(item)
    setTransferQty('1')
    setTransferTo('')
    setShowTransfer(true)
  }

  const openHistory = async (item: StockItem) => {
    setSelectedProduct(item)
    setShowHistory(true)
    const result = await window.api.inventory.getStockHistory(
      item.product_id,
      currentBranch!.id,
      50
    )
    if (result.success) setStockHistory(result.data || [])
  }

  const handleAdjust = async () => {
    if (!selectedProduct || !currentBranch || !user) return
    setAdjusting(true)
    try {
      const qty = parseInt(adjustQty) || 0
      let delta: number
      if (adjustType === 'set') delta = qty - selectedProduct.quantity
      else if (adjustType === 'add') delta = qty
      else delta = -qty

      const result = await window.api.inventory.adjust({
        product_id: selectedProduct.product_id,
        branch_id: currentBranch.id,
        quantity: delta,
        notes: adjustReason || 'Manual adjustment',
        user_id: user.id
      })

      if (result.success) {
        setShowAdjust(false)
        loadStock()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAdjusting(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedProduct || !currentBranch || !transferTo || !user) return
    setTransferring(true)
    try {
      const result = await window.api.inventory.transfer({
        product_id: selectedProduct.product_id,
        from_branch_id: currentBranch.id,
        to_branch_id: Number(transferTo),
        quantity: parseInt(transferQty) || 0,
        notes: 'Stock transfer',
        user_id: user.id
      })

      if (result.success) {
        setShowTransfer(false)
        loadStock()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTransferring(false)
    }
  }

  const otherBranches = branches.filter((b) => b.id !== currentBranch?.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Stock levels for {currentBranch?.name}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showLowOnly ? 'default' : 'outline'}
          onClick={() => setShowLowOnly(!showLowOnly)}
        >
          <AlertTriangle className="h-4 w-4 mr-1" /> Low Stock
        </Button>
      </div>

      {/* Stock Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : stock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package className="h-12 w-12 text-[var(--muted-foreground)] opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">No stock records found</p>
            </div>
          ) : (
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.barcode || '—'}</TableCell>
                      <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.min_stock}</TableCell>
                      <TableCell>
                        {item.quantity <= 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : item.quantity <= item.min_stock ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openAdjust(item)} title="Adjust">
                            <Plus className="h-4 w-4" />
                          </Button>
                          {otherBranches.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => openTransfer(item)} title="Transfer">
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openHistory(item)} title="History">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Adjust Dialog */}
      <Dialog open={showAdjust} onOpenChange={() => setShowAdjust(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Current stock: <strong>{selectedProduct?.quantity}</strong></p>
            <div className="flex gap-2">
              <Button size="sm" variant={adjustType === 'set' ? 'default' : 'outline'} onClick={() => setAdjustType('set')}>Set to</Button>
              <Button size="sm" variant={adjustType === 'add' ? 'default' : 'outline'} onClick={() => setAdjustType('add')}>Add</Button>
              <Button size="sm" variant={adjustType === 'subtract' ? 'default' : 'outline'} onClick={() => setAdjustType('subtract')}>Subtract</Button>
            </div>
            <Input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              min={0}
              autoFocus
            />
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g., Damaged, Recount" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjusting}>
              {adjusting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adjust
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={() => setShowTransfer(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer Stock — {selectedProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Available: <strong>{selectedProduct?.quantity}</strong></p>
            <div className="space-y-2">
              <Label>Transfer to</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {otherBranches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                min={1}
                max={selectedProduct?.quantity}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={transferring || !transferTo}>
              {transferring && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={() => setShowHistory(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock History — {selectedProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {stockHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">No history</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockHistory.map((move) => (
                    <TableRow key={move.id}>
                      <TableCell className="text-xs">{formatDateTime(move.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          move.type === 'SALE' ? 'destructive' :
                          move.type === 'PURCHASE' || move.type === 'TRANSFER_IN' ? 'default' :
                          'outline'
                        } className="text-xs">
                          {move.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${move.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {move.quantity > 0 ? '+' : ''}{move.quantity}
                      </TableCell>
                      <TableCell className="text-xs">{move.reference_id || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
