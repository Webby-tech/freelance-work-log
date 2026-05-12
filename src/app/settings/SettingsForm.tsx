'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateSettingsAction } from '@/actions/settings.actions'
import type { UserSettings } from '@/lib/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

interface Props {
  initialSettings: UserSettings | null
}

export function SettingsForm({ initialSettings }: Props) {
  const s = initialSettings
  const [saving, setSaving] = useState(false)

  // Personal details
  const [legalName,    setLegalName]    = useState(s?.legalName    ?? '')
  const [tradingName,  setTradingName]  = useState(s?.tradingName  ?? '')
  const [email,        setEmail]        = useState(s?.email        ?? '')
  const [phone,        setPhone]        = useState(s?.phone        ?? '')
  const [address,      setAddress]      = useState(s?.address      ?? '')
  const [utrNumber,    setUtrNumber]    = useState(s?.utrNumber    ?? '')

  // Home postcode
  const [homePostcode, setHomePostcode] = useState(s?.homePostcode ?? '')

  // Bank details
  const [bankName,     setBankName]     = useState(s?.bankName     ?? '')
  const [bankSortCode, setBankSortCode] = useState(s?.bankSortCode ?? '')
  const [bankAccount,  setBankAccount]  = useState(s?.bankAccount  ?? '')

  // Invoice preferences
  const [invoicePrefix,  setInvoicePrefix]  = useState(s?.invoicePrefix  ?? 'INV')
  const [invoiceFooter,  setInvoiceFooter]  = useState(s?.invoiceFooter  ?? '')

  // Tax preferences
  const [paExhausted,  setPaExhausted]  = useState(s?.personalAllowanceExhausted ?? true)
  const [useFlatRate,  setUseFlatRate]  = useState(s?.useFlatTaxRate ?? false)
  const [flatRate,     setFlatRate]     = useState(
    s?.flatTaxRateOverride ? String(Math.round(Number(s.flatTaxRateOverride) * 100)) : '20'
  )
  const [priorBill,    setPriorBill]    = useState(s?.priorYearTaxBill ? String(s.priorYearTaxBill) : '')
  const [poaJan,       setPoaJan]       = useState(s?.poaJanPaid ? String(s.poaJanPaid) : '')
  const [poaJul,       setPoaJul]       = useState(s?.poaJulPaid ? String(s.poaJulPaid) : '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Always geocode home postcode on save
      let homeLat: string | null = null
      let homeLng: string | null = null
      const cleanPc = homePostcode.trim().toUpperCase()
      if (cleanPc) {
        try {
          const res = await fetch(`/api/postcode?pc=${encodeURIComponent(cleanPc)}`)
          if (res.ok) {
            const geo = await res.json()
            homeLat = String(geo.lat)
            homeLng = String(geo.lng)
          } else {
            toast.error('Home postcode not recognised — check it and try again')
            setSaving(false)
            return
          }
        } catch {
          toast.error('Could not geocode home postcode — check your connection')
          setSaving(false)
          return
        }
      }

      await updateSettingsAction({
        legalName:                  legalName    || null,
        tradingName:                tradingName  || null,
        email:                      email        || null,
        phone:                      phone        || null,
        address:                    address      || null,
        utrNumber:                  utrNumber    || null,
        homePostcode:               cleanPc,
        homeLat,
        homeLng,
        bankName:                   bankName     || null,
        bankSortCode:               bankSortCode || null,
        bankAccount:                bankAccount  || null,
        invoicePrefix:              invoicePrefix || 'INV',
        invoiceFooter:              invoiceFooter || null,
        personalAllowanceExhausted: paExhausted,
        useFlatTaxRate:             useFlatRate,
        flatTaxRateOverride:        useFlatRate ? String(Number(flatRate) / 100) : '0.20',
        priorYearTaxBill:           priorBill ? String(parseFloat(priorBill)) : null,
        poaJanPaid:                 poaJan ? String(parseFloat(poaJan)) : '0',
        poaJulPaid:                 poaJul ? String(parseFloat(poaJul)) : '0',
      } as Partial<UserSettings>)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Personal details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Legal name"    value={legalName}    onChange={setLegalName}    placeholder="Your full legal name" />
          <Field label="Trading name"  value={tradingName}  onChange={setTradingName}  placeholder="Stage name / trading as (optional)" />
          <Field label="Email"         value={email}        onChange={setEmail}        type="email" />
          <Field label="Phone"         value={phone}        onChange={setPhone}        type="tel" />
          <Field label="Address"       value={address}      onChange={setAddress}      placeholder="Full address for invoices" />
          <Field label="UTR number"    value={utrNumber}    onChange={setUtrNumber}    placeholder="HMRC Unique Taxpayer Reference" />
        </CardContent>
      </Card>

      {/* Home postcode */}
      <Card>
        <CardHeader><CardTitle className="text-base">Home Postcode</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Field
            label="Home postcode"
            value={homePostcode}
            onChange={v => setHomePostcode(v.toUpperCase())}
            placeholder="e.g. BR8 7JJ"
            required
          />
          {s?.homeLat && s?.homeLng && (
            <p className="text-xs text-green-600">✓ Geocoded — coordinates stored for mileage calculations</p>
          )}
          {(!s?.homeLat || !s?.homeLng) && (
            <p className="text-xs text-amber-600">⚠ Not yet geocoded — save this page to fix mileage calculations</p>
          )}
          <p className="text-xs text-slate-500">
            Used as the default origin for mileage calculations. Changing this does not affect existing entries.
          </p>
        </CardContent>
      </Card>

      {/* Bank details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Bank name"    value={bankName}     onChange={setBankName}     placeholder="e.g. Lloyds" />
          <Field label="Sort code"    value={bankSortCode} onChange={setBankSortCode} placeholder="00-00-00" />
          <Field label="Account no."  value={bankAccount}  onChange={setBankAccount}  placeholder="8-digit account number" />
        </CardContent>
      </Card>

      {/* Invoice preferences */}
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Field
              label="Invoice prefix"
              value={invoicePrefix}
              onChange={setInvoicePrefix}
              placeholder="INV"
            />
            <p className="text-xs text-slate-500 mt-1">Prefix for client invoice numbers, e.g. INV → INV-202505-001</p>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Default invoice footer</Label>
            <textarea
              className="mt-1 flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              value={invoiceFooter}
              onChange={e => setInvoiceFooter(e.target.value)}
              placeholder="e.g. I am responsible for all tax and National Insurance contributions arising from these services."
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-1">Appears at the bottom of every invoice. Supports multiple lines.</p>
          </div>
        </CardContent>
      </Card>

      {/* Tax preferences */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tax Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* PA exhausted toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Personal allowance fully used by other income</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Switch on if your pension (or other income) already uses your full personal allowance (£12,570).
                When on, all acting income is treated as taxable from £1.
              </p>
            </div>
            <Switch checked={paExhausted} onCheckedChange={setPaExhausted} />
          </div>

          <Separator />

          {/* Flat rate toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Use flat tax rate instead of banded calculation</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Overrides the HMRC banded estimate with a simple percentage you set.
              </p>
            </div>
            <Switch checked={useFlatRate} onCheckedChange={setUseFlatRate} />
          </div>

          {useFlatRate && (
            <div className="pl-4">
              <Label className="text-xs text-slate-600">Flat rate (%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={flatRate}
                  onChange={e => setFlatRate(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Payments on account */}
          <div>
            <p className="text-sm font-medium">Payments on account (prior year)</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Enter your prior year tax bill and any POA payments made — shown as context on the dashboard.
              Based on prior year bill — confirm with your accountant.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Prior year bill (£)</Label>
                <Input value={priorBill} onChange={e => setPriorBill(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Jan payment paid (£)</Label>
                <Input value={poaJan} onChange={e => setPoaJan(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Jul payment paid (£)</Label>
                <Input value={poaJul} onChange={e => setPoaJul(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <Label className="text-xs text-slate-600">{label}{required && ' *'}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}
