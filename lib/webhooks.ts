export type Prioridade = 'padrao' | 'vermelho' | 'menos-veiculos' | 'menor-distancia'

export interface GerarRotasPayload {
  data:               string
  observacoes:        string
  motoristasAusentes: string[]
  veiculosBloqueados: string[]
  restricoesExtras:   string
  prioridade:         Prioridade
}

export async function webhookGerarRotas(payload: GerarRotasPayload): Promise<unknown> {
  const res = await fetch('/api/gerar-rotas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function webhookEnviarMotorista(_rotaId: string): Promise<void> {
  // TODO: POST para webhook n8n de envio ao motorista
}

export async function webhookImportarSIAT(): Promise<void> {
  // TODO: POST para webhook n8n de importação SIAT
}
