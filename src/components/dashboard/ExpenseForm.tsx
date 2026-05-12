'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createExpenseAction, deleteExpenseAction } from '@/actions/expense.actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Expense } from '@/lib/db/schema'
import type { RecentExpenseItem } from '@/lib/db/queries/expenses'

const ALL_CATEGORIES = [
  'Professional fees',
  'Training & workshops',
  'Equipment & props',
  'Clothing & costume',
  'Home office',
  'Marketing',
  'Subscriptions',
  'Other',
]

interface Props {
  expenses:    Expense[]
  ytdTotal:    number
  recentItems: RecentExpenseItem[]
}

export function ExpenseCard({ expenses, ytdTotal, recentItems }: Props) {
  const router = useRouter()

  const [showAll,     setShowAll]    = useState(false)
  const [date,        setDate]       = useState(new Date().toISOString().split('T')[0])
  const [description, setDesc]       = useState('')
  const [category,    setCategory]   = useState(ALL_CATEGORIES[0])
  const [amount,      setAmount]     = useState('')
  const [saving,      setSaving]     = useState(false)
  const [deleting,    setDeleting]   = useState<string | null>(null)

  function handleDescriptionChange(value: string) {
    setDesc(value)
    const match = recentItems.find(r => r.description.toLowerCase() === value.toLowerCase())
    if (match) {
      setAmount(Number(match.amount).toFixed(2))
      setCategory(match.category)
    }
  }

  const canSave = date && description.trim() && amount && Number(amount) > 0

  async function handleAdd() {
    if (!canSave) return
    setSaving(true)
    try {
      await createExpenseAction({ date, category, description: description.trim(), amount })
      setDesc('')
      setAmount('')
      setCategory(ALL_CATEGORIES[0])
      toast.success('Expense logged')
      router.refresh()
    } catch {
      toast.error('Failed to log expense')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteExpenseAction(id)
      toast.success('Expense deleted')
      router.refresh()
    } catch {
      toast.error('Failed to delete expense')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Other Expenses (YTD)</CardTitle>
          <span className="font-bold text-sm">{formatCurrency(ytdTotal)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Logged expenses list */}
        {expenses.length > 0 && (
          <div className="space-y-1">
            {expenses.slice(0, showAll ? undefined : 3).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs text-slate-600">
                <span className="truncate flex-1 mr-2">
                  <span className="text-slate-400">{formatDate(e.date)}</span>
                  {' '}{e.description}
                  <span className="text-slate-400 ml-1">· {e.category}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{formatCurrency(Number(e.amount))}</span>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deleting === e.id}
                    className="text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length > 3 && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-1"
              >
                {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAll ? 'Show less' : `Show ${expenses.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {/* Add form */}
        <div className="space-y-2 pt-1 border-t">
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              className="mt-0.5 h-8 text-xs"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Description with datalist suggestions from past entries */}
          <div>
            <Label className="text-xs">Description</Label>
            <input
              list="expense-suggestions"
              value={description}
              onChange={e => handleDescriptionChange(e.target.value)}
              placeholder="e.g. Equity subscription"
              className="mt-0.5 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <datalist id="expense-suggestions">
              {recentItems.map(r => (
                <option key={r.description} value={r.description} />
              ))}
            </datalist>
            {recentItems.length === 0 && (
              <p className="text-xs text-slate-400 mt-0.5">Type any description — past entries will appear here as suggestions.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Category</Label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="mt-0.5 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Amount (£)</Label>
              <Input
                className="mt-0.5 h-8 text-xs"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleAdd}
            disabled={saving || !canSave}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Saving…' : 'Log expense'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
