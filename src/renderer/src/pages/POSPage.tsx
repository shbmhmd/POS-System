import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import {
  Search, ShoppingCart, Trash2, Plus, Minus, DollarSign,
  CreditCard, Banknote, Smartphone, Percent, Pause, Loader2,
  X, Barcode
} from 'lucide-react'
import type { Product, PaymentMethod } from '@/types'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
  { value: 'other', label: 'Other', icon: DollarSign }
]

export default function POSPage() {
  const { user, hasPermission } = useAuthStore()
  const { currentBranch, currentShift, business } = useAppStore()
  const cart = useCartStore()
  const currency = business?.currency || 'USD'

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Barcode scanner handler (rapid key input detection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && target !== searchRef.current) return

      // Keyboard shortcuts
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); return }
      if (e.key === 'F2') { e.preventDefault(); setShowPayment(true); return }
      if (e.key === 'F3') { e.preventDefault(); setShowHeld(true); return }
      if (e.key === 'F4') { e.preventDefault(); setShowDiscount(true); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowPayment(false); setShowHeld(false); setShowDiscount(false); return }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search products
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !currentBranch) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      // Try barcode exact match first
      const barcodeResult = await window.api.products.getByBarcode(query.trim())
      if (barcodeResult.success && barcodeResult.data) {
        cart.addProduct(barcodeResult.data, business?.tax_mode || 'exclusive')
        setSearchQuery('')
        setSearchResults([])
        searchRef.current?.focus()
        return
      }

      // Fuzzy search
      const result = await window.api.products.search(query.trim(), 20)
      if (result.success) {
        setSearchResults(result.data || [])
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }, [currentBranch, cart])

  const addToCart = (product: Product) => {
    cart.addProduct(product, business?.tax_mode || 'exclusive')
    setSearchQuery('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  // No shift warning
  if (!currentShift) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <ShoppingCart className="h-16 w-16 text-[var(--muted-foreground)]" />
        <h2 className="text-xl font-semibold">No Active Shift</h2>
        <p className="text-[var(--muted-foreground)]">
          You need to open a shift before making sales. Go to the Shifts page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Left: Product Search + Results */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Scan barcode or search products... (F1)"
            className="pl-10 h-12 text-lg"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Card className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="grid grid-cols-2 gap-2 p-4 lg:grid-cols-3 xl:grid-cols-4">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-[var(--border)] p-3 text-left hover:bg-[var(--accent)] transition-colors"
                  >
                    <span className="text-sm font-medium line-clamp-2">{product.name}</span>
                    {product.barcode && (
                      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                        <Barcode className="h-3 w-3" /> {product.barcode}
                      </span>
                    )}
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-bold text-[var(--primary)]">
                        {formatCurrency(product.selling_price, currency)}
                      </span>
                      <Badge variant={
                        (product as any).stock_on_hand <= 0 ? 'destructive' :
                        (product as any).stock_on_hand <= (product.min_stock || 0) ? 'outline' : 'secondary'
                      } className="text-xs">
                        {(product as any).stock_on_hand ?? '—'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Empty State */}
        {searchResults.length === 0 && !searchQuery && (
          <div className="flex flex-1 items-center justify-center text-[var(--muted-foreground)]">
            <div className="text-center space-y-2">
              <Barcode className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-sm">Scan a barcode or type to search</p>
              <div className="flex gap-2 justify-center text-xs">
                <kbd className="px-2 py-1 rounded bg-[var(--muted)] border">F1</kbd> Search
                <kbd className="px-2 py-1 rounded bg-[var(--muted)] border">F2</kbd> Pay
                <kbd className="px-2 py-1 rounded bg-[var(--muted)] border">F3</kbd> Held
                <kbd className="px-2 py-1 rounded bg-[var(--muted)] border">F4</kbd> Discount
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="flex w-96 flex-col border-l border-[var(--border)] pl-4">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {cart.getItemCount() > 0 && (
              <Badge variant="secondary">{cart.getItemCount()}</Badge>
            )}
          </h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowHeld(true)} title="Held Sales (F3)">
              <Pause className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => cart.clearCart()} disabled={cart.items.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1">
          {cart.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">Cart is empty</p>
          ) : (
            <div className="space-y-2 pr-2">
              {cart.items.map((item) => (
                <div key={item.product_id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {formatCurrency(item.unit_price, currency)} × {item.quantity}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cart.removeItem(item.id)} className="h-6 w-6 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                        onClick={() => cart.updateQuantity(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => cart.setQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="h-7 w-14 text-center text-sm"
                        min={1}
                      />
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                        onClick={() => cart.updateQuantity(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.total, currency)}
                    </span>
                  </div>

                  {item.discount_amount > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Discount: -{formatCurrency(item.discount_amount, currency)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Totals */}
        <Separator className="my-3" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(cart.getSubtotal(), currency)}</span>
          </div>
          {cart.getDiscountAmount() > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(cart.getDiscountAmount(), currency)}</span>
            </div>
          )}
          {cart.getTaxAmount() > 0 && (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatCurrency(cart.getTaxAmount(), currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>Total</span>
            <span>{formatCurrency(cart.getTotal(), currency)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            disabled={cart.items.length === 0}
            onClick={() => setShowDiscount(true)}
          >
            <Percent className="h-4 w-4 mr-1" /> Discount
          </Button>
          <Button
            className="flex-1"
            disabled={cart.items.length === 0}
            onClick={() => setShowPayment(true)}
          >
            <DollarSign className="h-4 w-4 mr-1" /> Pay (F2)
          </Button>
        </div>

        {/* Hold Sale */}
        <Button
          variant="ghost"
          className="mt-2"
          disabled={cart.items.length === 0}
          onClick={async () => {
            if (!currentBranch || !user) return
            const result = await window.api.sales.hold({
              branch_id: currentBranch.id,
              user_id: user.id,
              cart_json: JSON.stringify(cart.items),
              note: `Hold ${new Date().toLocaleTimeString()}`
            })
            if (result.success) cart.clearCart()
          }}
        >
          <Pause className="h-4 w-4 mr-1" /> Hold Sale (F3)
        </Button>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPayment}
        onClose={() => setShowPayment(false)}
        currency={currency}
      />

      {/* Bill Discount Dialog */}
      <BillDiscountDialog
        open={showDiscount}
        onClose={() => setShowDiscount(false)}
        currency={currency}
      />

      {/* Held Sales Dialog */}
      <HeldSalesDialog
        open={showHeld}
        onClose={() => setShowHeld(false)}
      />
    </div>
  )
}

/* ───── Payment Dialog ───── */
function PaymentDialog({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: string }) {
  const cart = useCartStore()
  const { user } = useAuthStore()
  const { currentBranch, currentShift } = useAppStore()

  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: number }[]>([
    { method: 'cash', amount: 0 }
  ])
  const [customerName, setCustomerName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const total = cart.getTotal()
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const change = Math.max(0, totalPaid - total)
  const remaining = Math.max(0, total - totalPaid)

  // Reset on open
  useEffect(() => {
    if (open) {
      setPayments([{ method: 'cash', amount: total }])
      setCustomerName('')
      setError('')
    }
  }, [open, total])

  const handlePayment = async () => {
    if (remaining > 0) {
      setError('Payment amount is less than total')
      return
    }
    if (!currentBranch || !user || !currentShift) return

    setProcessing(true)
    setError('')

    try {
      const result = await window.api.sales.create({
        branch_id: currentBranch.id,
        user_id: user.id,
        shift_id: currentShift.id,
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          barcode: item.barcode || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          discount_amount: item.discount_amount || 0,
          discount_type: item.discount_type || 'fixed',
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0,
          total: item.total
        })),
        payments: payments.filter((p) => p.amount > 0),
        customer_name: customerName.trim() || undefined,
        subtotal: cart.getSubtotal(),
        discount_amount: cart.getDiscountAmount() || 0,
        discount_type: cart.billDiscountType || 'fixed',
        tax_amount: cart.getTaxAmount() || 0,
        total: cart.getTotal()
      })

      if (result.success) {
        cart.clearCart()
        onClose()
        // TODO: Print receipt
      } else {
        setError(result.error || 'Failed to complete sale')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--muted)] p-4 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Total Due</p>
            <p className="text-3xl font-bold">{formatCurrency(total, currency)}</p>
          </div>

          {/* Customer Name */}
          <div className="space-y-1">
            <Label className="text-xs">Customer Name (optional)</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in" />
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            {payments.map((payment, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex gap-1">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon
                    return (
                      <Button
                        key={m.value}
                        variant={payment.method === m.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const updated = [...payments]
                          updated[idx].method = m.value
                          setPayments(updated)
                        }}
                      >
                        <Icon className="h-3 w-3 mr-1" /> {m.label}
                      </Button>
                    )
                  })}
                </div>
                <Input
                  type="number"
                  value={payment.amount || ''}
                  onChange={(e) => {
                    const updated = [...payments]
                    updated[idx].amount = parseFloat(e.target.value) || 0
                    setPayments(updated)
                  }}
                  className="w-28"
                  min={0}
                  step={0.01}
                />
                {payments.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setPayments(payments.filter((_, i) => i !== idx))}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="ghost" size="sm" onClick={() => setPayments([...payments, { method: 'cash', amount: remaining }])}>
              + Split Payment
            </Button>
          </div>

          {/* Change / Remaining */}
          <div className="flex justify-between text-sm">
            {remaining > 0 ? (
              <><span className="text-[var(--destructive)]">Remaining:</span><span className="font-bold text-[var(--destructive)]">{formatCurrency(remaining, currency)}</span></>
            ) : (
              <><span>Change:</span><span className="font-bold text-green-600">{formatCurrency(change, currency)}</span></>
            )}
          </div>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePayment} disabled={processing || remaining > 0}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Complete Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───── Bill Discount Dialog ───── */
function BillDiscountDialog({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: string }) {
  const cart = useCartStore()
  const { getMaxDiscount } = useAuthStore()
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [discountValue, setDiscountValue] = useState(0)

  const maxDiscount = getMaxDiscount()
  const subtotal = cart.getSubtotal()

  const apply = () => {
    let amount = discountValue
    if (discountType === 'percent') {
      amount = (subtotal * discountValue) / 100
    }
    // Enforce max discount
    if (maxDiscount > 0) {
      const maxAmount = (subtotal * maxDiscount) / 100
      amount = Math.min(amount, maxAmount)
    }
    cart.setBillDiscount(amount, 'fixed')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bill Discount</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={discountType === 'percent' ? 'default' : 'outline'} onClick={() => setDiscountType('percent')} className="flex-1">
              <Percent className="h-4 w-4 mr-1" /> Percentage
            </Button>
            <Button variant={discountType === 'amount' ? 'default' : 'outline'} onClick={() => setDiscountType('amount')} className="flex-1">
              <DollarSign className="h-4 w-4 mr-1" /> Amount
            </Button>
          </div>
          <Input
            type="number"
            value={discountValue || ''}
            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
            placeholder={discountType === 'percent' ? 'Enter %' : 'Enter amount'}
            min={0}
            max={discountType === 'percent' ? 100 : subtotal}
            autoFocus
          />
          {maxDiscount > 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">Max allowed: {maxDiscount}%</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { cart.setBillDiscount(0, 'fixed'); onClose() }}>Clear</Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───── Held Sales Dialog ───── */
function HeldSalesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [heldSales, setHeldSales] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const cart = useCartStore()
  const { currentBranch } = useAppStore()

  useEffect(() => {
    if (open && currentBranch) {
      setLoading(true)
      window.api.sales
        .getHeld(currentBranch.id)
        .then((r: any) => {
          if (r.success) setHeldSales(r.data || [])
        })
        .finally(() => setLoading(false))
    }
  }, [open, currentBranch])

  const loadHeld = (sale: any) => {
    try {
      const items = JSON.parse(sale.cart_json)
      cart.loadCart(items, 0, 'fixed')
      // Delete held sale
      window.api.sales.deleteHeld(sale.id)
      onClose()
    } catch (err) {
      console.error('Failed to load held sale:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Held Sales</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : heldSales.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">No held sales</p>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {heldSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{sale.note || 'Held Sale'}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {new Date(sale.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => loadHeld(sale)}>Load</Button>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await window.api.sales.deleteHeld(sale.id)
                      setHeldSales(heldSales.filter((s) => s.id !== sale.id))
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
