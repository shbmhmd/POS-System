import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Settings, Users, Store, MapPin, Printer, Cloud,
  Save, Loader2, Plus, Edit, Trash2, Shield, Download, RefreshCw, CheckCircle
} from 'lucide-react'
import type { User, Role, Branch } from '@/types'

export default function SettingsPage() {
  const [tab, setTab] = useState('general')
  const { hasPermission } = useAuthStore()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Manage your POS configuration</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          {hasPermission('manage_users') && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="printer">Printer</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralSettings /></TabsContent>
        <TabsContent value="branches"><BranchSettings /></TabsContent>
        <TabsContent value="users"><UserSettings /></TabsContent>
        <TabsContent value="printer"><PrinterSettings /></TabsContent>
        <TabsContent value="backup"><BackupSettings /></TabsContent>
        <TabsContent value="updates"><UpdateSettings /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ───── General Settings ───── */
function GeneralSettings() {
  const { business, loadBusinessData } = useAppStore()
  const [name, setName] = useState(business?.name || '')
  const [currency, setCurrency] = useState(business?.currency || 'USD')
  const [taxMode, setTaxMode] = useState(business?.tax_mode || 'exclusive')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.settings.updateBusiness({
        name: name.trim(),
        currency,
        tax_mode: taxMode
      })
      await loadBusinessData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
        <CardDescription>Update your business details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Business Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'LKR', 'PKR', 'BDT', 'PHP', 'MYR', 'NGN', 'KES', 'ZAR'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tax Mode</Label>
            <Select value={taxMode} onValueChange={(v) => setTaxMode(v as 'inclusive' | 'exclusive')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">Tax Exclusive</SelectItem>
                <SelectItem value="inclusive">Tax Inclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </CardContent>
    </Card>
  )
}

/* ───── Branch Settings ───── */
function BranchSettings() {
  const { branches, loadBusinessData } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', code: '', invoice_prefix: '', address: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const openEdit = (b: Branch) => {
    setEditingId(b.id as number)
    setForm({ name: b.name, code: b.code, invoice_prefix: b.invoice_prefix, address: b.address || '', phone: b.phone || '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!editingId || !form.name.trim()) return
    setSaving(true)
    try {
      await window.api.settings.updateBranch(editingId, {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined
      })
      await loadBusinessData()
      setShowForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Code: {b.code} | Prefix: {b.invoice_prefix}</p>
                {b.address && <p className="text-xs text-[var(--muted-foreground)]">{b.address}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

/* ───── User Management ───── */
function UserSettings() {
  const { currentBranch } = useAppStore()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role_id: '', max_discount: '100' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersResult, rolesResult] = await Promise.all([
        window.api.auth.getUsers(),
        window.api.auth.getRoles()
      ])
      if (usersResult.success) setUsers(usersResult.data || [])
      if (rolesResult.success) setRoles(rolesResult.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ username: '', display_name: '', password: '', role_id: String(roles[0]?.id || ''), max_discount: '100' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditingId(u.id as number)
    setForm({
      username: u.username,
      display_name: u.display_name,
      password: '',
      role_id: String(u.role_id),
      max_discount: String((u as any).max_discount || 100)
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.display_name.trim()) {
      setError('Username and display name are required')
      return
    }
    if (!editingId && !form.password) {
      setError('Password is required for new users')
      return
    }

    setSaving(true)
    setError('')

    try {
      let result: any
      if (editingId) {
        result = await window.api.auth.updateUser(editingId, {
          display_name: form.display_name.trim(),
          role_id: Number(form.role_id)
        })
      } else {
        result = await window.api.auth.createUser({
          username: form.username.trim(),
          display_name: form.display_name.trim(),
          password: form.password,
          role_id: Number(form.role_id),
          branch_id: currentBranch?.id || 1
        })
      }

      if (result.success) {
        setShowForm(false)
        loadData()
      } else {
        setError(result.error || 'Failed to save')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Add User</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Max Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell><Badge variant="outline">{(u as any).role_name || '—'}</Badge></TableCell>
                  <TableCell>{(u as any).max_discount || 100}%</TableCell>
                  <TableCell><Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingId ? 'Edit User' : 'New User'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editingId} />
              </div>
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              {!editingId && (
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Discount %</Label>
                <Input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} min={0} max={100} />
              </div>
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
      </CardContent>
    </Card>
  )
}

/* ───── Printer Settings ───── */
function PrinterSettings() {
  const [printerName, setPrinterName] = useState('')
  const [width, setWidth] = useState('80')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    window.api.settings.getAll().then((r: any) => {
      if (r.success) {
        const settings = r.data || {}
        setPrinterName(settings.printer_name || '')
        setWidth(settings.receipt_width || '80')
      }
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.settings.setMany({
        printer_name: printerName,
        receipt_width: width
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const testPrint = async () => {
    setTesting(true)
    try {
      await window.api.printer.test(printerName)
    } catch (err) {
      console.error(err)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt Printer</CardTitle>
        <CardDescription>Configure your ESC/POS thermal printer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Printer Name</Label>
          <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="e.g., POS-80-Printer" />
        </div>
        <div className="space-y-2">
          <Label>Paper Width (mm)</Label>
          <Select value={width} onValueChange={setWidth}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm</SelectItem>
              <SelectItem value="80">80mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button variant="outline" onClick={testPrint} disabled={testing || !printerName}>
            {testing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            <Printer className="h-4 w-4 mr-1" /> Test Print
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ───── Backup Settings ───── */
function BackupSettings() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')

  const loadStatus = () => {
    window.api.google.getStatus().then((r: any) => {
      if (r.success) setStatus(r.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    setMessage('')
    try {
      const result = await window.api.google.connect()
      if (result.success) {
        setMessage(`Connected as ${result.data?.email}`)
        loadStatus()
      } else {
        setMessage(result.error || 'Connection failed')
      }
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await window.api.google.disconnect()
    setStatus({ connected: false, email: null })
    setMessage('Disconnected')
  }

  const handleBackup = async () => {
    setBacking(true)
    setMessage('')
    try {
      const result = await window.api.google.backupNow()
      if (result.success) {
        setMessage('Backup completed successfully!')
        loadStatus()
      } else {
        setMessage(result.error || 'Backup failed')
      }
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBacking(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setMessage('')
    try {
      const result = await window.api.google.exportNow()
      if (result.success) {
        setMessage('Export completed! Opening spreadsheet...')
        if (result.url) {
          window.open(result.url, '_blank')
        }
        loadStatus()
      } else {
        setMessage(result.error || 'Export failed')
      }
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Google Drive Backup</CardTitle>
          <CardDescription>Backup your database and export sales to Google Sheets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <Badge variant={status?.connected ? 'default' : 'secondary'}>
                {status?.connected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            {status?.email && (
              <div className="flex justify-between">
                <span>Account:</span>
                <span className="font-medium">{status.email}</span>
              </div>
            )}
            {status?.last_backup && (
              <div className="flex justify-between">
                <span>Last Backup:</span>
                <span>{new Date(status.last_backup).toLocaleString()}</span>
              </div>
            )}
            {status?.last_export && (
              <div className="flex justify-between">
                <span>Last Export:</span>
                <span>{new Date(status.last_export).toLocaleString()}</span>
              </div>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.includes('fail') || message.includes('error') ? 'text-[var(--destructive)]' : 'text-green-600'}`}>
              {message}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {!status?.connected ? (
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
                {connecting ? 'Connecting...' : 'Connect Google Drive'}
              </Button>
            ) : (
              <>
                <Button onClick={handleBackup} disabled={backing || exporting}>
                  {backing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
                  {backing ? 'Backing up...' : 'Backup Database'}
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={backing || exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {exporting ? 'Exporting...' : 'Export to Sheets'}
                </Button>
                <Button variant="ghost" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ───── Update Settings ───── */
function UpdateSettings() {
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [error, setError] = useState('')

  const handleCheck = async () => {
    setChecking(true)
    setError('')
    setUpdateInfo(null)
    try {
      const result = await (window as any).api.updater.check()
      if (result.success) {
        setUpdateInfo(result.data)
      } else {
        setError(result.error || 'Failed to check for updates')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const handleDownload = async () => {
    const url = updateInfo?.downloadUrl || updateInfo?.htmlUrl
    if (url) {
      await (window as any).api.updater.download(url)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Check for Updates
          </CardTitle>
          <CardDescription>Check if a new version of POS System is available on GitHub</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current version */}
          <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Current Version:</span>
              <Badge variant="secondary">{updateInfo?.currentVersion || '...'}</Badge>
            </div>
            {updateInfo && (
              <div className="flex justify-between">
                <span>Latest Version:</span>
                <Badge variant={updateInfo.updateAvailable ? 'default' : 'secondary'}>
                  {updateInfo.latestVersion}
                </Badge>
              </div>
            )}
            {updateInfo?.releaseDate && (
              <div className="flex justify-between">
                <span>Release Date:</span>
                <span>{new Date(updateInfo.releaseDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Update status */}
          {updateInfo && !updateInfo.updateAvailable && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              You are running the latest version!
            </div>
          )}

          {updateInfo?.updateAvailable && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <Download className="h-4 w-4" />
                New version {updateInfo.latestVersion} is available!
              </div>
              {updateInfo.releaseNotes && (
                <div className="rounded-lg border p-3 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">
                  <p className="font-medium mb-1">Release Notes:</p>
                  {updateInfo.releaseNotes}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {checking ? 'Checking...' : 'Check for Updates'}
            </Button>

            {updateInfo?.updateAvailable && (
              <Button variant="default" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download Update
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
