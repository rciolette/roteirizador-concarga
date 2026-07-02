'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

const ESPECIAL = /[^a-zA-Z0-9]/

function validar(senha: string): string | null {
  if (senha.length < 8)       return 'A senha deve ter no mínimo 8 caracteres.'
  if (!ESPECIAL.test(senha))  return 'A senha deve conter pelo menos um caractere especial (!@#$%...).'
  return null
}

function AceitarConviteForm() {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  const [senha,    setSenha]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro,     setErro]     = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const erroSenha = validar(senha)
    if (erroSenha)             { setErro(erroSenha); return }
    if (senha !== confirma)    { setErro('As senhas não coincidem.'); return }

    setSalvando(true)
    const sb = getSupabaseBrowser()
    const { error } = await sb.auth.updateUser({ password: senha })
    if (error) { setErro(error.message); setSalvando(false); return }

    // Senha definida → vai para perfil para concluir configuração da conta
    router.replace('/perfil')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <p className="text-[12px] text-muted">Carregando...</p>
      </div>
    )
  }

  const ok8   = senha.length >= 8
  const okEsp = ESPECIAL.test(senha)

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-[9px] bg-primary flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#E6F1FB" strokeWidth="1.8">
              <path d="M2 8l4-5 4 5 4-5"/>
            </svg>
          </div>
          <span className="text-[15px] font-medium tracking-[-0.01em]">Concarga</span>
        </div>

        <div className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-7 shadow-sm">
          <h1 className="text-[14px] font-medium mb-1">Criar sua conta</h1>
          <p className="text-[11px] text-muted mb-5">
            Defina uma senha para ativar seu acesso ao Roteirizador Concarga.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

            {/* E-mail pré-preenchido */}
            <div>
              <label className="block text-[11px] text-muted mb-1.5">E-mail</label>
              <input
                type="email"
                value={usuario?.email ?? ''}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs opacity-60 cursor-not-allowed outline-none"
              />
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-[11px] text-muted mb-1.5">Criar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-[#252523] text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors"
                placeholder="Mínimo 8 caracteres com símbolo"
              />
            </div>

            {/* Indicadores de força */}
            {senha.length > 0 && (
              <ul className="text-[10px] space-y-0.5 -mt-1.5 pl-0.5">
                <li className={ok8   ? 'text-cond-ok' : 'text-muted'}>{ok8   ? '✓' : '·'} Mínimo 8 caracteres</li>
                <li className={okEsp ? 'text-cond-ok' : 'text-muted'}>{okEsp ? '✓' : '·'} Pelo menos um caractere especial (!@#$%...)</li>
              </ul>
            )}

            {/* Confirmar senha */}
            <div>
              <label className="block text-[11px] text-muted mb-1.5">Confirmar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={e => setConfirma(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-[#252523] text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <div className="text-[11px] text-danger bg-danger-bg border border-[0.5px] border-danger-border rounded-lg px-3 py-2">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={salvando || !ok8 || !okEsp}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none mt-1"
            >
              {salvando ? 'Ativando conta...' : 'Ativar conta e entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted mt-4">
          Acesso restrito — solicite ao administrador
        </p>
      </div>
    </div>
  )
}

export default function AceitarConvitePage() {
  return (
    <Suspense>
      <AceitarConviteForm />
    </Suspense>
  )
}
