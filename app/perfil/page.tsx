'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { NOME_PERFIL, type Perfil } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Secao = 'perfil' | 'usuarios'

// ─── ícones inline ────────────────────────────────────────────────────────────
const IconPerfil = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="6" r="2.5"/>
    <path d="M2 14c0-2.761 2.686-5 6-5s6 2.239 6 5"/>
  </svg>
)
const IconUsuarios = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="5" r="2.5"/>
    <path d="M1 13c0-2.761 2.239-5 5-5s5 2.239 5 5"/>
    <circle cx="12" cy="6" r="2"/>
    <path d="M15 13c0-1.657-1.343-3-3-3"/>
  </svg>
)

// ─── item de nav interna ──────────────────────────────────────────────────────
function NavItem({ label, active, onClick, icon }: {
  label: string; active: boolean; onClick: () => void; icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs transition-colors duration-100 cursor-pointer',
        'border-0 border-l-[2.5px]',
        active
          ? 'bg-cream dark:bg-white/10 text-base font-medium border-primary'
          : 'bg-transparent text-muted font-normal border-transparent hover:bg-cream hover:text-base',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-primary' : 'text-muted dark:text-muted/80')}>{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
    </button>
  )
}

// ─── campo reutilizável ───────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-[#252523] text-xs text-base placeholder:text-muted/60 dark:placeholder:text-muted/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-muted mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Seção: Meu perfil ────────────────────────────────────────────────────────
function SecaoPerfil() {
  const { usuario, refreshUsuario } = useAuth()

  const [nome,     setNome]     = useState('')
  const [username, setUsername] = useState('')
  const [cargo,    setCargo]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  const [senhaAtual,    setSenhaAtual]    = useState('')
  const [novaSenha,     setNovaSenha]     = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [savingPw,  setSavingPw]  = useState(false)
  const [msgPw,     setMsgPw]     = useState('')

  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome ?? '')
      setUsername(usuario.username ?? '')
      setCargo(usuario.cargo ?? '')
    }
  }, [usuario])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/perfil', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nome: nome.trim(), username: username.trim(), cargo: cargo.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      await refreshUsuario()
      setMsg('Dados salvos com sucesso.')
    } else {
      setMsg(data.error ?? 'Erro ao salvar.')
    }
    setSaving(false)
  }

  async function atualizarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgPw('')
    if (!senhaAtual)                 { setMsgPw('Informe a senha atual.'); return }
    if (novaSenha !== confirmaSenha) { setMsgPw('As senhas não coincidem.'); return }
    if (novaSenha.length < 8)        { setMsgPw('Mínimo 8 caracteres.'); return }
    setSavingPw(true)
    const sb = getSupabaseBrowser()
    const { error: reAuthErr } = await sb.auth.signInWithPassword({
      email: usuario?.email ?? '', password: senhaAtual,
    })
    if (reAuthErr) { setMsgPw('Senha atual incorreta.'); setSavingPw(false); return }
    const { error } = await sb.auth.updateUser({ password: novaSenha })
    setMsgPw(error ? error.message : 'Senha atualizada com sucesso.')
    if (!error) { setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('') }
    setSavingPw(false)
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    setUploading(true)
    setMsg('')
    const form = new FormData()
    form.append('file', file)
    const res  = await fetch('/api/avatar', { method: 'POST', body: form })
    const data = await res.json()
    if (res.ok) {
      await refreshUsuario()
      setMsg('Foto atualizada.')
    } else {
      setMsg(data.error ?? 'Erro ao salvar foto.')
    }
    setUploading(false)
  }

  if (!usuario) return null

  const isOk = (s: string) => s.includes('sucesso') || s === 'Foto atualizada.'

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary overflow-hidden shrink-0 border-none cursor-pointer p-0 hover:opacity-80 transition-opacity"
        >
          {usuario.avatarUrl
            ? <img src={usuario.avatarUrl} alt="" className="w-full h-full object-cover" />
            : (usuario.nome ?? usuario.email).charAt(0).toUpperCase()
          }
        </button>
        <div>
          <p className="text-[13px] font-medium">{usuario.nome || usuario.email}</p>
          <p className="text-[11px] text-muted mb-2">{NOME_PERFIL[usuario.perfil]}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-[11px] text-primary hover:underline border-none bg-transparent cursor-pointer p-0 disabled:opacity-50"
          >
            {uploading ? 'Enviando...' : 'Trocar foto'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
      </div>

      {msg && (
        <div className={`text-[11px] rounded-lg px-3 py-2 ${isOk(msg) ? 'bg-cond-ok/10 text-cond-ok' : 'bg-danger-bg text-danger'}`}>
          {msg}
        </div>
      )}

      {/* Informações pessoais */}
      <form onSubmit={salvar} className="space-y-4">
        <h2 className="text-[11px] font-medium text-mid uppercase tracking-wide">Informações pessoais</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome completo">
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Seu nome completo" />
          </Field>
          <Field label="Username">
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} placeholder="@usuario" />
          </Field>
        </div>
        <Field label="E-mail">
          <input type="email" value={usuario.email} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
        </Field>
        <Field label="Cargo / Função">
          <input type="text" value={cargo} onChange={e => setCargo(e.target.value)} className={inputCls} placeholder="Ex: Gerente de Logística" />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>

      <div className="border-t border-[0.5px] border-[var(--border-subtle)]" />

      {/* Alterar senha */}
      <form onSubmit={atualizarSenha} className="space-y-4">
        <h2 className="text-[11px] font-medium text-mid uppercase tracking-wide">Alterar senha</h2>
        <Field label="Senha atual">
          <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} className={inputCls} placeholder="••••••••" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nova senha">
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} minLength={8} className={inputCls} placeholder="••••••••" />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} minLength={8} className={inputCls} placeholder="••••••••" />
          </Field>
        </div>
        {msgPw && (
          <p className={`text-[11px] ${msgPw.includes('sucesso') ? 'text-cond-ok' : 'text-danger'}`}>{msgPw}</p>
        )}
        <button
          type="submit"
          disabled={savingPw || !novaSenha || !senhaAtual}
          className="px-4 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer"
        >
          {savingPw ? 'Atualizando...' : 'Atualizar senha'}
        </button>
      </form>
    </div>
  )
}

// ─── Seção: Usuários ──────────────────────────────────────────────────────────
interface UsuarioItem {
  id:       string
  email:    string
  perfil:   Perfil
  nome:     string | null
  ativo:    boolean
  criadoEm: string
}
interface ConviteItem {
  id:       string
  email:    string
  perfil:   Perfil
  status:   string
  criadoEm: string
}

function SecaoUsuarios() {
  const { usuario } = useAuth()
  const [usuarios,     setUsuarios]     = useState<UsuarioItem[]>([])
  const [convites,     setConvites]     = useState<ConviteItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [convidarOpen, setConvidarOpen] = useState(false)
  const [form,         setForm]         = useState({ email: '', nome: '', perfil: 'operador' as Perfil })
  const [enviando,     setEnviando]     = useState(false)
  const [msg,          setMsg]          = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const [rU, rC] = await Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch('/api/convites').then(r => r.json()),
    ])
    setUsuarios(rU.usuarios ?? [])
    setConvites((rC.convites ?? []).filter((c: ConviteItem) => c.status === 'pendente'))
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
      setConvidarOpen(false)
      setForm({ email: '', nome: '', perfil: 'operador' })
      carregar()
    } else {
      setMsg(data.error ?? 'Erro ao enviar convite.')
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-medium text-mid uppercase tracking-wide">Usuários do sistema</h2>
          <p className="text-[11px] text-subtle mt-0.5">Gerencie acessos e permissões</p>
        </div>
        <button
          type="button"
          onClick={() => { setMsg(''); setConvidarOpen(true) }}
          className="px-3 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 transition-opacity border-none cursor-pointer shrink-0"
        >
          + Convidar usuário
        </button>
      </div>

      {msg && (
        <div className={`text-[11px] rounded-lg px-3 py-2 ${msg.includes('sucesso') ? 'bg-cond-ok/10 text-cond-ok' : 'bg-danger-bg text-danger'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-muted">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div
              key={u.id}
              className="flex items-center gap-3 bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-4 py-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[12px] font-medium text-primary overflow-hidden">
                {(u.nome ?? u.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate">{u.nome || u.email}</div>
                <div className="text-[10px] text-muted truncate">{u.nome ? u.email : ''}</div>
              </div>

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

              {u.perfil !== 'owner' && (
                <button
                  type="button"
                  onClick={() => alterarAtivo(u.id, !u.ativo)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border-none cursor-pointer shrink-0 ${
                    u.ativo ? 'bg-cond-ok/10 text-cond-ok' : 'bg-danger-bg text-danger'
                  }`}
                >
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {convites.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium text-mid uppercase tracking-wide">Convites pendentes</h3>
          <div className="space-y-2">
            {convites.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{c.email}</div>
                  <div className="text-[10px] text-muted">{NOME_PERFIL[c.perfil]} · aguardando aceite</div>
                </div>
                <button
                  type="button"
                  onClick={() => cancelarConvite(c.id)}
                  className="text-[10px] text-danger hover:underline border-none bg-transparent cursor-pointer shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de convite */}
      {convidarOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-6 w-full max-w-sm shadow-xl">
            <h3 className="text-[14px] font-medium mb-4">Convidar usuário</h3>
            <div className="flex flex-col gap-3.5">
              <Field label="E-mail">
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inputCls} placeholder="usuario@empresa.com" />
              </Field>
              <Field label="Nome (opcional)">
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} placeholder="Nome do usuário" />
              </Field>
              <Field label="Perfil">
                <select value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value as Perfil }))} className={`${inputCls} cursor-pointer`}>
                  {perfisDisponiveis.map(p => (
                    <option key={p} value={p}>{NOME_PERFIL[p]}</option>
                  ))}
                </select>
              </Field>
              {msg && !msg.includes('sucesso') && <p className="text-[11px] text-danger">{msg}</p>}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setConvidarOpen(false)} className="flex-1 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent">
                  Cancelar
                </button>
                <button type="button" onClick={convidar} disabled={enviando || !form.email} className="flex-1 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer">
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PerfilPage() {
  const { usuario, pode, signOut } = useAuth()
  const [secao, setSecao] = useState<Secao>('perfil')

  if (!usuario) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[0.5px] border-[var(--border-subtle)]">
        <h1 className="text-[14px] font-medium">Ajustes de conta</h1>
        <p className="text-[11px] text-muted">Perfil, segurança e permissões</p>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 min-h-0">
        {/* Nav lateral interna */}
        <aside className="w-44 shrink-0 border-r border-[0.5px] border-[var(--border-subtle)] flex flex-col px-2 py-3">
          <nav className="flex-1 space-y-0.5">
            <div className="text-[9px] text-muted/60 dark:text-muted px-2.5 pt-1 pb-1.5 uppercase tracking-[0.06em] font-medium">
              Configurações
            </div>
            <NavItem
              label="Meu perfil"
              active={secao === 'perfil'}
              onClick={() => setSecao('perfil')}
              icon={<IconPerfil />}
            />
            {pode('usuarios') && (
              <NavItem
                label="Usuários"
                active={secao === 'usuarios'}
                onClick={() => setSecao('usuarios')}
                icon={<IconUsuarios />}
              />
            )}
          </nav>

          {/* Sair */}
          <div className="border-t border-[0.5px] border-[var(--border-subtle)] pt-2 px-1">
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs text-danger hover:bg-danger-bg transition-colors duration-100 bg-transparent border-none cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6"/>
              </svg>
              <span>Sair da conta</span>
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-7 max-w-2xl">
            {secao === 'perfil' ? <SecaoPerfil /> : <SecaoUsuarios />}
          </div>
        </main>
      </div>
    </div>
  )
}
