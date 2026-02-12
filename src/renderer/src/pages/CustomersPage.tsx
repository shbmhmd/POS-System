import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  History
} from 'lucide-react'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const { business } = useAppStore()
  const currency = business?.currency || 'USD'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [historyData, setHistoryData] = useState<any>(null)

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const result = await window.api.customers.list({ search: search || undefined })
      if (result.success) setCustomers(result.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(), 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return
    const result = await window.api.customers.delete(id)
    if (result.success) loadCustomers()
  }

  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer)
    setShowHistory(true)
    const result = await window.api.customers.history(customer.id)
    if (result.success) setHistoryData(result.data)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Customers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your customer directory
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
              {search ? 'No customers match your search' : 'No customers yet. Add your first customer!'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell>{c.email || '—'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.balance, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openHistory(c)}
                          title="Purchase History"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(c)
                            setShowForm(true)
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <CustomerFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        customer={editing}
        onSaved={loadCustomers}
      />

      {/* History Dialog */}
      <CustomerHistoryDialog
        open={showHistory}
        onClose={() => {
          setShowHistory(false)
          setHistoryData(null)
        }}
        customer={historyCustomer}
        data={historyData}
        currency={currency}
      />
    </div>
  )
}

/* ───── Customer Form Dialog ───── */
function CustomerFormDialog({
  open,
  onClose,
  customer,
  onSaved
}: {
  open: boolean
  onClose: () => void
  customer: Customer | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(customer?.name || '')
      setPhone(customer?.phone || '')
      setEmail(customer?.email || '')
      setAddress(customer?.address || '')
      setNotes(customer?.notes || '')
      setError('')
    }
  }, [open, customer])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Customer name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined
      }

      const result = customer
        ? await window.api.customers.update(customer.id, data)
        : await window.api.customers.create(data)

      if (result.success) {
        onSaved()
        onClose()
      } else {
        setError(result.error || 'Failed to save customer')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>
              Name <span className="text-[var(--destructive)]">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="pl-8"
                  type="email"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Address</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-3 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                className="pl-8 min-h-[60px]"
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {customer ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ───── Customer History Dialog ───── */
function CustomerHistoryDialog({
  open,
  onClose,
  customer,
  data,
  currency
}: {
  open: boolean
  onClose: () => void
  customer: Customer | null
  data: any
  currency: string
}) {
  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> {customer.name} — Purchase History
          </DialogTitle>
        </DialogHeader>

        {!data ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-[var(--muted-foreground)]">Total Purchases</p>
                  <p className="text-xl font-bold">{data.stats?.total_purchases || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-[var(--muted-foreground)]">Total Spent</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(data.stats?.total_spent || 0, currency)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-[var(--muted-foreground)]">Last Purchase</p>
                  <p className="text-sm font-medium">
                    {data.stats?.last_purchase
                      ? new Date(data.stats.last_purchase).toLocaleDateString()
                      : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Purchase History List */}
            <ScrollArea className="max-h-64">
              {data.sales?.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                  No purchases yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sales?.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{sale.invoice_number}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(sale.created_at)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sale.total, currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              sale.status === 'completed'
                                ? 'default'
                                : sale.status === 'voided'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {sale.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
