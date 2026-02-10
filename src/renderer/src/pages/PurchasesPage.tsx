import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Plus, Search, Loader2, Truck, Eye, CheckCircle, XCircle, Package
} from 'lucide-react'
import type { Supplier, PurchaseInvoice } from '@/types'

export default function PurchasesPage() {
  const { currentBranch, business } = useAppStore()
  const { user } = useAuthStore()
  const currency = business?.currency || 'USD'

  const [tab, setTab] = useState('purchases')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Manage suppliers and purchase orders</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="purchases">Purchase Orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <PurchasesList branchId={currentBranch?.id} currency={currency} />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ───── Purchases List ───── */
function PurchasesList({ branchId, currency }: { branchId?: number; currency: string }) {
  const { user } = useAuthStore()
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    loadPurchases()
  }, [branchId])

  const loadPurchases = async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const result = await window.api.purchases.list({ branch_id: branchId })
      if (result.success) setPurchases(result.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const viewDetail = async (id: number) => {
    const result = await window.api.purchases.get(id)
    if (result.success) {
      setSelected(result.data)
      setShowDetail(true)
    }
  }

  const receivePurchase = async (id: number) => {
    if (!confirm('Mark this purchase as received? Stock will be updated.')) return
    const result = await window.api.purchases.receive(id, user!.id)
    if (result.success) loadPurchases()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Purchase
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Truck className="h-12 w-12 text-[var(--muted-foreground)] opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">No purchase orders yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.invoice_number}</TableCell>
                    <TableCell>{(p as any).supplier_name || '—'}</TableCell>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.total, currency)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        p.status === 'received' ? 'default' :
                        p.status === 'cancelled' ? 'destructive' : 'outline'
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => viewDetail(p.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {p.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => receivePurchase(p.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Purchase Dialog */}
      <NewPurchaseDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        branchId={branchId!}
        currency={currency}
        onCreated={loadPurchases}
      />

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={() => setShowDetail(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase: {selected?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[var(--muted-foreground)]">Status:</span> <Badge>{selected.status}</Badge></div>
                <div><span className="text-[var(--muted-foreground)]">Total:</span> <strong>{formatCurrency(selected.total, currency)}</strong></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selected.items || []).map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cost_price, currency)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.quantity * item.cost_price, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ───── New Purchase Dialog ───── */
function NewPurchaseDialog({ open, onClose, branchId, currency, onCreated }: {
  open: boolean; onClose: () => void; branchId: number; currency: string; onCreated: () => void
}) {
  const { user } = useAuthStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: number; cost_price: number }[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      window.api.suppliers.list().then((r: any) => {
        if (r.success) setSuppliers(r.data || [])
      })
      setSupplierId('')
      setInvoiceNumber('')
      setItems([])
    }
  }, [open])

  const searchProducts = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setProducts([]); return }
    const result = await window.api.products.search(q.trim(), 20)
    if (result.success) setProducts(result.data || [])
  }

  const addItem = (product: any) => {
    const existing = items.find((i) => i.product_id === product.id)
    if (existing) {
      setItems(items.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        cost_price: product.cost_price || 0
      }])
    }
    setSearchQuery('')
    setProducts([])
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.cost_price, 0)

  const handleSave = async () => {
    if (!supplierId || items.length === 0) return
    setSaving(true)
    try {
      const result = await window.api.purchases.create({
        supplier_id: Number(supplierId),
        branch_id: branchId,
        user_id: user!.id,
        invoice_number: invoiceNumber.trim() || undefined,
        items: items.map(({ product_id, quantity, cost_price }) => ({ product_id: Number(product_id), quantity, unit_cost: cost_price })),
        total
      })
      if (result.success) {
        onCreated()
        onClose()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Invoice # (optional)</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add Products</Label>
            <Input value={searchQuery} onChange={(e) => searchProducts(e.target.value)} placeholder="Search product..." />
            {products.length > 0 && (
              <div className="rounded border max-h-32 overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="w-full text-left px-3 py-2 hover:bg-[var(--muted)] text-sm">
                    {p.name} — {formatCurrency(p.cost_price || 0, currency)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Cost</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.product_id}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell>
                      <Input type="number" value={item.quantity} onChange={(e) => {
                        const updated = [...items]; updated[idx].quantity = parseInt(e.target.value) || 1; setItems(updated)
                      }} min={1} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={item.cost_price} onChange={(e) => {
                        const updated = [...items]; updated[idx].cost_price = parseFloat(e.target.value) || 0; setItems(updated)
                      }} min={0} step={0.01} className="h-8" />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.quantity * item.cost_price, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="text-right font-bold">Total: {formatCurrency(total, currency)}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !supplierId || items.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───── Suppliers List ───── */
function SuppliersList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const result = await window.api.suppliers.list()
      if (result.success) setSuppliers(result.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ name: '', phone: '', email: '', address: '' })
    setShowForm(true)
  }

  const openEdit = (s: Supplier) => {
    setEditingId(s.id)
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined
      }
      const result = editingId
        ? await window.api.suppliers.update(editingId, data)
        : await window.api.suppliers.create(data)

      if (result.success) {
        setShowForm(false)
        loadSuppliers()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : suppliers.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">No suppliers</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
