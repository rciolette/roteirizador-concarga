'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/auth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    // Erro via query param (redirect do /auth/callback)
    const erro = searchParams.get('erro')
    if (erro === 'link_invalido') {
      setError('O link de acesso é inválido ou expirou. Solicite um novo convite ao administrador.')
      return
    }
    // Erro via hash fragment (redirect direto do Supabase quando o OTP expira)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const errCode = params.get('error_code')
      if (errCode === 'otp_expired') {
        setError('O link de convite expirou. Peça ao administrador que envie um novo convite.')
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
        <div className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-7 shadow-sm">
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
            <a href="/ativar-conta" className="text-[11px] text-primary hover:underline font-medium">
              Primeiro acesso? Ative sua conta aqui
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted mt-4">
          Acesso restrito — solicite ao administrador
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
