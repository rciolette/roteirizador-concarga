import { getSupabaseBrowser } from '@/lib/supabase-browser'

/**
 * Solicitações de edição (Raphael, 14/10).
 *
 * Canal interno para o Marcelo apontar, tela por tela, o que precisa mudar e
 * COMO deve ficar — no lugar do vaivém de prints no WhatsApp. É privado: a
 * RLS da tabela `solicitacoes_edicao` só libera os e-mails abaixo, e o botão
 * nem aparece para os outros usuários.
 */
export const EMAILS_SOLICITACOES = [
  'rciolette@gmail.com',
  'marcelo@concarga.com.br',
]

export function podeVerSolicitacoes(email: string | undefined | null): boolean {
  return !!email && EMAILS_SOLICITACOES.includes(email.trim().toLowerCase())
}

/** Telas do app. Mantido como lista fixa para o pedido já chegar endereçado. */
export const PAGINAS_SOLICITACAO = [
  'Dashboard',
  'Rotas do dia',
  'Notas / importação SIAT',
  'Histórico',
  'Frota',
  'Aprovações',
  'Configurações',
  'Acerto de canhoto (planilha)',
  'Outro / geral',
] as const

export type PrioridadeSolicitacao = 'alta' | 'media' | 'baixa'
export type StatusSolicitacao     = 'aberta' | 'em_analise' | 'feita'

export interface Solicitacao {
  id:          string
  pagina:      string
  titulo:      string
  comoQuer:    string | null
  prioridade:  PrioridadeSolicitacao
  status:      StatusSolicitacao
  autorEmail:  string | null
  autorNome:   string | null
  resposta:    string | null
  criadoEm:    string
  atualizadoEm: string
}

function mapear(r: Record<string, unknown>): Solicitacao {
  return {
    id:           String(r.id),
    pagina:       String(r.pagina ?? ''),
    titulo:       String(r.titulo ?? ''),
    comoQuer:     (r.como_quer as string) ?? null,
    prioridade:   ((r.prioridade as PrioridadeSolicitacao) ?? 'media'),
    status:       ((r.status as StatusSolicitacao) ?? 'aberta'),
    autorEmail:   (r.autor_email as string) ?? null,
    autorNome:    (r.autor_nome as string) ?? null,
    resposta:     (r.resposta as string) ?? null,
    criadoEm:     String(r.criado_em),
    atualizadoEm: String(r.atualizado_em ?? r.criado_em),
  }
}

export async function listarSolicitacoes(): Promise<Solicitacao[]> {
  const { data, error } = await getSupabaseBrowser()
    .from('solicitacoes_edicao')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(mapear)
}

export interface NovaSolicitacao {
  pagina:     string
  titulo:     string
  comoQuer:   string
  prioridade: PrioridadeSolicitacao
  autorEmail: string | null
  autorNome:  string | null
}

export async function criarSolicitacao(nova: NovaSolicitacao): Promise<Solicitacao> {
  const { data, error } = await getSupabaseBrowser()
    .from('solicitacoes_edicao')
    .insert({
      pagina:      nova.pagina,
      titulo:      nova.titulo,
      como_quer:   nova.comoQuer || null,
      prioridade:  nova.prioridade,
      autor_email: nova.autorEmail,
      autor_nome:  nova.autorNome,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapear(data as Record<string, unknown>)
}

export async function mudarStatusSolicitacao(id: string, status: StatusSolicitacao): Promise<void> {
  const { error } = await getSupabaseBrowser()
    .from('solicitacoes_edicao')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function responderSolicitacao(id: string, resposta: string): Promise<void> {
  const { error } = await getSupabaseBrowser()
    .from('solicitacoes_edicao')
    .update({ resposta, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function excluirSolicitacao(id: string): Promise<void> {
  const { error } = await getSupabaseBrowser()
    .from('solicitacoes_edicao')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Markdown das solicitações — o mesmo formato guardado no repositório. */
export function solicitacoesParaMarkdown(itens: Solicitacao[]): string {
  const ordem: Record<PrioridadeSolicitacao, number> = { alta: 0, media: 1, baixa: 2 }
  const rotuloP: Record<PrioridadeSolicitacao, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  const rotuloS: Record<StatusSolicitacao, string> = { aberta: 'Aberta', em_analise: 'Em análise', feita: 'Feita' }
  const linhas: string[] = [
    '# Solicitações de edição — Roteirizador Concarga',
    '',
    `Exportado em ${new Date().toLocaleString('pt-BR')} · ${itens.length} solicitação(ões).`,
    '',
  ]
  for (const grupo of ['aberta', 'em_analise', 'feita'] as StatusSolicitacao[]) {
    const doGrupo = itens
      .filter(s => s.status === grupo)
      .sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade] || b.criadoEm.localeCompare(a.criadoEm))
    if (!doGrupo.length) continue
    linhas.push(`## ${rotuloS[grupo]} (${doGrupo.length})`, '')
    for (const s of doGrupo) {
      linhas.push(`### [${s.pagina}] ${s.titulo}`)
      linhas.push(`- Urgência: **${rotuloP[s.prioridade]}** · por ${s.autorNome || s.autorEmail || 'desconhecido'} em ${new Date(s.criadoEm).toLocaleString('pt-BR')}`)
      if (s.comoQuer) linhas.push(`- Como deve ficar: ${s.comoQuer.replace(/\n/g, ' ')}`)
      if (s.resposta) linhas.push(`- Resposta: ${s.resposta.replace(/\n/g, ' ')}`)
      linhas.push('')
    }
  }
  return linhas.join('\n')
}
