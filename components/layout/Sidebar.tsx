'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useAuth } from '@/components/providers/AuthProvider'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  acao: string
  somentePerfis?: readonly Perfil[]
}

const navItems: { section: string; items: NavItem[] }[] = [
  {
    section: 'Principal',
    items: [
      { href: '/',          label: 'Dashboard',    acao: 'dashboard'  },
      { href: '/rotas',     label: 'Rotas do dia', acao: 'rotas'      },
      { href: '/historico', label: 'Histórico',    acao: 'historico'  },
      { href: '/frota',     label: 'Frota',        acao: 'frota'      },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/aprovacoes',    label: 'Aprovações',    acao: 'aprovar',       somentePerfis: ['owner', 'administrador'] },
      { href: '/configuracoes', label: 'Configurações', acao: 'configuracoes' },
    ],
  },
]

type ReactNode = import('react').ReactNode

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
  '/aprovacoes': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M4 8h8M6 12h4"/>
    </svg>
  ),
  '/frota': (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="8" width="8" height="5" rx="1"/>
      <path d="M9 10h2l2-2.5V13H9V10z"/>
      <circle cx="3.5" cy="13.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="5" cy="4.5" r="2"/>
      <circle cx="11" cy="4.5" r="1.5" strokeWidth="1.3"/>
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
  const { usuario, pode } = useAuth()
  const [aguardandoCount, setAguardandoCount] = useState(0)

  useEffect(() => {
    async function fetchCount() {
      try {
        const sb = getSupabaseBrowser()
        const { count } = await sb
          .from('rotas')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aguardando')
        setAguardandoCount(count ?? 0)
      } catch {
        // fail silently
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    return () => clearInterval(id)
  }, [])

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
          <div className="text-[13px] font-medium text-base tracking-[-0.01em]">Concarga</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 py-2.5 flex-1 flex flex-col">
        {navItems.map(group => {
          const itensVisiveis = group.items.filter(item => {
            if (!pode(item.acao)) return false
            if (item.somentePerfis && (!usuario?.perfil || !item.somentePerfis.includes(usuario.perfil as Perfil))) return false
            return true
          })
          if (itensVisiveis.length === 0) return null
          return (
            <div key={group.section} className="mb-1">
              <div className="text-[9px] text-dim px-2.5 pt-2 pb-1 uppercase tracking-[0.06em] font-medium">
                {group.section}
              </div>
              {itensVisiveis.map(item => {
                const active = item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href) ||
                    (item.href === '/aprovacoes' && pathname.startsWith('/rotas/acoes'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors duration-100',
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
                    {(item.href === '/rotas' || item.href === '/aprovacoes') && aguardandoCount > 0 && (
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium shrink-0 bg-warn-bg text-warn">
                        {aguardandoCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-[0.5px] border-[var(--border-subtle)]">
        {/* Seção Conta */}
        {usuario && (
          <div className="mb-0.5">
            <div className="text-[9px] text-dim px-2.5 pt-2 pb-1 uppercase tracking-[0.06em] font-medium">
              Conta
            </div>
            <Link
              href="/perfil"
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors duration-100',
                'border-l-[2.5px]',
                pathname.startsWith('/perfil')
                  ? 'bg-cream text-base font-medium border-primary'
                  : 'text-muted font-normal border-transparent hover:bg-cream hover:text-base',
              )}
            >
              <span className={cn('shrink-0', pathname.startsWith('/perfil') ? 'text-primary' : 'text-subtle')}>
                <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary overflow-hidden">
                  {usuario.avatarUrl
                    ? <img src={usuario.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : (usuario.nome ?? usuario.email).charAt(0).toUpperCase()
                  }
                </div>
              </span>
              <span className="flex-1 truncate">{usuario.nome || usuario.email}</span>
            </Link>
          </div>
        )}

        {/* Tema + SIAT — linha compacta */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cond-ok opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cond-ok" />
            </span>
            <span className="text-[10px] text-mid font-mono">SIAT</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
