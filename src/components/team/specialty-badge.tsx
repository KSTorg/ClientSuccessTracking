import { SPECIALTY_LABELS, type Specialty } from '@/lib/types'

const STYLES: Record<
  Specialty,
  { color: string; border: string; bg: string }
> = {
  csm: {
    // Matches the admin role badge — gold, derived from var(--kst-gold)
    color: '#C9A84C',
    border: 'rgba(201, 168, 76, 0.55)',
    bg: 'rgba(201, 168, 76, 0.10)',
  },
  ads: {
    color: '#FB923C',
    border: 'rgba(251, 146, 60, 0.55)',
    bg: 'rgba(251, 146, 60, 0.10)',
  },
  systems: {
    color: '#60A5FA',
    border: 'rgba(96, 165, 250, 0.55)',
    bg: 'rgba(96, 165, 250, 0.10)',
  },
  organic: {
    color: '#34D399',
    border: 'rgba(52, 211, 153, 0.55)',
    bg: 'rgba(52, 211, 153, 0.10)',
  },
  sales: {
    color: '#A78BFA',
    border: 'rgba(167, 139, 250, 0.55)',
    bg: 'rgba(167, 139, 250, 0.10)',
  },
}

export function SpecialtyBadge({ specialty }: { specialty: Specialty }) {
  const s = STYLES[specialty]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ color: s.color, borderColor: s.border, background: s.bg }}
    >
      {SPECIALTY_LABELS[specialty]}
    </span>
  )
}
