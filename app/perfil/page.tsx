'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { NOME_PERFIL } from '@/lib/auth'

export default function PerfilPage() {
  const { usuario } = useAuth()
  const [nome,     setNome]     = useState('')
  const [telefone, setTelefone] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  const [senha,    setSenha]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [msgPw,    setMsgPw]    = useState('')

  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome ?? '')
      setTelefone(usuario.telefone ?? '')
    }
  }, [usuario])

  async function salvarDados(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    setSaving(true)
    const res = await fetch('/api/perfil', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nome: nome.trim(), telefone: telefone.trim() }),
    })
    const data = await res.json()
    setMsg(res.ok ? 'Dados salvos.' : (data.error ?? 'Erro ao salvar'))
    setSaving(false)
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgPw('')
    if (senha !== confirma) { setMsgPw('As senhas não coincidem.'); return }
    if (senha.length < 8)   { setMsgPw('Mínimo 8 caracteres.'); return }
    setSavingPw(true)
    const sb = getSupabaseBrowser()
    const { error } = await sb.auth.updateUser({ password: senha })
    setMsgPw(error ? error.message : 'Senha atualizada.')
    if (!error) { setSenha(''); setConfirma('') }
    setSavingPw(false)
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    setUploading(true)
    setMsg('')
    const sb = getSupabaseBrowser()
    const path = `${usuario.id}/avatar`
    const { error: upErr } = await sb.storage
      .from('roteirizador-avatares')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setMsg(upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = sb.storage.from('roteirizador-avatares').getPublicUrl(path)
    const res = await fetch('/api/perfil', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ avatar_url: publicUrl }),
    })
    setMsg(res.ok ? 'Foto atualizada. Recarregue para ver.' : 'Erro ao salvar foto.')
    setUploading(false)
  }

  if (!usuario) return null

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-[0.5px] border-[var(--border-subtle)]">
        <h1 className="text-[14px] font-medium">Meu perfil</h1>
        <p className="text-[11px] text-muted">Gerencie suas informações pessoais</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-md space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-[20px] font-medium text-primary cursor-pointer overflow-hidden shrink-0"
          >
            {usuario.avatarUrl
              ? <img src={usuario.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : (usuario.nome ?? usuario.email).charAt(0).toUpperCase()
            }
          </div>
          <div>
            <p className="text-[12px] font-medium">{usuario.nome || usuario.email}</p>
            <p className="text-[10px] text-muted">{NOME_PERFIL[usuario.perfil]}</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-[10px] text-primary hover:underline border-none bg-transparent cursor-pointer p-0"
            >
              {uploading ? 'Enviando...' : 'Trocar foto'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>

        {msg && (
          <div className="text-[11px] text-primary bg-primary/10 rounded-lg px-3 py-2">{msg}</div>
        )}

        {/* Dados pessoais */}
        <form onSubmit={salvarDados} className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-5 py-5 space-y-4">
          <h2 className="text-[12px] font-medium">Dados pessoais</h2>
          <div>
            <label className="block text-[11px] text-muted mb-1.5">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1.5">E-mail</label>
            <input
              type="email"
              value={usuario.email}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs text-muted cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1.5">Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
              placeholder="(00) 00000-0000"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Salvar dados'}
          </button>
        </form>

        {/* Trocar senha */}
        <form onSubmit={trocarSenha} className="bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-xl px-5 py-5 space-y-4">
          <h2 className="text-[12px] font-medium">Alterar senha</h2>
          <div>
            <label className="block text-[11px] text-muted mb-1.5">Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              minLength={8}
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1.5">Confirmar senha</label>
            <input
              type="password"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              minLength={8}
              className="w-full px-3 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] bg-page text-xs outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>
          {msgPw && (
            <p className={`text-[11px] ${msgPw.includes('tualizada') ? 'text-cond-ok' : 'text-danger'}`}>
              {msgPw}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPw || !senha}
            className="px-4 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity border-none cursor-pointer"
          >
            {savingPw ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
