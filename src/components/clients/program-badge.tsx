import { cn } from '@/lib/utils'
import { PROGRAM_LABELS, PROGRAM_SHORT, type Program } from '@/lib/types'

export function ProgramBadge({
  program,
  short,
  className,
}: {
  program: Program
  short?: boolean
  className?: string
}) {
  const label = short ? PROGRAM_SHORT[program] : PROGRAM_LABELS[program]

  if (program === 'accelerator') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
          className
        )}
        style={{
          color: '#22D3EE',
          borderColor: 'rgba(34, 211, 238, 0.55)',
          background: 'rgba(34, 211, 238, 0.1)',
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-kst-gold/60 text-kst-gold bg-kst-gold/10',
        className
      )}
    >
      {label}
    </span>
  )
}
