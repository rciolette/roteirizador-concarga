'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils'

const navItems = [
  {
    section: 'Principal',
    items: [
      { href: '/',          label: 'Dashboard',        badge: '3', badgeType: 'danger' as const },
      { href: '/rotas',     label: 'Rotas do dia',     badge: '5', badgeType: 'warn'   as const },
      { href: '/historico', label: 'Histórico' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/rotas/acoes',    label: 'Aprovações' },
      { href: '/configuracoes', label: 'Configurações' },
    ],
  },
]

const icons: Record<string, ReactNode> = {
  '/': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="5" rx="1.5"/>
      <rect x="9" y="2" width="5" height="5" rx="1.5"/>
      <rect x="2" y="9" width="5" height="5" rx="1.5"/>
      <rect x="9" y="9" width="5" height="5" rx="1.5"/>
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
  '/rotas/acoes': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M4 8h8M6 12h4"/>
    </svg>
  ),
  '/configuracoes': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/>
    </svg>
  ),
}

type ReactNode = import('react').ReactNode

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[172px] shrink-0 bg-white dark:bg-[#1E1E1C] border-r border-[0.5px] border-[var(--border-subtle)] flex flex-col h-full">
      {/* Logo */}
      <div className="px-[18px] pt-4 pb-3.5 border-b border-[0.5px] border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-primary flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#E6F1FB" strokeWidth="1.8">
              <path d="M2 8l4-5 4 5 4-5"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-medium text-base tracking-[-0.01em]">Concarga</div>
            <div className="text-[9px] text-subtle">Roteirizador v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 py-2.5 flex-1 flex flex-col">
        {navItems.map(group => (
          <div key={group.section} className="mb-1">
            <div className="text-[9px] text-dim px-2.5 pt-2 pb-1 uppercase tracking-[0.06em] font-medium">
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
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-xs transition-colors duration-100',
                    'border-l-[2.5px]',
                    active
                      ? 'bg-cream text-base font-medium border-primary'
                      : 'text-muted font-normal border-transparent hover:bg-cream hover:text-base',
                  )}
                >
                  <span className={cn('shrink-0', active ? 'text-primary' : 'text-subtle')}>
                    {icons[item.href]}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-px rounded-full font-medium shrink-0',
                      item.badgeType === 'danger'
                        ? 'bg-danger-bg text-danger'
                        : 'bg-warn-bg text-warn',
                    )}>
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
      <div className="px-[18px] py-3 border-t border-[0.5px] border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] text-subtle">Tema</div>
          <ThemeToggle />
        </div>
        <div className="text-[10px] text-subtle mb-0.5">Conectado a</div>
        <div className="text-[11px] text-mid font-mono font-medium">siat.dyndns.info</div>
      </div>
    </aside>
  )
}
