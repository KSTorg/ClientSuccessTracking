import { cn } from '@/lib/utils'
import type { ClientStatus } from '@/lib/types'

const STYLES: Record<ClientStatus, string> = {
  onboarding: 'border-kst-gold/60 text-kst-gold bg-kst-gold/10',
  launched: 'border-kst-success/60 text-kst-success bg-kst-success/10',
  paused: 'border-white/15 text-white/50 bg-white/[0.04]',
  churned: 'border-kst-error/60 text-kst-error bg-kst-error/10',
}

const LABELS: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  launched: 'Launched',
  paused: 'Paused',
  churned: 'Churned',
}

export function StatusBadge({
  status,
  className,
}: {
  status: ClientStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  )
}
