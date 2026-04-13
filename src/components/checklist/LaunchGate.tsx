'use client'

import { useEffect } from 'react'
import { Rocket } from 'lucide-react'

export function LaunchConfirmModal({
  companyName,
  onConfirm,
  onCancel,
}: {
  companyName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 backdrop-blur-[20px] backdrop-saturate-[1.2]"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 md:py-16">
        <div
          className="glass-panel relative w-full max-w-[480px] p-7 kst-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-kst-gold/10 border border-kst-gold/40 flex items-center justify-center">
              <Rocket size={18} className="text-kst-gold" />
            </div>
            <h2 className="text-kst-white text-xl font-semibold">
              Launch {companyName}?
            </h2>
          </div>
          <p className="text-kst-muted text-sm leading-relaxed mb-6">
            Marking &lsquo;Launch Ads&rsquo; as complete will launch this
            client and enable Success Tracking. The launch date will be set
            to today.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm"
            >
              Confirm Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
