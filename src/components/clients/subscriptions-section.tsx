'use client'

import { useEffect, useState } from 'react'
import { DollarSign, MoreHorizontal, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn, formatDate } from '@/lib/utils'

interface Service {
  id: string
  name: string
  base_price: number
  category: 'monthly' | 'combo' | 'one_time' | 'standalone'
  description: string | null
}

interface Subscription {
  id: string
  service_id: string
  service_name: string
  price: number
  billing_cycle: 'monthly' | 'quarterly' | 'annual' | 'one_time'
  discount_pct: number | null
  start_date: string | null
  notes: string | null
  status: 'active' | 'cancelled'
  cancelled_at: string | null
}

interface SubscriptionsSectionProps {
  clientId: string
  joinedDate?: string | null
  programEndDate?: string | null
  status?: string
}

const CYCLE_BADGE: Record<string, { label: string; cls: string }> = {
  monthly: { label: 'Monthly', cls: 'border-kst-gold/40 text-kst-gold bg-kst-gold/10' },
  quarterly: { label: 'Quarterly', cls: 'border-[rgba(96,165,250,0.4)] text-[#60A5FA] bg-[rgba(96,165,250,0.15)]' },
  annual: { label: 'Annual', cls: 'border-kst-success/40 text-kst-success bg-kst-success/10' },
  one_time: { label: 'One-time', cls: 'border-white/15 text-white/50 bg-white/[0.04]' },
}

const CATEGORY_LABELS: Record<string, string> = {
  monthly: 'Monthly Services',
  combo: 'Combo Packages',
  one_time: 'One-Time Placements',
  standalone: 'Standalone Services',
}

function fmtPrice(amount: number, cycle: string): string {
  const f = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (cycle === 'one_time') return `${f} one-time`
  if (cycle === 'quarterly') return `${f}/qtr`
  if (cycle === 'annual') return `${f}/yr`
  return `${f}/mo`
}

export function SubscriptionsSection({ clientId, joinedDate, programEndDate, status }: SubscriptionsSectionProps) {
  const supabase = createClient()
  const toast = useToast()

  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [showCancelled, setShowCancelled] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  async function loadSubs() {
    const { data } = await supabase
      .from('client_subscriptions')
      .select('id, service_id, price, billing_cycle, discount_pct, start_date, notes, status, cancelled_at, service:services ( name )')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    const rows: Subscription[] = []
    for (const r of (data ?? []) as unknown[]) {
      const obj = r as Record<string, unknown>
      const svc = Array.isArray(obj.service) ? obj.service[0] : obj.service
      const svcObj = (svc ?? {}) as Record<string, unknown>
      rows.push({
        id: obj.id as string,
        service_id: obj.service_id as string,
        service_name: (svcObj.name as string) ?? 'Unknown',
        price: Number(obj.price ?? 0),
        billing_cycle: (obj.billing_cycle as string) as Subscription['billing_cycle'],
        discount_pct: obj.discount_pct as number | null,
        start_date: obj.start_date as string | null,
        notes: obj.notes as string | null,
        status: (obj.status as string) as Subscription['status'],
        cancelled_at: obj.cancelled_at as string | null,
      })
    }
    setSubs(rows)
    setLoading(false)
  }

  useEffect(() => { loadSubs() }, [clientId])

  const active = subs.filter((s) => s.status === 'active')
  const cancelled = subs.filter((s) => s.status === 'cancelled')

  // Active months since joined
  const activeMonths = joinedDate
    ? Math.max(0, Math.round((Date.now() - new Date(joinedDate + 'T00:00:00').getTime()) / (30.44 * 86400000)))
    : null

  const todayIso = new Date().toISOString().slice(0, 10)
  const programEnded = programEndDate != null && programEndDate < todayIso

  // MRR: monthly subs full, quarterly / 3, annual / 12, one-time excluded
  const mrr = active.reduce((sum, s) => {
    if (s.billing_cycle === 'one_time') return sum
    if (s.billing_cycle === 'quarterly') return sum + s.price / 3
    if (s.billing_cycle === 'annual') return sum + s.price / 12
    return sum + s.price
  }, 0)

  async function cancelSub(subId: string) {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('client_subscriptions')
      .update({ status: 'cancelled', cancelled_at: today })
      .eq('id', subId)
    setMenuOpen(null)
    if (error) {
      toast.error(`Could not cancel: ${error.message}`)
      return
    }
    toast.success('Subscription cancelled')
    loadSubs()
  }

  async function openModal() {
    if (services.length === 0) {
      const { data } = await supabase
        .from('services')
        .select('id, name, base_price, category, description')
        .order('category')
        .order('name')
      setServices((data ?? []) as Service[])
    }
    setModalOpen(true)
  }

  return (
    <div className="glass-panel p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-kst-gold" />
          <h3 className="text-kst-white font-semibold">Subscriptions</h3>
          {mrr > 0 && (
            <span className="text-kst-gold text-sm font-medium ml-1">
              — ${Math.round(mrr).toLocaleString()}/mo MRR
            </span>
          )}
          {activeMonths != null && activeMonths > 0 && (
            <span className="text-kst-muted text-xs ml-1">
              · Active {activeMonths}mo
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-kst-gold/40 text-kst-gold text-xs font-medium hover:bg-kst-gold/10 transition-colors"
        >
          <Plus size={12} />
          Add Subscription
        </button>
      </div>

      {/* Program ended alert */}
      {programEnded && !loading && active.length === 0 && status !== 'churned' && (
        <div
          className="glass-panel-sm p-3 mb-4 flex items-center gap-2"
          style={{ borderColor: 'rgba(201, 168, 76, 0.3)' }}
        >
          <span className="w-2 h-2 rounded-full bg-kst-gold shrink-0" />
          <p className="text-kst-gold text-sm">
            Program ended — add subscriptions to continue services
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-kst-muted text-sm py-4 text-center">Loading...</p>
      ) : subs.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-kst-muted text-sm">
            No subscriptions yet. Add services after the onboarding program.
          </p>
          {programEnded && active.length === 0 && (
            <p className="text-kst-gold text-xs mt-2">
              Program ended — consider adding subscriptions
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Active */}
          <div className="space-y-2">
            {active.map((s) => (
              <div key={s.id} className="glass-panel-sm p-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-kst-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-kst-white text-sm font-medium truncate">{s.service_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-kst-gold text-xs font-semibold">{fmtPrice(s.price, s.billing_cycle)}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', CYCLE_BADGE[s.billing_cycle]?.cls)}>
                      {CYCLE_BADGE[s.billing_cycle]?.label}
                    </span>
                    {s.discount_pct != null && s.discount_pct > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-kst-gold/10 text-kst-gold">
                        {s.discount_pct}% off
                      </span>
                    )}
                    {s.start_date && (
                      <span className="text-kst-muted text-[10px]">from {formatDate(s.start_date)}</span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                    className="p-1.5 text-kst-muted hover:text-kst-white transition-colors"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen === s.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 kst-dropdown p-1 min-w-[160px] kst-fade-in">
                      <button
                        type="button"
                        onClick={() => cancelSub(s.id)}
                        className="w-full text-left px-3 py-2 text-sm text-kst-error hover:bg-white/[0.06] rounded-lg transition-colors"
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowCancelled((v) => !v)}
                className="text-kst-muted text-xs hover:text-kst-white transition-colors"
              >
                Cancelled ({cancelled.length}) {showCancelled ? '▾' : '▸'}
              </button>
              {showCancelled && (
                <div className="space-y-2 mt-2">
                  {cancelled.map((s) => (
                    <div key={s.id} className="glass-panel-sm p-4 flex items-center gap-3 opacity-50">
                      <span className="w-2 h-2 rounded-full bg-kst-error shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-kst-white text-sm font-medium truncate">{s.service_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-kst-muted text-xs">{fmtPrice(s.price, s.billing_cycle)}</span>
                          {s.cancelled_at && (
                            <span className="text-kst-muted text-[10px]">Cancelled {formatDate(s.cancelled_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Subscription Modal */}
      {modalOpen && (
        <AddSubscriptionModal
          clientId={clientId}
          services={services}
          onClose={() => setModalOpen(false)}
          onAdded={() => { setModalOpen(false); loadSubs() }}
        />
      )}
    </div>
  )
}

// ─── Add Subscription Modal ────────────────────────────────────────────────

function AddSubscriptionModal({
  clientId,
  services,
  onClose,
  onAdded,
}: {
  clientId: string
  services: Service[]
  onClose: () => void
  onAdded: () => void
}) {
  const supabase = createClient()
  const toast = useToast()

  const [selected, setSelected] = useState<Service | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [customPrice, setCustomPrice] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isRecurring = selected && (selected.category === 'monthly' || selected.category === 'combo')
  const effectiveCycle = isRecurring ? cycle : 'one_time'

  // Calculate price
  let calcPrice = selected?.base_price ?? 0
  let discountPct = 0
  if (isRecurring && selected) {
    if (cycle === 'quarterly') {
      discountPct = 10
      calcPrice = selected.base_price * 3 * 0.9
    } else if (cycle === 'annual') {
      discountPct = 25
      calcPrice = selected.base_price * 12 * 0.75
    } else {
      calcPrice = selected.base_price
    }
  }

  const finalPrice = customPrice !== '' ? Number(customPrice) : calcPrice

  // Group services by category
  const grouped = new Map<string, Service[]>()
  for (const s of services) {
    if (!grouped.has(s.category)) grouped.set(s.category, [])
    grouped.get(s.category)!.push(s)
  }
  const categoryOrder = ['monthly', 'combo', 'one_time', 'standalone']

  useEffect(() => {
    if (selected) {
      setCustomPrice('')
      setCycle('monthly')
    }
  }, [selected])

  async function handleSubmit() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('client_subscriptions').insert({
      client_id: clientId,
      service_id: selected.id,
      price: finalPrice,
      billing_cycle: effectiveCycle,
      discount_pct: discountPct > 0 ? discountPct : null,
      start_date: startDate || null,
      notes: notes.trim() || null,
      status: 'active',
    })
    setSaving(false)
    if (error) {
      toast.error(`Could not add subscription: ${error.message}`)
      return
    }
    toast.success(`${selected.name} added`)
    onAdded()
  }

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 md:py-16">
        <div
          className="glass-panel relative w-full max-w-[520px] p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
          >
            <X size={18} />
          </button>

          <h2 className="text-kst-white text-xl font-semibold mb-5">Add Subscription</h2>

          {/* Service picker */}
          <div className="max-h-[280px] overflow-y-auto mb-5 space-y-4">
            {categoryOrder.map((cat) => {
              const items = grouped.get(cat)
              if (!items?.length) return null
              return (
                <div key={cat}>
                  <p className="text-kst-muted text-xs uppercase tracking-wider mb-2">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((s) => {
                      const isSelected = selected?.id === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected(s)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border transition-all text-sm',
                            isSelected
                              ? 'border-kst-gold/60 bg-kst-gold/[0.06]'
                              : 'border-white/[0.08] hover:border-white/15 bg-white/[0.02]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('font-medium', isSelected ? 'text-kst-gold' : 'text-kst-white')}>
                              {s.name}
                            </span>
                            <span className="text-kst-muted text-xs">${s.base_price.toLocaleString()}</span>
                          </div>
                          {s.description && (
                            <p className="text-kst-muted text-xs mt-0.5 truncate">{s.description}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pricing section */}
          {selected && (
            <div className="space-y-4 border-t border-white/[0.06] pt-4">
              {isRecurring && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">Billing Cycle</p>
                  <div className="flex gap-2">
                    {(['monthly', 'quarterly', 'annual'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCycle(c)}
                        className={cn(
                          'px-3 h-9 rounded-full text-xs font-medium border transition-colors',
                          cycle === c
                            ? 'border-kst-gold/60 text-kst-gold bg-kst-gold/10'
                            : 'border-white/10 text-kst-muted hover:text-kst-white'
                        )}
                      >
                        {c === 'monthly' ? 'Monthly' : c === 'quarterly' ? 'Quarterly (10% off)' : 'Annual (25% off)'}
                      </button>
                    ))}
                  </div>
                  {cycle !== 'monthly' && (
                    <p className="text-kst-muted text-xs mt-2">
                      ${selected.base_price} × {cycle === 'quarterly' ? 3 : 12} = ${selected.base_price * (cycle === 'quarterly' ? 3 : 12)}, minus {discountPct}% ={' '}
                      <span className="text-kst-gold font-semibold">${Math.round(calcPrice).toLocaleString()}</span>
                    </p>
                  )}
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">
                  Price {isRecurring ? `(${effectiveCycle})` : ''}
                </span>
                <input
                  type="number"
                  value={customPrice !== '' ? customPrice : Math.round(calcPrice)}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="px-4 py-3 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-none"
                />
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !selected}
              onClick={handleSubmit}
              className="px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60"
            >
              {saving ? 'Adding...' : 'Add Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
