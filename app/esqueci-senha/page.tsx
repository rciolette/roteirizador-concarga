'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function EsqueciSenhaPage() {
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
      const redirectTo = `${window.location.origin}/auth/callback?type=recovery`
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
              <h1 className="text-[14px] font-medium mb-2">E-mail enviado</h1>
              <p className="text-[11px] text-muted mb-4">
                Se houver uma conta com esse e-mail, você receberá as instruções para redefinir a senha.
              </p>
              <Link href="/login" className="text-[11px] text-primary hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[14px] font-medium mb-1">Esqueci minha senha</h1>
              <p className="text-[11px] text-muted mb-5">Informe seu e-mail para receber o link de redefinição.</p>

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

                {erro && (
                  <div className="text-[11px] text-danger bg-danger-bg border border-[0.5px] border-danger-border rounded-lg px-3 py-2">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none mt-1"
                >
                  {loading ? 'Enviando...' : 'Enviar link'}
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
      </div>
    </div>
  )
}
