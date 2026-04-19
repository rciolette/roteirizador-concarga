'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    section: 'Principal',
    items: [
      { href: '/',          label: 'Dashboard',     badge: '3', badgeType: 'danger' as const },
      { href: '/rotas',     label: 'Rotas do dia',  badge: '5', badgeType: 'warn'   as const },
      { href: '/historico', label: 'Histórico' },
    ]
  },
  {
    section: 'Sistema',
    items: [
      { href: '/configuracoes', label: 'Configurações' },
    ]
  }
]

const icons: Record<string, React.ReactNode> = {
  '/': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="5" rx="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.5"/>
    </svg>
  ),
  '/rotas': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h10"/>
    </svg>
  ),
  '/historico': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2.5 2"/>
    </svg>
  ),
  '/configuracoes': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/>
    </svg>
  ),
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 180,
      flexShrink: 0,
      background: '#fff',
      borderRight: '0.5px solid rgba(44,44,42,0.1)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 18px 14px', borderBottom: '0.5px solid rgba(44,44,42,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#E6F1FB" strokeWidth="1.8">
              <path d="M2 8l4-5 4 5 4-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', letterSpacing: '-0.01em' }}>Concarga</div>
            <div style={{ fontSize: 9, color: '#B4B2A9', marginTop: 0 }}>Roteirizador v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(group => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 9, color: '#C4C2B9', padding: '8px 10px 4px',
              letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500,
            }}>
              {group.section}
            </div>
            {group.items.map(item => {
              const active = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    color: active ? '#2C2C2A' : '#888780',
                    fontWeight: active ? 500 : 400,
                    background: active ? '#F1EFE8' : 'transparent',
                    borderLeft: active ? '2.5px solid #185FA5' : '2.5px solid transparent',
                  }}
                >
                  <span style={{ color: active ? '#185FA5' : '#B4B2A9', flexShrink: 0 }}>
                    {icons[item.href]}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 20, fontWeight: 500,
                      background: item.badgeType === 'danger' ? '#FCEBEB' : '#FAEEDA',
                      color: item.badgeType === 'danger' ? '#791F1F' : '#633806',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 18px',
        borderTop: '0.5px solid rgba(44,44,42,0.08)',
      }}>
        <div style={{ fontSize: 10, color: '#B4B2A9', marginBottom: 2 }}>Conectado a</div>
        <div style={{ fontSize: 11, color: '#5F5E5A', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          siat.dyndns.info
        </div>
      </div>
    </aside>
  )
}
