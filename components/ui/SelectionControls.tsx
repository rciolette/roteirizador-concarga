'use client'
import { cn } from '@/lib/utils'
import { Btn } from '@/components/ui'

// ── Checkbox ──────────────────────────────────────────────────────────────────
export function Checkbox({ checked, onChange, indeterminate }: {
  checked: boolean
  onChange: (v: boolean) => void
  indeterminate?: boolean
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      className={cn(
        'w-4 h-4 rounded border border-[0.5px] flex items-center justify-center transition-colors cursor-pointer shrink-0',
        checked || indeterminate
          ? 'bg-primary border-primary'
          : 'bg-page border-[var(--border-input)] hover:border-primary',
      )}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <span className="w-2 h-px bg-white block" />
      )}
    </button>
  )
}

// ── BulkBar ───────────────────────────────────────────────────────────────────
export function BulkBar({ count, busy, actions, onClear }: {
  count: number
  busy: boolean
  actions: {
    label: string
    variant?: 'primary' | 'success' | 'teal' | 'danger-soft' | 'warn-soft'
    onClick: () => void
  }[]
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary-bg border-b border-[0.5px] border-[#B5D4F4] dark:border-[#1A3A5C] flex-wrap">
      <span className="text-[11px] font-medium text-primary flex items-center gap-1.5 shrink-0">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" rx="2" opacity=".2"/>
          <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map(a => (
          <Btn key={a.label} size="sm" variant={a.variant ?? 'default'} onClick={a.onClick} disabled={busy}>
            {busy ? '...' : a.label}
          </Btn>
        ))}
        <button
          onClick={onClear}
          className="text-[11px] text-muted hover:text-base transition-colors cursor-pointer bg-transparent border-none px-1"
        >
          Limpar seleção
        </button>
      </div>
    </div>
  )
}
