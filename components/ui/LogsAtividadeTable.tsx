'use client'
import { useEffect, useState } from 'react'
import { Card, CardHeader, Select } from '@/components/ui'
import { NOME_PERFIL, type Perfil } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface UsuarioResumo {
  id:             string
  email:          string
  nome:           string | null
  perfil:         Perfil
  ativo:          boolean
  criadoEm:       string
  primeiroAcesso: string | null
  ultimoAcesso:   string | null
}

interface Evento {
  id:          string
  user_id:     string | null
  user_email:  string | null
  user_perfil: Perfil | null
  evento:      string
  area:        string | null
  descricao:   string | null
  ip:          string | null
  user_agent:  string | null
  criado_em:   string
}

const AREA_LABELS: Record<string, string> = {
  sessao:        'Sessão',
  usuarios:      'Usuários',
  convites:      'Convites',
  empresa:       'Empresa',
  configuracoes: 'Configurações',
  webhooks:      'Webhooks',
}

const EVENTO_LABELS: Record<string, { label: string; cls: string }> = {
  login:   { label: 'Login',   cls: 'bg-success-bg text-success-dark' },
  logout:  { label: 'Logout',  cls: 'bg-cream text-mid' },
  criar:   { label: 'Criação', cls: 'bg-primary-bg text-primary-dark' },
  editar:  { label: 'Edição',  cls: 'bg-warn-bg text-warn' },
  excluir: { label: 'Exclusão', cls: 'bg-danger-bg text-danger' },
}

const LIMIT = 50

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function LogsAtividadeTable() {
  const [usuarios,     setUsuarios]     = useState<UsuarioResumo[]>([])
  const [eventos,      setEventos]      = useState<Evento[]>([])
  const [totalEventos, setTotalEventos] = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroArea,    setFiltroArea]    = useState('')

  async function load(offset: number, append: boolean) {
    append ? setLoadingMore(true) : setLoading(true)
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
    if (filtroUsuario) params.set('userId', filtroUsuario)
    if (filtroArea)    params.set('area', filtroArea)
    try {
      const res = await fetch(`/api/logs?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setUsuarios(data.usuarios ?? [])
        setEventos(prev => append ? [...prev, ...(data.eventos ?? [])] : (data.eventos ?? []))
        setTotalEventos(data.totalEventos ?? 0)
      }
    } catch { /* ignore */ } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => { load(0, false) }, [filtroUsuario, filtroArea]) // eslint-disable-line react-hooks/exhaustive-deps

  const thCls = 'text-left text-[10px] text-muted font-medium px-3 py-2 border-b border-[0.5px] border-[var(--border-subtle)] bg-page uppercase tracking-wide whitespace-nowrap'
  const tdCls = 'px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px] align-middle'

  return (
    <>
      {/* ── Usuários & acessos ── */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-xs font-medium">Usuários & acessos</div>
            <div className="text-[11px] text-muted mt-0.5">Criação da conta, primeiro e último acesso de cada usuário.</div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-6 text-xs text-muted">Carregando...</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Nome</th>
                  <th className={thCls}>E-mail</th>
                  <th className={thCls}>Perfil</th>
                  <th className={thCls}>Conta criada</th>
                  <th className={thCls}>Primeiro acesso</th>
                  <th className={thCls}>Último acesso</th>
                  <th className={cn(thCls, 'text-center')}>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] text-muted">Nenhum usuário encontrado.</td></tr>
                )}
                {usuarios.map((u, i) => (
                  <tr key={u.id} className={i % 2 === 0 ? 'bg-surface' : 'bg-page'}>
                    <td className={cn(tdCls, 'font-medium')}>{u.nome || '—'}</td>
                    <td className={cn(tdCls, 'text-muted')}>{u.email}</td>
                    <td className={tdCls}>{NOME_PERFIL[u.perfil]}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtData(u.criadoEm)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtData(u.primeiroAcesso)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtData(u.ultimoAcesso)}</td>
                    <td className={cn(tdCls, 'text-center')}>
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full', u.ativo ? 'bg-cond-ok' : 'bg-subtle')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── Eventos ── */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-xs font-medium">Eventos</div>
            <div className="text-[11px] text-muted mt-0.5">Login/logout e ações sensíveis (usuários, convites, empresa, configurações).</div>
          </div>
        </CardHeader>

        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-[0.5px] border-[var(--border-faint)]">
          <div className="w-[220px]">
            <Select value={filtroUsuario} onChange={setFiltroUsuario}>
              <option value="">Todos os usuários</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
            </Select>
          </div>
          <div className="w-[180px]">
            <Select value={filtroArea} onChange={setFiltroArea}>
              <option value="">Todas as áreas</option>
              {Object.entries(AREA_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </div>
          {!loading && (
            <span className="text-[10px] text-muted ml-auto">{eventos.length} de {totalEventos} evento{totalEventos !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-6 text-xs text-muted">Carregando...</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Data/hora</th>
                  <th className={thCls}>Usuário</th>
                  <th className={thCls}>Área</th>
                  <th className={thCls}>Evento</th>
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>IP</th>
                </tr>
              </thead>
              <tbody>
                {eventos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-muted">Nenhum evento registrado ainda.</td></tr>
                )}
                {eventos.map((e, i) => {
                  const ev = EVENTO_LABELS[e.evento] ?? { label: e.evento, cls: 'bg-cream text-mid' }
                  return (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-surface' : 'bg-page'}>
                      <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtData(e.criado_em)}</td>
                      <td className={tdCls}>{e.user_email ?? '—'}</td>
                      <td className={tdCls}>{e.area ? (AREA_LABELS[e.area] ?? e.area) : '—'}</td>
                      <td className={tdCls}>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap', ev.cls)}>{ev.label}</span>
                      </td>
                      <td className={cn(tdCls, 'max-w-[280px]')}>
                        <span className="truncate block" title={e.descricao ?? ''}>{e.descricao ?? '—'}</span>
                      </td>
                      <td className={cn(tdCls, 'text-muted whitespace-nowrap')} title={e.user_agent ?? ''}>{e.ip ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && eventos.length < totalEventos && (
          <div className="px-4 py-3 border-t border-[0.5px] border-[var(--border-faint)] flex justify-center">
            <button
              onClick={() => load(eventos.length, true)}
              disabled={loadingMore}
              className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : `Ver mais (${totalEventos - eventos.length} restantes)`}
            </button>
          </div>
        )}
      </Card>
    </>
  )
}
