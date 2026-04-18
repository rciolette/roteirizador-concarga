'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    section: 'Principal',
    items: [
      { href: '/', label: 'Dashboard', badge: '3', badgeType: 'danger' as const },
      { href: '/rotas', label: 'Rotas do dia', badge: '5', badgeType: 'warn' as const },
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

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 172,
      flexShrink: 0,
      background: '#fff',
      borderRight: '0.5px solid rgba(44,44,42,0.12)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid rgba(44,44,42,0.1)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2A' }}>Concarga</div>
        <div style={{ fontSize: 10, color: '#888780', marginTop: 2 }}>Roteirizador v1.0</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {navItems.map(group => (
          <div key={group.section}>
            <div style={{
              fontSize: 10, color: '#B4B2A9', padding: '10px 16px 4px',
              letterSpacing: '0.04em', textTransform: 'uppercase'
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px',
                    fontSize: 12,
                    color: active ? '#2C2C2A' : '#888780',
                    fontWeight: active ? 500 : 400,
                    background: active ? '#F1EFE8' : 'transparent',
                    borderLeft: active ? '2px solid #185FA5' : '2px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 500,
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
        padding: '12px 16px',
        borderTop: '0.5px solid rgba(44,44,42,0.1)',
        fontSize: 10,
        color: '#B4B2A9'
      }}>
        SIAT: siat.dyndns.info
      </div>
    </aside>
  )
}
