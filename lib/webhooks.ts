// Placeholder — chamadas aos webhooks do n8n

export async function webhookGerarRotas(_payload: Record<string, unknown>): Promise<void> {
  // TODO: POST para webhook n8n de geração de rotas
}

export async function webhookEnviarMotorista(_rotaId: string): Promise<void> {
  // TODO: POST para webhook n8n de envio ao motorista
}

export async function webhookImportarSIAT(): Promise<void> {
  // TODO: POST para webhook n8n de importação SIAT
}
