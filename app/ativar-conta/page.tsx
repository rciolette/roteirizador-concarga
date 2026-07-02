'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function AtivarContaPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro,    setErro]    = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const sb = getSupabaseBrowser()
      // origem=convite faz o callback redirecionar para /aceitar-convite
      const redirectTo = `${window.location.origin}/auth/callback?origem=convite`
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw new Error(error.message)
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar e-mail')
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

        <div className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-6 py-7 shadow-sm">
          {enviado ? (
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-cond-ok/10 flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cond-ok">
                  <path d="M2 8l4 4 8-8"/>
                </svg>
              </div>
              <h1 className="text-[14px] font-medium mb-2">Link enviado!</h1>
              <p className="text-[11px] text-muted mb-1">
                Enviamos um link para <strong>{email}</strong>.
              </p>
              <p className="text-[11px] text-muted mb-4">
                Abra o e-mail e clique em <em>"Ativar conta"</em> para criar sua senha. O link expira em 24h.
              </p>
              <Link href="/login" className="text-[11px] text-primary hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[14px] font-medium mb-1">Primeiro acesso</h1>
              <p className="text-[11px] text-muted mb-5">
                Informe o e-mail que recebeu o convite para criar sua senha de acesso.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[11px] text-muted mb-1.5">E-mail do convite</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-white dark:bg-[#252523] text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                    placeholder="seu@email.com"
                  />
                </div>

                {erro && (
                  <div className="text-[11px] text-danger bg-danger-bg border border-[0.5px] border-danger-border rounded-lg px-3 py-2">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none mt-1"
                >
                  {loading ? 'Enviando...' : 'Enviar link de ativação'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-[11px] text-muted hover:text-base">
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-muted mt-4">
          Acesso restrito — solicite ao administrador
        </p>
      </div>
    </div>
  )
}
