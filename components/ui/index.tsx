'use client'
import type { ReactNode, CSSProperties } from 'react'
import { RouteStatus, CondStatus } from '@/types'
import { cn, formatPeso } from '@/lib/utils'

// ── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="h-[46px] bg-surface border-b border-[0.5px] border-[var(--border-subtle)] flex items-center justify-between px-5 shrink-0 gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium tracking-[-0.01em] text-base">{title}</div>
        {sub && <div className="text-[10px] text-muted mt-px">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="h-px bg-[var(--border-subtle)]" />
}

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'success' | 'teal' | 'danger-soft' | 'warn-soft'

const BV: Record<BtnVariant, string> = {
  'default':     'bg-surface text-base border-[var(--border-btn)]',
  'primary':     'bg-brand text-brand-fg border-brand',
  'success':     'bg-success text-success-bg border-success',
  'teal':        'bg-teal text-teal-bg border-teal',
  'danger-soft': 'bg-danger-bg text-danger border-danger-border',
  'warn-soft':   'bg-warn-bg text-warn border-warn-border',
}

export function Btn({
  children, variant = 'default', onClick, disabled, style, size = 'md',
}: {
  children: ReactNode; variant?: BtnVariant; onClick?: () => void;
  disabled?: boolean; style?: CSSProperties; size?: 'sm' | 'md'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={cn(
        'inline-flex items-center gap-[5px] rounded-lg font-medium font-sans border border-[0.5px]',
        'transition-[filter,transform] duration-100',
        'hover:brightness-95 active:scale-[0.98]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        size === 'sm' ? 'px-[11px] py-1 text-[11px]' : 'px-3.5 py-[5px] text-xs',
        BV[variant],
      )}
    >
      {children}
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, className }: {
  children: ReactNode; style?: CSSProperties; className?: string
}) {
  return (
    <div
      className={cn('bg-surface border border-[0.5px] border-[var(--border-card)] rounded-lg overflow-hidden', className)}
      style={style}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-[10px] border-b border-[0.5px] border-[var(--border-subtle)]', className)}>
      {children}
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, valueColor, capacity, className, delta, inactiveCount, gradientBar, cta }: {
  label: string; value: string | number; sub?: string; valueColor?: string
  capacity?: { used: number; total: number; label: string }
  className?: string
  delta?: number
  inactiveCount?: number
  gradientBar?: boolean
  cta?: { label: string; href: string }
}) {
  const pct      = capacity ? Math.min(100, Math.round((capacity.used / capacity.total) * 100)) : null
  const barColor = pct === null ? '' : pct >= 90 ? 'bg-cond-err' : pct >= 70 ? 'bg-cond-warn' : 'bg-cond-ok'
  const pctColor = pct === null ? '' : pct >= 90 ? 'text-danger-mid' : pct >= 70 ? 'text-warn-mid' : 'text-success'

  return (
    <div className={cn('bg-cream border border-[0.5px] border-[var(--border-subtle)] rounded-lg p-3', className)}>
      <div className="text-[11px] text-muted mb-1 uppercase tracking-[0.03em]">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div
          className="text-[22px] font-medium tracking-[-0.02em] text-base"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
        {inactiveCount !== undefined && inactiveCount > 0 && (
          <span className="text-[11px] text-warn-mid font-medium">· {inactiveCount} inativos</span>
        )}
        {delta !== undefined && (
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-px rounded-full',
            delta > 0 ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success-dark',
          )}>
            {delta > 0 ? `+${delta}` : delta} vs ontem
          </span>
        )}
      </div>
      {capacity && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted">{capacity.label}</span>
            <span className={cn('text-[11px] font-medium', pctColor)}>{pct}%</span>
          </div>
          <div className="h-[3px] bg-cream-hover rounded-full overflow-hidden">
            {gradientBar ? (
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%`, background: 'linear-gradient(to right, var(--color-success), var(--color-warn-accent))' }}
              />
            ) : (
              <div
                className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>
      )}
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      {cta && (
        <a href={cta.href} className="text-[11px] text-primary font-medium mt-1.5 block hover:underline">{cta.label}</a>
      )}
    </div>
  )
}

// ── Status Pill ───────────────────────────────────────────────────────────────
const PILL: Record<RouteStatus, { pill: string; dot: string; label: string }> = {
  rascunho:   { pill: 'bg-cream text-mid',               dot: 'bg-subtle',    label: 'rascunho' },
  aguardando: { pill: 'bg-warn-bg text-warn',            dot: 'bg-cond-warn', label: 'aguardando' },
  aprovada:   { pill: 'bg-success-bg text-success-dark', dot: 'bg-cond-ok',   label: 'aprovada' },
  enviada:    { pill: 'bg-primary-bg text-primary-dark', dot: 'bg-primary',   label: 'enviada' },
  rejeitada:  { pill: 'bg-danger-bg text-danger',        dot: 'bg-cond-err',  label: 'rejeitada' },
}

export function StatusPill({ status }: { status: RouteStatus }) {
  const c = PILL[status]
  return (
    <span className={cn('inline-flex items-center gap-[5px] px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', c.pill)}>
      <span className={cn('w-[5px] h-[5px] rounded-full shrink-0', c.dot)} />
      {c.label}
    </span>
  )
}

// Pedido do Marcelo (11/08/26, item 6): cor de status na LINHA da tabela, não
// numa coluna à parte. Reaproveita as mesmas classes de fundo do PILL acima.
export function statusRowBg(status: RouteStatus): string {
  return PILL[status]?.pill ?? ''
}

// ── Cond Dot ─────────────────────────────────────────────────────────────────
const COND_DOT: Record<CondStatus, string> = { ok: 'bg-cond-ok', laranja: 'bg-cond-warn', vermelho: 'bg-cond-err' }
const COND_LBL: Record<CondStatus, string> = { ok: 'Ok', laranja: 'Laran.', vermelho: 'Verm.' }

export function CondDot({ cond, label }: { cond: CondStatus; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', COND_DOT[cond])} />
      {label && <span className="text-[11px] text-mid">{COND_LBL[cond]}</span>}
    </span>
  )
}

// ── Weight Bar ────────────────────────────────────────────────────────────────
export function WeightBar({ peso, capacidade }: { peso: number; capacidade: number }) {
  const pct      = Math.min(100, Math.round((peso / capacidade) * 100))
  const isOver   = pct >= 95
  const isHigh   = pct >= 80
  const barColor = isOver ? 'bg-danger-mid' : isHigh ? 'bg-warn-mid' : 'bg-primary'
  const txtColor = isOver ? 'text-danger-mid' : isHigh ? 'text-warn-mid' : 'text-base'

  return (
    <div className="min-w-[60px]">
      <div className={cn('text-xs font-medium', txtColor)}>{formatPeso(peso)}</div>
      <div className="text-[10px] text-muted">{pct}% · {formatPeso(capacidade)}</div>
      <div className="h-[3px] bg-cream-hover rounded-full overflow-hidden w-14 mt-1">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Import Bar ────────────────────────────────────────────────────────────────
export function ImportBar({ running, step, progress, result, onClose }: {
  running: boolean; step: string; progress: number;
  result?: { nfs: number; peso: number; veiculos: number }; onClose?: () => void
}) {
  const hasError = !running && !result && step.startsWith('Falha')
  if (!running && !result && !hasError) return null
  const done = progress >= 100

  if (hasError) {
    return (
      <div className="animate-fade-in bg-surface rounded-lg px-4 py-3 flex items-center gap-3.5 border border-[0.5px] border-danger-border">
        <svg className="w-[18px] h-[18px] text-danger shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-danger">{step}</div>
          <div className="text-[11px] text-muted mt-0.5">Verifique se o workflow está ativo no n8n e tente novamente.</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted text-lg px-1 leading-none rounded-md hover:text-base transition-colors">×</button>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      'animate-fade-in bg-surface rounded-lg px-4 py-3 flex items-center gap-3.5',
      'border border-[0.5px]',
      done ? 'border-success-border' : 'border-[#B5D4F4] dark:border-[#1A3A5C]',
    )}>
      {!done ? (
        <svg className="w-[18px] h-[18px] text-primary shrink-0 animate-spin-slow" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20"/>
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px] text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      )}

      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-medium', done ? 'text-success-dark' : 'text-primary')}>{step}</div>
        <div className="h-[3px] bg-cream rounded-full mt-1.5 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-[width] duration-[400ms] ease-out', done ? 'bg-cond-ok' : 'bg-primary')}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {result && (
        <div className="flex gap-5 shrink-0">
          {([
            { val: result.nfs,                    lbl: 'NFs' },
            { val: formatPeso(result.peso * 1000), lbl: 'peso' },
            { val: result.veiculos,               lbl: 'veículos' },
          ] as const).map(m => (
            <div key={m.lbl} className="text-center">
              <div className="text-sm font-medium text-success">{m.val}</div>
              <div className="text-[10px] text-muted">{m.lbl}</div>
            </div>
          ))}
        </div>
      )}

      {done && onClose && (
        <button
          onClick={onClose}
          className="bg-transparent border-none cursor-pointer text-muted text-lg px-1 leading-none rounded-md hover:text-base transition-colors"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Field Row ─────────────────────────────────────────────────────────────────
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted w-[130px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

// ── Text Input ────────────────────────────────────────────────────────────────
export function TextInput({ value, onChange, placeholder, mono, type, style, disabled }: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; type?: string; style?: CSSProperties; disabled?: boolean
}) {
  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      className={cn(
        'w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-[11px] text-base',
        'outline-none transition-[border-color] duration-100',
        'focus:border-primary focus:bg-white dark:focus:bg-cream',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        mono ? 'font-mono text-[11px]' : 'font-sans text-xs',
      )}
    />
  )
}

// ── Text Area ─────────────────────────────────────────────────────────────────
export function TextArea({ value, onChange, placeholder, mono, rows, className }: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; rows?: number; className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows || 4}
      className={cn(
        'w-full border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-[11px] py-2 text-base',
        'leading-relaxed resize-y outline-none',
        'transition-[border-color] duration-100',
        'focus:border-primary focus:bg-white dark:focus:bg-cream',
        mono ? 'font-mono text-[10px]' : 'font-sans text-xs',
        className,
      )}
    />
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, children, className }: {
  value: string; onChange: (v: string) => void; children: ReactNode; className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-[11px]',
        'text-xs text-base font-sans outline-none cursor-pointer',
        'transition-[border-color] duration-100',
        'focus:border-primary',
        className,
      )}
    >
      {children}
    </select>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 px-6 text-subtle text-[13px]">{message}</div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export interface ConfirmAction {
  title: string
  description?: string
  details?: { label: string; value: string }[]
  confirmLabel?: string
  confirmVariant?: 'primary' | 'success' | 'danger-soft' | 'warn-soft'
  warning?: string
}

const CI: Record<string, { bg: string; stroke: string }> = {
  'primary':     { bg: 'bg-primary-bg',  stroke: 'stroke-primary' },
  'success':     { bg: 'bg-success-bg',  stroke: 'stroke-success' },
  'danger-soft': { bg: 'bg-danger-bg',   stroke: 'stroke-danger' },
  'warn-soft':   { bg: 'bg-warn-bg',     stroke: 'stroke-warn-mid' },
}

export function ConfirmDialog({ action, onConfirm, onClose }: {
  action: ConfirmAction; onConfirm: () => void; onClose: () => void
}) {
  const variant  = action.confirmVariant ?? 'primary'
  const icon     = CI[variant]
  const isCheck  = variant === 'success'
  const isDanger = variant === 'danger-soft'

  return (
    <div
      className="fixed inset-0 bg-black/55 z-[200] flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in bg-surface rounded-xl border border-[0.5px] border-[var(--border-light)] w-[420px] max-w-[92vw]">
        <div className="px-5 pt-[18px] pb-3.5 border-b border-[0.5px] border-[var(--border-subtle)]">
          <div className="flex items-start gap-3">
            <div className={cn('w-8 h-8 rounded-lg shrink-0 flex items-center justify-center', icon.bg)}>
              <svg className={cn('w-[15px] h-[15px]', icon.stroke)} viewBox="0 0 16 16" fill="none" strokeWidth="1.6">
                {isCheck
                  ? <path d="M3 8l3.5 3.5L13 5"/>
                  : isDanger
                  ? <><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10.5v.5"/></>
                  : <><circle cx="8" cy="8" r="6"/><path d="M8 7v3M8 5.5v.5"/></>}
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-medium">{action.title}</div>
              {action.description && (
                <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{action.description}</div>
              )}
            </div>
          </div>
        </div>

        {action.details && action.details.length > 0 && (
          <div className="px-5 py-3 border-b border-[0.5px] border-[var(--border-subtle)] flex flex-col gap-[7px]">
            {action.details.map(d => (
              <div key={d.label} className="flex gap-2.5 text-xs">
                <span className="text-muted w-[120px] shrink-0">{d.label}</span>
                <span className="font-medium text-base">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mx-5 my-3 bg-warn-bg border border-[0.5px] border-warn-border rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] text-warn">
          <span className="bg-warn-accent text-white text-[9px] font-bold px-[5px] py-px rounded-[3px] tracking-[0.05em] shrink-0">SIM</span>
          {action.warning ?? 'Modo simulação — nenhum dado real será alterado.'}
        </div>

        <div className="px-5 pb-4 pt-3 flex gap-2 justify-end">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant={variant} onClick={() => { onConfirm(); onClose() }}>
            {action.confirmLabel ?? 'Confirmar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
