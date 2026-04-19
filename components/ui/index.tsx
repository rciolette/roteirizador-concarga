'use client'
import { RouteStatus, CondStatus } from '@/types'
import { formatPeso } from '@/lib/data'

// ── Topbar ──────────────────────────────────────────────────────────────────
export function Topbar({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      height: 54, background: '#fff',
      borderBottom: '0.5px solid rgba(44,44,42,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0,
      gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: '0.5px', background: 'rgba(44,44,42,0.08)', margin: '0 -24px' }} />
}

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'success' | 'teal' | 'danger-soft' | 'warn-soft'
const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  default:       { background: '#fff',    color: '#2C2C2A', border: '0.5px solid rgba(44,44,42,0.25)' },
  primary:       { background: '#185FA5', color: '#E6F1FB', border: '0.5px solid #185FA5' },
  success:       { background: '#3B6D11', color: '#EAF3DE', border: '0.5px solid #3B6D11' },
  teal:          { background: '#0F6E56', color: '#E1F5EE', border: '0.5px solid #0F6E56' },
  'danger-soft': { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F09595' },
  'warn-soft':   { background: '#FAEEDA', color: '#633806', border: '0.5px solid #FAC775' },
}

export function Btn({
  children, variant = 'default', onClick, disabled, style, size = 'md'
}: {
  children: React.ReactNode
  variant?: BtnVariant
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
  size?: 'sm' | 'md'
}) {
  return (
    <button
      className="btn-base"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: size === 'sm' ? '4px 11px' : '6px 14px',
        borderRadius: 8,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'var(--font-sans)',
        ...btnStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid rgba(44,44,42,0.11)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(44,44,42,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 16px',
      borderBottom: '0.5px solid rgba(44,44,42,0.08)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
export function MetricCard({
  label, value, sub, valueColor
}: { label: string; value: string | number; sub?: string; valueColor?: string }) {
  return (
    <div style={{
      background: '#F3F2EE',
      borderRadius: 10,
      padding: '12px 16px',
      border: '0.5px solid rgba(44,44,42,0.07)',
    }}>
      <div style={{ fontSize: 10, color: '#888780', marginBottom: 4, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: valueColor || '#2C2C2A', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Pill ─────────────────────────────────────────────────────────────────────
const pillConfig: Record<RouteStatus, { bg: string; color: string; dot: string; label: string }> = {
  rascunho:   { bg: '#F1EFE8', color: '#5F5E5A', dot: '#B4B2A9', label: 'rascunho' },
  aguardando: { bg: '#FAEEDA', color: '#633806', dot: '#EF9F27', label: 'aguardando' },
  aprovada:   { bg: '#EAF3DE', color: '#27500A', dot: '#639922', label: 'aprovada' },
  enviada:    { bg: '#E6F1FB', color: '#0C447C', dot: '#185FA5', label: 'enviada' },
}

export function StatusPill({ status }: { status: RouteStatus }) {
  const c = pillConfig[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

// ── Cond Dot ─────────────────────────────────────────────────────────────────
const condColors: Record<CondStatus, string> = {
  ok:       '#639922',
  laranja:  '#EF9F27',
  vermelho: '#E24B4A',
}

export function CondDot({ cond, label }: { cond: CondStatus; label?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6,
        borderRadius: '50%', background: condColors[cond], flexShrink: 0,
      }} />
      {label && (
        <span style={{ fontSize: 11, color: '#5F5E5A' }}>
          {cond === 'ok' ? 'Ok' : cond === 'laranja' ? 'Laran.' : 'Verm.'}
        </span>
      )}
    </span>
  )
}

// ── Weight Bar ────────────────────────────────────────────────────────────────
export function WeightBar({ peso, capacidade }: { peso: number; capacidade: number }) {
  const pct = Math.min(100, Math.round((peso / capacidade) * 100))
  const color = pct >= 95 ? '#A32D2D' : pct >= 80 ? '#854F0B' : '#185FA5'
  const textColor = pct >= 95 ? '#A32D2D' : pct >= 80 ? '#854F0B' : '#2C2C2A'
  return (
    <div style={{ minWidth: 60 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{formatPeso(peso)}</div>
      <div style={{ fontSize: 10, color: '#888780' }}>{pct}% · {formatPeso(capacidade)}</div>
      <div style={{ height: 3, background: '#ECEAE3', borderRadius: 2, overflow: 'hidden', width: 56, marginTop: 4 }}>
        <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ── Import Status Bar ─────────────────────────────────────────────────────────
export function ImportBar({
  running, step, progress, result, onClose
}: {
  running: boolean
  step: string
  progress: number
  result?: { nfs: number; peso: number; veiculos: number }
  onClose?: () => void
}) {
  if (!running && !result) return null
  const done = progress >= 100

  return (
    <div className="animate-fade-in" style={{
      background: '#fff',
      border: `0.5px solid ${done ? '#97C459' : '#B5D4F4'}`,
      borderRadius: 10,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 1px 3px rgba(44,44,42,0.04)',
    }}>
      {!done ? (
        <svg style={{ width: 18, height: 18, color: '#185FA5', flexShrink: 0 }} className="animate-spin-slow" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20"/>
        </svg>
      ) : (
        <svg style={{ width: 18, height: 18, color: '#3B6D11', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: done ? '#27500A' : '#185FA5' }}>{step}</div>
        <div style={{ height: 3, background: '#F1EFE8', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 0.4s ease',
            background: done ? '#639922' : '#185FA5',
            width: `${progress}%`,
          }} />
        </div>
      </div>

      {result && (
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { val: result.nfs, lbl: 'NFs' },
            { val: formatPeso(result.peso * 1000), lbl: 'peso' },
            { val: result.veiculos, lbl: 'veículos' },
          ].map(m => (
            <div key={m.lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>{m.val}</div>
              <div style={{ fontSize: 10, color: '#888780' }}>{m.lbl}</div>
            </div>
          ))}
        </div>
      )}

      {done && onClose && (
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#888780', fontSize: 18, padding: '0 4px', lineHeight: 1,
          borderRadius: 4,
        }}>×</button>
      )}
    </div>
  )
}

// ── Field Row ─────────────────────────────────────────────────────────────────
export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, color: '#888780', width: 130, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// ── Text Input ────────────────────────────────────────────────────────────────
export function TextInput({
  value, onChange, placeholder, mono, type, style, disabled
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; type?: string; style?: React.CSSProperties; disabled?: boolean
}) {
  return (
    <input
      className="input-field"
      type={type || 'text'}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', height: 32,
        border: '0.5px solid rgba(44,44,42,0.2)',
        borderRadius: 8,
        background: '#F8F8F6',
        padding: '0 11px',
        fontSize: mono ? 11 : 12,
        color: '#2C2C2A',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        ...style,
      }}
    />
  )
}

// ── Text Area ─────────────────────────────────────────────────────────────────
export function TextArea({
  value, onChange, placeholder, mono, rows
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; rows?: number
}) {
  return (
    <textarea
      className="input-field"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows || 4}
      style={{
        width: '100%',
        border: '0.5px solid rgba(44,44,42,0.2)',
        borderRadius: 8,
        background: '#F8F8F6',
        padding: '8px 11px',
        fontSize: mono ? 10 : 12,
        color: '#2C2C2A',
        lineHeight: 1.6,
        resize: 'vertical',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      }}
    />
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({
  value, onChange, children, style
}: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <select
      className="input-field"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 32,
        border: '0.5px solid rgba(44,44,42,0.2)',
        borderRadius: 8,
        background: '#F8F8F6',
        padding: '0 11px',
        fontSize: 12,
        color: '#2C2C2A',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      color: '#B4B2A9', fontSize: 13,
    }}>
      {message}
    </div>
  )
}

// ── Mock Banner ───────────────────────────────────────────────────────────────
export function MockBanner() {
  return (
    <div style={{
      background: '#FAEEDA',
      borderBottom: '0.5px solid #FAC775',
      padding: '6px 24px',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11, color: '#633806', flexShrink: 0,
    }}>
      <span style={{
        background: '#F6A623', color: '#fff',
        fontSize: 9, fontWeight: 700, padding: '1px 6px',
        borderRadius: 4, letterSpacing: '0.05em',
      }}>SIMULAÇÃO</span>
      <span>Modo mock ativo — nenhuma ação envia dados reais ao SIAT ou a qualquer sistema externo.</span>
    </div>
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

export function ConfirmDialog({
  action, onConfirm, onClose,
}: {
  action: ConfirmAction
  onConfirm: () => void
  onClose: () => void
}) {
  const variant = action.confirmVariant ?? 'primary'
  const iconColor: Record<string, string> = {
    primary: '#185FA5', success: '#3B6D11',
    'danger-soft': '#791F1F', 'warn-soft': '#633806',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in" style={{
        background: '#fff', borderRadius: 12,
        border: '0.5px solid rgba(44,44,42,0.15)',
        width: 420, maxWidth: '92vw',
        boxShadow: '0 8px 32px rgba(44,44,42,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(44,44,42,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: variant === 'danger-soft' ? '#FCEBEB' : variant === 'warn-soft' ? '#FAEEDA' : '#E6F1FB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                stroke={iconColor[variant]} strokeWidth="1.6">
                {variant === 'danger-soft'
                  ? <><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10.5v.5"/></>
                  : variant === 'success'
                  ? <path d="M3 8l3.5 3.5L13 5"/>
                  : <><circle cx="8" cy="8" r="6"/><path d="M8 7v3M8 5.5v.5"/></>
                }
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{action.title}</div>
              {action.description && (
                <div style={{ fontSize: 11, color: '#888780', marginTop: 3, lineHeight: 1.5 }}>
                  {action.description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        {action.details && action.details.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '0.5px solid rgba(44,44,42,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {action.details.map(d => (
                <div key={d.label} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#888780', width: 120, flexShrink: 0 }}>{d.label}</span>
                  <span style={{ fontWeight: 500, color: '#2C2C2A' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation warning */}
        <div style={{
          margin: '12px 20px',
          background: '#FAEEDA', border: '0.5px solid #FAC775',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: '#633806',
        }}>
          <span style={{
            background: '#F6A623', color: '#fff', fontSize: 9,
            fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            letterSpacing: '0.05em', flexShrink: 0,
          }}>SIM</span>
          {action.warning ?? 'Modo simulação — nenhum dado real será alterado.'}
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 20px 16px',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant={variant} onClick={() => { onConfirm(); onClose() }}>
            {action.confirmLabel ?? 'Confirmar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
