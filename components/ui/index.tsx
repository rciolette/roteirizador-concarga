'use client'
import { RouteStatus, CondStatus } from '@/types'
import { formatPeso } from '@/lib/data'

// ── Topbar ──────────────────────────────────────────────────────────────────
export function Topbar({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      height: 46, background: '#fff', borderBottom: '0.5px solid rgba(44,44,42,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: '#888780' }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'success' | 'teal' | 'danger-soft' | 'warn-soft'
const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  default: { background: '#fff', color: '#2C2C2A', border: '0.5px solid rgba(44,44,42,0.25)' },
  primary: { background: '#185FA5', color: '#E6F1FB', border: '0.5px solid #185FA5' },
  success: { background: '#3B6D11', color: '#EAF3DE', border: '0.5px solid #3B6D11' },
  teal: { background: '#0F6E56', color: '#E1F5EE', border: '0.5px solid #0F6E56' },
  'danger-soft': { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F09595' },
  'warn-soft': { background: '#FAEEDA', color: '#633806', border: '0.5px solid #FAC775' },
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
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: size === 'sm' ? '4px 10px' : '5px 12px',
        borderRadius: 8,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.12s',
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
      border: '0.5px solid rgba(44,44,42,0.12)',
      borderRadius: 8,
      overflow: 'hidden',
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
      padding: '10px 14px',
      borderBottom: '0.5px solid rgba(44,44,42,0.1)',
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
      background: '#F1EFE8', borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: valueColor || '#2C2C2A' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#888780', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Pill ─────────────────────────────────────────────────────────────────────
const pillConfig: Record<RouteStatus, { bg: string; color: string; label: string }> = {
  rascunho: { bg: '#F1EFE8', color: '#5F5E5A', label: 'rascunho' },
  aguardando: { bg: '#FAEEDA', color: '#633806', label: 'aguardando' },
  aprovada: { bg: '#EAF3DE', color: '#27500A', label: 'aprovada' },
  enviada: { bg: '#E6F1FB', color: '#0C447C', label: 'enviada' },
}

export function StatusPill({ status }: { status: RouteStatus }) {
  const c = pillConfig[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

// ── Cond Dot ─────────────────────────────────────────────────────────────────
const condColors: Record<CondStatus, string> = {
  ok: '#639922',
  laranja: '#EF9F27',
  vermelho: '#E24B4A',
}

export function CondDot({ cond, label }: { cond: CondStatus; label?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6,
        borderRadius: '50%', background: condColors[cond], flexShrink: 0,
      }} />
      {label && <span style={{ fontSize: 11, color: '#5F5E5A' }}>
        {cond === 'ok' ? 'Ok' : cond === 'laranja' ? 'Laran.' : 'Verm.'}
      </span>}
    </span>
  )
}

// ── Weight Bar ────────────────────────────────────────────────────────────────
export function WeightBar({ peso, capacidade }: { peso: number; capacidade: number }) {
  const pct = Math.min(100, Math.round((peso / capacidade) * 100))
  const color = pct >= 95 ? '#A32D2D' : pct >= 80 ? '#854F0B' : '#185FA5'
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: pct >= 95 ? '#A32D2D' : pct >= 80 ? '#854F0B' : '#2C2C2A' }}>
        {formatPeso(peso)}
      </div>
      <div style={{ fontSize: 10, color: '#888780' }}>de {formatPeso(capacidade)}</div>
      <div style={{ height: 3, background: '#F1EFE8', borderRadius: 2, overflow: 'hidden', width: 56, marginTop: 3 }}>
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
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
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
        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#3B6D11' }}>{result.nfs}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>NFs</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{formatPeso(result.peso * 1000)}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>peso</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{result.veiculos}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>veículos</div>
          </div>
        </div>
      )}

      {done && onClose && (
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#888780', fontSize: 16, padding: '0 4px', lineHeight: 1,
        }}>×</button>
      )}
    </div>
  )
}

// ── Field Row ─────────────────────────────────────────────────────────────────
export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#888780', width: 120, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

export function TextInput({
  value, onChange, placeholder, mono, type, style, disabled
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; type?: string; style?: React.CSSProperties; disabled?: boolean
}) {
  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        flex: 1, height: 30,
        border: '0.5px solid rgba(44,44,42,0.2)',
        borderRadius: 8,
        background: '#F8F8F6',
        padding: '0 10px',
        fontSize: mono ? 11 : 12,
        color: '#2C2C2A',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        outline: 'none',
        ...style,
      }}
    />
  )
}

export function TextArea({
  value, onChange, placeholder, mono, rows
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  mono?: boolean; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows || 4}
      style={{
        flex: 1, width: '100%',
        border: '0.5px solid rgba(44,44,42,0.2)',
        borderRadius: 8, background: '#F8F8F6',
        padding: '8px 10px', fontSize: mono ? 10 : 12,
        color: '#2C2C2A', lineHeight: 1.6, resize: 'vertical',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        outline: 'none',
      }}
    />
  )
}
