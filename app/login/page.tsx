'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/auth'

const ESPECIAL = /[^a-zA-Z0-9]/

// ─── Dialog: Primeiro Acesso ──────────────────────────────────────────────────
function PrimeiroAcessoDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')

  const ok8   = senha.length >= 8
  const okEsp = ESPECIAL.test(senha)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!ok8)               { setErro('A senha deve ter no mínimo 8 caracteres.'); return }
    if (!okEsp)             { setErro('A senha deve conter pelo menos um caractere especial (!@#$%...).'); return }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const res  = await fetch('/api/ativar-conta', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password: senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao ativar conta.'); return }

      // Ativado — faz login automático e vai para /perfil
      await signIn(email.trim(), senha)
      router.replace('/perfil')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[360px] bg-surface border border-[0.5px] border-[var(--border-card)] rounded-xl shadow-xl px-6 py-7 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[14px] font-medium">Criar conta</h2>
            <p className="text-[11px] text-muted mt-0.5">Use o e-mail que recebeu o convite</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-base text-xl leading-none bg-transparent border-none cursor-pointer px-1 transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* E-mail */}
          <div>
            <label className="block text-[11px] text-muted mb-1.5">E-mail do convite</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-hover text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors"
              placeholder="seu@email.com"
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
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-hover text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors"
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
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-hover text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:focus:ring-primary/20 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <div className="text-[11px] text-danger bg-danger-bg border border-[0.5px] border-danger-border rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !email || !ok8 || !okEsp}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none"
            >
              {loading ? 'Ativando...' : 'Ativar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Formulário de login ──────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showDialog,   setShowDialog]   = useState(false)

  useEffect(() => {
    const erro = searchParams.get('erro')
    if (erro === 'link_invalido') {
      setError('O link de acesso é inválido ou expirou. Use "Primeiro acesso" abaixo para criar sua senha.')
      return
    }
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params  = new URLSearchParams(hash.substring(1))
      const errCode = params.get('error_code')
      if (errCode === 'otp_expired') {
        setError('O link de convite expirou. Use "Primeiro acesso" abaixo para criar sua senha.')
      } else {
        const desc = params.get('error_description')
        setError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Erro de autenticação. Tente novamente.')
      }
    }
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showDialog && <PrimeiroAcessoDialog onClose={() => setShowDialog(false)} />}

      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-[340px]">

          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-[9px] bg-primary flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#E6F1FB" strokeWidth="1.8">
                <path d="M2 8l4-5 4 5 4-5"/>
              </svg>
            </div>
            <span className="text-[15px] font-medium tracking-[-0.01em]">Concarga</span>
          </div>

          {/* Card */}
          <div className="bg-surface border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-7 shadow-sm">
            <h1 className="text-[14px] font-medium mb-1">Entrar no sistema</h1>
            <p className="text-[11px] text-muted mb-5">Roteirizador Concarga</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] text-muted mb-1.5">E-mail</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1.5">Senha</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-[11px] text-danger bg-danger-bg border border-[0.5px] border-danger-border rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none mt-1"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2">
              <a href="/esqueci-senha" className="text-[11px] text-muted hover:text-base">
                Esqueci minha senha
              </a>
              <div className="w-full border-t border-[0.5px] border-[var(--border-subtle)] my-1" />
              <button
                type="button"
                onClick={() => setShowDialog(true)}
                className="text-[11px] text-primary hover:underline font-medium bg-transparent border-none cursor-pointer"
              >
                Primeiro acesso? Crie sua senha aqui
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted mt-4">
            Acesso restrito — solicite ao administrador
          </p>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
