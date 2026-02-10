import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Store, MapPin, User, Printer, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react'

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'ZAR', name: 'South African Rand' }
]

const STEPS = [
  { icon: Store, label: 'Business Info' },
  { icon: MapPin, label: 'Branch Setup' },
  { icon: User, label: 'Admin Account' },
  { icon: Printer, label: 'Printer' },
  { icon: Check, label: 'Finish' }
]

export default function SetupWizard() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setSetupComplete, loadBusinessData } = useAppStore()

  // Business
  const [businessName, setBusinessName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [taxMode, setTaxMode] = useState<'inclusive' | 'exclusive'>('exclusive')

  // Branch
  const [branchMode, setBranchMode] = useState<'single' | 'multi'>('single')
  const [branches, setBranches] = useState([
    { name: 'Main Branch', code: 'MAIN', invoice_prefix: 'INV', address: '', phone: '' }
  ])

  // Admin
  const [adminUsername, setAdminUsername] = useState('admin')
  const [adminDisplayName, setAdminDisplayName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')

  // Printer
  const [printerName, setPrinterName] = useState('')

  const addBranch = () => {
    setBranches([...branches, { name: '', code: '', invoice_prefix: '', address: '', phone: '' }])
  }

  const updateBranch = (index: number, field: string, value: string) => {
    const updated = [...branches]
    updated[index] = { ...updated[index], [field]: value }
    setBranches(updated)
  }

  const canNext = (): boolean => {
    switch (step) {
      case 0: return businessName.trim().length > 0
      case 1: return branches.every((b) => b.name.trim() && b.code.trim() && b.invoice_prefix.trim())
      case 2: return adminUsername.trim().length > 0 && adminPassword.length >= 4 && adminPassword === adminConfirm && adminDisplayName.trim().length > 0
      case 3: return true
      default: return true
    }
  }

  const handleFinish = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await window.api.setup.complete({
        business: { name: businessName.trim(), currency, tax_mode: taxMode },
        branches: branches.map((b) => ({
          name: b.name.trim(),
          code: b.code.trim().toUpperCase(),
          invoice_prefix: b.invoice_prefix.trim().toUpperCase(),
          address: b.address.trim() || undefined,
          phone: b.phone.trim() || undefined
        })),
        admin: {
          username: adminUsername.trim(),
          display_name: adminDisplayName.trim(),
          password: adminPassword
        },
        printer_name: printerName || undefined
      })

      if (result.success) {
        await loadBusinessData()
        setSetupComplete(true)
      } else {
        setError(result.error || 'Setup failed')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--muted)]">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Setup Your POS</CardTitle>
          <CardDescription>Let's get your point of sale system ready in a few steps</CardDescription>

          {/* Stepper */}
          <div className="flex items-center gap-2 pt-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium
                    ${i < step ? 'bg-[var(--success)] text-white' :
                      i === step ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' :
                      'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs hidden sm:inline ${i === step ? 'font-medium' : 'text-[var(--muted-foreground)]'}`}>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <div className="h-px w-4 bg-[var(--border)]" />}
                </div>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 0: Business Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="biz-name">Business Name *</Label>
                <Input
                  id="biz-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="My Store"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tax Mode</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={taxMode === 'exclusive'} onChange={() => setTaxMode('exclusive')} className="accent-[var(--primary)]" />
                    <span className="text-sm">Tax Exclusive (added on top)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={taxMode === 'inclusive'} onChange={() => setTaxMode('inclusive')} className="accent-[var(--primary)]" />
                    <span className="text-sm">Tax Inclusive (included in price)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Branch Setup */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={branchMode === 'single'} onChange={() => { setBranchMode('single'); setBranches([branches[0]]) }} className="accent-[var(--primary)]" />
                  <span className="text-sm">Single Branch</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={branchMode === 'multi'} onChange={() => setBranchMode('multi')} className="accent-[var(--primary)]" />
                  <span className="text-sm">Multi Branch</span>
                </label>
              </div>

              {branches.map((branch, idx) => (
                <div key={idx} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                  <h4 className="text-sm font-medium">Branch {idx + 1}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input value={branch.name} onChange={(e) => updateBranch(idx, 'name', e.target.value)} placeholder="Main Branch" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Code *</Label>
                      <Input value={branch.code} onChange={(e) => updateBranch(idx, 'code', e.target.value)} placeholder="MAIN" className="uppercase" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice Prefix *</Label>
                      <Input value={branch.invoice_prefix} onChange={(e) => updateBranch(idx, 'invoice_prefix', e.target.value)} placeholder="INV" className="uppercase" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Address</Label>
                      <Input value={branch.address} onChange={(e) => updateBranch(idx, 'address', e.target.value)} placeholder="123 Main St" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input value={branch.phone} onChange={(e) => updateBranch(idx, 'phone', e.target.value)} placeholder="+1 234 567 890" />
                    </div>
                  </div>
                </div>
              ))}

              {branchMode === 'multi' && (
                <Button variant="outline" onClick={addBranch} size="sm">+ Add Branch</Button>
              )}
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} placeholder="John Doe" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="admin" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password * (min 4 chars)</Label>
                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <Input type="password" value={adminConfirm} onChange={(e) => setAdminConfirm(e.target.value)} />
                  {adminConfirm && adminPassword !== adminConfirm && (
                    <p className="text-xs text-[var(--destructive)]">Passwords don't match</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Printer */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Configure your receipt printer. You can skip this and set it up later in Settings.
              </p>
              <div className="space-y-2">
                <Label>Printer Name (optional)</Label>
                <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="e.g., POS-Printer or leave blank" />
              </div>
            </div>
          )}

          {/* Step 4: Summary / Finish */}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="font-medium">Setup Summary</h3>
              <div className="rounded-lg bg-[var(--muted)] p-4 space-y-2 text-sm">
                <p><strong>Business:</strong> {businessName} ({currency}, Tax {taxMode})</p>
                <p><strong>Branches:</strong> {branches.map((b) => b.name).join(', ')}</p>
                <p><strong>Admin:</strong> {adminDisplayName} ({adminUsername})</p>
                <p><strong>Printer:</strong> {printerName || 'Not configured'}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
                ) : (
                  <><Check className="h-4 w-4" /> Complete Setup</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
