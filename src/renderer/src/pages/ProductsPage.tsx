import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Edit, Trash2, Loader2, Package, Barcode } from 'lucide-react'
import type { Product, Category } from '@/types'

interface ProductForm {
  name: string
  barcode: string
  sku: string
  category_id: string
  cost_price: string
  selling_price: string
  tax_percent: string
  unit: string
  min_stock: string
  is_active: boolean
}

const emptyForm: ProductForm = {
  name: '', barcode: '', sku: '', category_id: '', cost_price: '',
  selling_price: '', tax_percent: '0', unit: 'pcs', min_stock: '0', is_active: true
}

export default function ProductsPage() {
  const { currentBranch, business } = useAppStore()
  const currency = business?.currency || 'USD'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [currentBranch, search, filterCategory, page])

  const loadCategories = async () => {
    const result = await window.api.categories.list()
    if (result.success) setCategories(result.data || [])
  }

  const loadProducts = async () => {
    if (!currentBranch) return
    setLoading(true)
    try {
      const result = await window.api.products.list({
        branch_id: currentBranch.id,
        search: search || undefined,
        category_id: filterCategory || undefined,
        page,
        per_page: 50,
        show_inactive: true
      })
      if (result.success) {
        setProducts(result.data.items || [])
        setTotalPages(result.data.total_pages || 1)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      barcode: product.barcode || '',
      sku: product.sku || '',
      category_id: String(product.category_id || ''),
      cost_price: String(product.cost_price),
      selling_price: String(product.selling_price),
      tax_percent: String(product.tax_rate || 0),
      unit: product.unit || 'pcs',
      min_stock: String(product.low_stock_threshold || 0),
      is_active: product.is_active !== 0
    })
    setError('')
    setShowForm(true)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.selling_price || parseFloat(form.selling_price) < 0) { setError('Valid selling price is required'); return }

    setSaving(true)
    setError('')

    try {
      const data = {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        sku: form.sku.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price),
        tax_rate: parseFloat(form.tax_percent) || 0,
        unit: form.unit || 'pcs',
        low_stock_threshold: parseInt(form.min_stock) || 0,
        is_active: form.is_active ? 1 : 0
      }

      const result = editingId
        ? await window.api.products.update(editingId, data)
        : await window.api.products.create(data)

      if (result.success) {
        setShowForm(false)
        loadProducts()
      } else {
        setError(result.error || 'Save failed')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this product?')) return
    const result = await window.api.products.update(id, { is_active: 0 })
    if (result.success) loadProducts()
  }

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) return
    const result = await window.api.categories.create({ name: categoryName.trim() })
    if (result.success) {
      loadCategories()
      setCategoryName('')
      setShowCategoryForm(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryForm(true)}>Categories</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, barcode, SKU..."
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package className="h-12 w-12 text-[var(--muted-foreground)] opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">No products found</p>
            </div>
          ) : (
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.sku && <p className="text-xs text-[var(--muted-foreground)]">SKU: {product.sku}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.barcode || '—'}</TableCell>
                      <TableCell>
                        {(product as any).category_name ? (
                          <Badge variant="outline">{(product as any).category_name}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.cost_price, currency)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(product.selling_price, currency)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={
                          ((product as any).stock_on_hand || 0) <= 0 ? 'destructive' :
                          ((product as any).stock_on_hand || 0) <= (product.low_stock_threshold || 0) ? 'outline' : 'secondary'
                        }>
                          {(product as any).stock_on_hand ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next</Button>
        </div>
      )}

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="No Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} min={0} step={0.01} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price *</Label>
                <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} min={0} step={0.01} />
              </div>
              <div className="space-y-2">
                <Label>Tax %</Label>
                <Input type="number" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} min={0} max={100} step={0.01} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Alert</Label>
                <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} min={0} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[var(--primary)]" />
              <span className="text-sm">Active</span>
            </label>

            {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={() => setShowCategoryForm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="New category name" />
              <Button onClick={handleCreateCategory} disabled={!categoryName.trim()}>Add</Button>
            </div>
            <ScrollArea className="max-h-60">
              <div className="space-y-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between rounded p-2 hover:bg-[var(--muted)]">
                    <span className="text-sm">{cat.name}</span>
                    <Badge variant="secondary">{(cat as any).product_count || 0}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
