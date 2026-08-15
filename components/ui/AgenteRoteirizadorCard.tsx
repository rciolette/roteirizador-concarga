'use client'
// Card de configuração do agente roteirizador — visível SOMENTE para o
// rciolette@gmail.com (o gate real está na API /api/agente-roteirizador;
// aqui só evitamos renderizar para os demais).
import { useEffect, useState } from 'react'
import { Card, CardHeader, Btn, Select, TextInput } from '@/components/ui'
import { useAuth } from '@/components/providers/AuthProvider'
import { cn } from '@/lib/utils'

const ADMIN_AGENTE_EMAIL = 'rciolette@gmail.com'

interface ConfigAgente {
  engine:            'n8n' | 'interno'
  modelo?:           string
  envOverride?:      boolean
  openaiConfigurada?: boolean
}

export function AgenteRoteirizadorCard() {
  const { usuario } = useAuth()
  const autorizado = usuario?.email?.toLowerCase() === ADMIN_AGENTE_EMAIL

  const [config,   setConfig]   = useState<ConfigAgente | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    if (!autorizado) return
    fetch('/api/agente-roteirizador')
      .then(r => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [autorizado])

  if (!autorizado) return null

  async function salvar() {
    if (!config) return
    setSalvando(true)
    setMsg('')
    try {
      const res = await fetch('/api/agente-roteirizador', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ engine: config.engine, modelo: config.modelo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setMsg('✓ Configuração salva — vale a partir da próxima geração de rotas.')
    } catch (err) {
      setMsg(`Erro: ${err instanceof Error ? err.message : 'falha ao salvar'}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-xs font-medium text-base">Motor de roteirização</div>
          <div className="text-[11px] text-muted">
            Restrito a {ADMIN_AGENTE_EMAIL}. O prompt mestre vive no repositório
            (lib/roteirizador/prompt-mestre.ts) — só é alterado via GitHub.
          </div>
        </div>
      </CardHeader>

      {!config ? (
        <div className="px-4 py-6 text-[12px] text-muted">Carregando configuração…</div>
      ) : (
        <div className="px-4 py-3 flex flex-col gap-3">
          {config.envOverride && (
            <div className="text-[11px] bg-warn-bg text-warn rounded-lg px-3 py-2">
              A variável GERAR_ROTAS_ENGINE está definida na Vercel e tem precedência
              sobre esta configuração.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-muted mb-1">Engine</label>
              <Select
                value={config.engine}
                onChange={v => setConfig(c => c ? { ...c, engine: v as ConfigAgente['engine'] } : c)}
              >
                <option value="n8n">n8n (WF-B — legado)</option>
                <option value="interno">Interno (OpenAI no app — prompt mestre do repositório)</option>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">Modelo (engine interno)</label>
              <TextInput
                value={config.modelo ?? ''}
                onChange={v => setConfig(c => c ? { ...c, modelo: v } : c)}
                placeholder="gpt-4.1-mini (padrão)"
              />
            </div>
          </div>

          {config.engine === 'interno' && !config.openaiConfigurada && (
            <div className="text-[11px] bg-danger-bg text-danger rounded-lg px-3 py-2">
              OPENAI_API_KEY não está configurada na Vercel — o engine interno não
              funcionará até adicionar a chave (Settings → Environment Variables) e
              fazer redeploy.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Btn variant="primary" size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Btn>
            {msg && (
              <span className={cn('text-[11px]', msg.startsWith('Erro') ? 'text-danger' : 'text-success-dark')}>
                {msg}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
