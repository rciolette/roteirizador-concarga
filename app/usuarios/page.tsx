'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { NOME_PERFIL, type Perfil } from '@/lib/auth'

interface Usuario {
  id:       string
  email:    string
  perfil:   Perfil
  nome:     string | null
  ativo:    boolean
  criadoEm: string
}

interface Convite {
  id:       string
  email:    string
  perfil:   Perfil
  status:   string
  criadoEm: string
}

export default function UsuariosPage() {
  const { usuario } = useAuth()
  const [usuarios,  setUsuarios]  = useState<Usuario[]>([])
  const [convites,  setConvites]  = useState<Convite[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form,      setForm]      = useState({ email: '', nome: '', perfil: 'operador' as Perfil })
  const [enviando,  setEnviando]  = useState(false)
  const [msg,       setMsg]       = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const [rU, rC] = await Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch('/api/convites').then(r => r.json()),
    ])
    setUsuarios(rU.usuarios ?? [])
    setConvites((rC.convites ?? []).filter((c: Convite) => c.status === 'pendente'))
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function alterarPerfil(userId: string, perfil: Perfil) {
    await fetch('/api/usuarios', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, perfil }),
    })
    carregar()
  }

  async function alterarAtivo(userId: string, ativo: boolean) {
    await fetch('/api/usuarios', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, ativo }),
    })
    carregar()
  }

  async function convidar() {
    setEnviando(true)
    setMsg('')
    const res = await fetch('/api/convites', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('Convite enviado com sucesso.')
      setModalOpen(false)
      setForm({ email: '', nome: '', perfil: 'operador' })
      carregar()
    } else {
      setMsg(data.error ?? 'Erro ao enviar convite')
    }
    setEnviando(false)
  }

  async function cancelarConvite(id: string) {
    await fetch(`/api/convites?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  const perfisDisponiveis: Perfil[] = usuario?.perfil === 'owner'
    ? ['administrador', 'operador', 'visualizador']
    : ['operador', 'visualizador']

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[0.5px] border-[var(--border-subtle)]">
        <div>
          <h1 className="text-[14px] font-medium">Usuários</h1>
          <p className="text-[11px] text-muted">Gerencie os acessos ao sistema</p>
        </div>
        <button
          onClick={() => { setMsg(''); setModalOpen(true) }}
          className="px-3 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 transition-opacity border-none cursor-pointer"
        >
          Convidar usuário
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {msg && (
          <div className="text-[11px] text-primary bg-primary/10 rounded-lg px-3 py-2">{msg}</div>
        )}

        {/* Usuários ativos */}
        <section>
          <h2 className="text-[11px] font-medium text-muted uppercase tracking-wide mb-3">Usuários</h2>
          {loading ? (
            <p className="text-[11px] text-muted">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center gap-3 bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-4 py-3">
                  {/* Avatar placeholder */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[12px] font-medium text-primary">
                    {(u.nome ?? u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{u.nome || u.email}</div>
                    <div className="text-[10px] text-muted truncate">{u.nome ? u.email : ''}</div>
                  </div>

                  {/* Perfil */}
                  {u.perfil === 'owner' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                      Owner
                    </span>
                  ) : (
                    <select
                      value={u.perfil}
                      onChange={e => alterarPerfil(u.id, e.target.value as Perfil)}
                      className="text-[10px] px-2 py-0.5 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page outline-none cursor-pointer"
                    >
                      {perfisDisponiveis.map(p => (
                        <option key={p} value={p}>{NOME_PERFIL[p]}</option>
                      ))}
                    </select>
                  )}

                  {/* Ativo/inativo */}
                  {u.perfil !== 'owner' && (
                    <button
                      onClick={() => alterarAtivo(u.id, !u.ativo)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border-none cursor-pointer shrink-0 ${
                        u.ativo
                          ? 'bg-cond-ok/10 text-cond-ok'
                          : 'bg-danger-bg text-danger'
                      }`}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Convites pendentes */}
        {convites.length > 0 && (
          <section>
            <h2 className="text-[11px] font-medium text-muted uppercase tracking-wide mb-3">Convites pendentes</h2>
            <div className="space-y-2">
              {convites.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{c.email}</div>
                    <div className="text-[10px] text-muted">{NOME_PERFIL[c.perfil]} · aguardando aceite</div>
                  </div>
                  <button
                    onClick={() => cancelarConvite(c.id)}
                    className="text-[10px] text-danger hover:underline border-none bg-transparent cursor-pointer shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal de convite */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-6 w-full max-w-sm shadow-lg">
            <h2 className="text-[14px] font-medium mb-4">Convidar usuário</h2>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] text-muted mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1.5">Nome (opcional)</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1.5">Perfil</label>
                <select
                  value={form.perfil}
                  onChange={e => setForm(f => ({ ...f, perfil: e.target.value as Perfil }))}
                  className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  {perfisDisponiveis.map(p => (
                    <option key={p} value={p}>{NOME_PERFIL[p]}</option>
                  ))}
                </select>
              </div>
              {msg && <div className="text-[11px] text-danger">{msg}</div>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={convidar}
                  disabled={enviando || !form.email}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer"
                >
                  {enviando ? 'Enviando...' : 'Enviar convite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
