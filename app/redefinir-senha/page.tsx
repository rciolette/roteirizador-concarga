'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [senha,    setSenha]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 8)   { setErro('A senha deve ter no mínimo 8 caracteres.'); return }

    setLoading(true)
    try {
      const sb = getSupabaseBrowser()
      const { error } = await sb.auth.updateUser({ password: senha })
      if (error) throw new Error(error.message)
      router.replace('/')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao redefinir senha')
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
          <h1 className="text-[14px] font-medium mb-1">Definir nova senha</h1>
          <p className="text-[11px] text-muted mb-5">Escolha uma senha segura com no mínimo 8 caracteres.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[11px] text-muted mb-1.5">Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1.5">Confirmar senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={e => setConfirma(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
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
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-bg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer border-none mt-1"
            >
              {loading ? 'Salvando...' : 'Salvar senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
