'use client'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Btn, TextInput, TextArea, Select } from '@/components/ui'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  podeVerSolicitacoes, listarSolicitacoes, criarSolicitacao, mudarStatusSolicitacao,
  excluirSolicitacao, solicitacoesParaMarkdown, PAGINAS_SOLICITACAO,
  type Solicitacao, type PrioridadeSolicitacao, type StatusSolicitacao,
} from '@/lib/solicitacoes'

/**
 * "Solicitar edições" — canal privado entre o Marcelo e o Raphael (14/10).
 *
 * Fica num botão flutuante presente em todas as telas (o app não ganha página
 * nova). Só aparece para quem está na lista de e-mails de `lib/solicitacoes`;
 * a RLS da tabela faz a mesma trava do lado do banco.
 */

const P_ROTULO: Record<PrioridadeSolicitacao, string> = {
  alta:  'Alta — trava o uso no dia',
  media: 'Média — atrapalha',
  baixa: 'Baixa — melhoria',
}

const P_TAG: Record<PrioridadeSolicitacao, string> = {
  alta:  'bg-danger-bg text-danger',
  media: 'bg-warn-bg text-warn',
  baixa: 'bg-cream text-muted',
}

const S_ROTULO: Record<StatusSolicitacao, string> = {
  aberta:     'Aberta',
  em_analise: 'Em análise',
  feita:      'Feita',
}

const PROXIMO: Record<StatusSolicitacao, StatusSolicitacao> = {
  aberta:     'em_analise',
  em_analise: 'feita',
  feita:      'aberta',
}

export function SolicitarEdicoes() {
  const { usuario } = useAuth()
  const liberado = podeVerSolicitacoes(usuario?.email)

  const [aberto,   setAberto]   = useState(false)
  const [itens,    setItens]    = useState<Solicitacao[]>([])
  const [aba,      setAba]      = useState<'nova' | 'lista'>('nova')
  const [erro,     setErro]     = useState('')
  const [salvando, setSalvando] = useState(false)
  const [copiado,  setCopiado]  = useState(false)

  const [pagina,     setPagina]     = useState<string>('Rotas do dia')
  const [titulo,     setTitulo]     = useState('')
  const [comoQuer,   setComoQuer]   = useState('')
  const [prioridade, setPrioridade] = useState<PrioridadeSolicitacao>('media')

  const carregar = useCallback(async () => {
    try { setItens(await listarSolicitacoes()); setErro('') }
    catch { setErro('Não consegui carregar as solicitações.') }
  }, [])

  useEffect(() => { if (aberto) carregar() }, [aberto, carregar])

  useEffect(() => {
    if (!aberto) return
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aberto])

  if (!liberado) return null

  const emAberto = itens.filter(s => s.status !== 'feita').length

  async function enviar() {
    if (!titulo.trim()) { setErro('Escreva o que precisa mudar.'); return }
    setSalvando(true); setErro('')
    try {
      await criarSolicitacao({
        pagina,
        titulo:     titulo.trim(),
        comoQuer:   comoQuer.trim(),
        prioridade,
        autorEmail: usuario?.email ?? null,
        autorNome:  usuario?.nome ?? null,
      })
      setTitulo(''); setComoQuer('')
      await carregar()
      setAba('lista')
    } catch {
      setErro('Não consegui salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarStatus(s: Solicitacao) {
    try { await mudarStatusSolicitacao(s.id, PROXIMO[s.status]); await carregar() }
    catch { setErro('Não consegui mudar o status.') }
  }

  async function remover(s: Solicitacao) {
    if (!window.confirm(`Excluir a solicitação "${s.titulo}"?`)) return
    try { await excluirSolicitacao(s.id); await carregar() }
    catch { setErro('Não consegui excluir.') }
  }

  async function copiarMarkdown() {
    try {
      await navigator.clipboard.writeText(solicitacoesParaMarkdown(itens))
      setCopiado(true); setTimeout(() => setCopiado(false), 2500)
    } catch { setErro('Não consegui copiar.') }
  }

  function baixarMarkdown() {
    const blob = new Blob([solicitacoesParaMarkdown(itens)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `solicitacoes-edicao-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Solicitar edições (visível só para você e o Marcelo)"
        className={cn(
          'fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full',
          'px-4 py-2.5 text-xs font-medium cursor-pointer border border-[0.5px]',
          'bg-brand text-brand-fg border-brand shadow-lg hover:brightness-95 active:scale-[0.98]',
          'transition-[filter,transform] duration-100',
        )}
      >
        ✎ Solicitar edições
        {emAberto > 0 && (
          <span className="text-[10px] bg-white/25 rounded-full px-1.5 min-w-[18px] text-center">{emAberto}</span>
        )}
      </button>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/55 z-[120] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setAberto(false) }}
        >
          <div className="animate-fade-in bg-surface rounded-xl border border-[0.5px] border-[var(--border-light)] w-[680px] max-w-full max-h-[86vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-[0.5px] border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <div>
                <div className="text-[13px] font-medium">Solicitar edições</div>
                <div className="text-[11px] text-muted mt-0.5">
                  Privado — só você e o Marcelo veem esta lista.
                </div>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="bg-transparent border-none cursor-pointer text-muted text-xl leading-none px-1 hover:text-base transition-colors"
              >
                ×
              </button>
            </div>

            <div className="px-5 pt-3 flex gap-1.5 shrink-0">
              {([['nova', 'Novo pedido'], ['lista', `Pedidos (${itens.length})`]] as const).map(([v, rotulo]) => (
                <button
                  key={v}
                  onClick={() => setAba(v)}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer border-none transition-colors duration-100',
                    aba === v ? 'bg-primary text-white' : 'bg-cream text-mid hover:bg-cream-hover',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {erro && (
                <div className="text-[11px] text-warn bg-warn-bg border border-[0.5px] border-warn-border rounded-lg px-3 py-2 mb-3">
                  {erro}
                </div>
              )}

              {aba === 'nova' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Tela</label>
                      <Select value={pagina} onChange={setPagina}>
                        {PAGINAS_SOLICITACAO.map(p => <option key={p} value={p}>{p}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Urgência</label>
                      <Select value={prioridade} onChange={v => setPrioridade(v as PrioridadeSolicitacao)}>
                        {(Object.keys(P_ROTULO) as PrioridadeSolicitacao[]).map(p => (
                          <option key={p} value={p}>{P_ROTULO[p]}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">O que está errado ou falta</label>
                    <TextInput
                      value={titulo}
                      onChange={setTitulo}
                      placeholder="Ex.: a coluna Observação não abre o texto inteiro"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Como você quer que fique</label>
                    <TextArea
                      value={comoQuer}
                      onChange={setComoQuer}
                      rows={5}
                      placeholder="Ex.: clicar na observação deve abrir um balão com o texto completo, sem cortar, e fechar no X."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn variant="primary" onClick={enviar} disabled={salvando}>
                      {salvando ? 'Enviando…' : 'Enviar pedido'}
                    </Btn>
                    <span className="text-[11px] text-muted">Fica salvo e some do caminho até ser resolvido.</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {itens.length === 0 && (
                    <p className="text-xs text-muted text-center py-8">Nenhuma solicitação registrada ainda.</p>
                  )}
                  {itens.map(s => (
                    <div
                      key={s.id}
                      className={cn(
                        'rounded-lg border border-[0.5px] border-[var(--border-subtle)] px-3.5 py-3',
                        s.status === 'feita' && 'opacity-60',
                      )}
                    >
                      <div className="text-[12.5px] font-medium">{s.titulo}</div>
                      {s.comoQuer && (
                        <div className="text-[11.5px] text-mid mt-1.5 whitespace-pre-wrap border-l-2 border-[var(--border-subtle)] pl-2.5">
                          {s.comoQuer}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mt-2 text-[10.5px] text-muted">
                        <span className="rounded-full px-2 py-0.5 bg-cream text-mid">{s.pagina}</span>
                        <span className={cn('rounded-full px-2 py-0.5 font-medium', P_TAG[s.prioridade])}>
                          {s.prioridade === 'media' ? 'média' : s.prioridade}
                        </span>
                        <span className="rounded-full px-2 py-0.5 bg-cream text-mid">{S_ROTULO[s.status]}</span>
                        <span>
                          {s.autorNome || s.autorEmail || '—'} ·{' '}
                          {new Date(s.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <Btn size="sm" onClick={() => alternarStatus(s)}>
                          → {S_ROTULO[PROXIMO[s.status]]}
                        </Btn>
                        <Btn size="sm" variant="danger-soft" onClick={() => remover(s)}>Excluir</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[0.5px] border-[var(--border-subtle)] flex gap-2 justify-between items-center shrink-0">
              <span className="text-[11px] text-muted">
                {emAberto} em aberto · {itens.length} no total
              </span>
              <div className="flex gap-2">
                <Btn size="sm" onClick={copiarMarkdown} disabled={itens.length === 0}>
                  {copiado ? '✓ Copiado' : 'Copiar como texto'}
                </Btn>
                <Btn size="sm" onClick={baixarMarkdown} disabled={itens.length === 0}>⤓ Baixar .md</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
