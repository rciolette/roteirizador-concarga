'use client'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Segmentadores (slicers) no estilo da planilha que a operação usa hoje: as
 * opções ficam à vista numa lista, sem precisar abrir dropdown para descobrir
 * o que existe. Seleção múltipla; nada selecionado = sem filtro na dimensão.
 */

export interface OpcaoSegmento {
  valor: string
  /** Quantas linhas do recorte atual caem nesta opção (0 = fora do recorte). */
  count: number
}

export function Segmentador({
  titulo,
  opcoes,
  selecionados,
  onToggle,
  onLimpar,
  comBusca = false,
  className,
}: {
  titulo:       string
  opcoes:       OpcaoSegmento[]
  selecionados: Set<string>
  onToggle:     (valor: string) => void
  onLimpar:     () => void
  comBusca?:    boolean
  className?:   string
}) {
  const [q, setQ] = useState('')

  const visiveis = useMemo(() => {
    const termo = q.trim().toLowerCase()
    const base = termo ? opcoes.filter(o => o.valor.toLowerCase().includes(termo)) : opcoes
    // Só o que existe dentro do recorte atual — opção zerada sai da lista, sem
    // exceção (Raphael, 04/09). Uma seleção que zerou continua removível pelos
    // chips de "Filtros aplicados" e pelo × do card, então não precisa ficar
    // ocupando espaço aqui.
    const uteis = base.filter(o => o.count > 0)
    // Selecionados primeiro, depois alfabético.
    return uteis.sort((a, b) => {
      const sa = selecionados.has(a.valor) ? 0 : 1
      const sb = selecionados.has(b.valor) ? 0 : 1
      if (sa !== sb) return sa - sb
      return a.valor.localeCompare(b.valor, 'pt-BR')
    })
  }, [opcoes, q, selecionados])

  return (
    <div className={cn(
      'flex flex-col rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-surface overflow-hidden',
      selecionados.size > 0 && 'border-primary',
      className,
    )}>
      <div className="flex items-center gap-1 px-2 py-1 bg-page border-b border-[0.5px] border-[var(--border-faint)]">
        <span className="text-[10px] font-medium text-muted truncate flex-1">{titulo}</span>
        {selecionados.size > 0 && (
          <>
            <span className="text-[9px] px-1 rounded bg-primary text-white font-medium tabular-nums shrink-0">
              {selecionados.size}
            </span>
            <button
              onClick={onLimpar}
              title={`Limpar ${titulo}`}
              className="text-[11px] leading-none text-muted hover:text-danger-mid px-0.5 shrink-0 cursor-pointer"
            >
              ×
            </button>
          </>
        )}
      </div>

      {comBusca && opcoes.length > 8 && (
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Filtrar…"
          className="mx-1 mt-1 h-6 px-1.5 text-[10px] font-sans rounded border border-[0.5px] border-[var(--border-input)] bg-page outline-none focus:border-primary"
        />
      )}

      <div className="flex flex-col overflow-y-auto max-h-[124px] p-1 gap-px">
        {visiveis.length === 0 ? (
          <span className="text-[10px] text-subtle px-1 py-1">
            {q ? 'Nada encontrado' : 'Sem opções no recorte'}
          </span>
        ) : visiveis.map(o => {
          const ativo = selecionados.has(o.valor)
          return (
            <button
              key={o.valor}
              onClick={() => onToggle(o.valor)}
              title={o.valor}
              className={cn(
                'flex items-center gap-1 px-1.5 py-[3px] rounded text-[10px] text-left transition-colors cursor-pointer',
                ativo
                  ? 'bg-primary text-white font-medium'
                  : 'text-base hover:bg-cream dark:hover:bg-hover',
              )}
            >
              <span className="truncate flex-1">{o.valor}</span>
              <span className={cn('tabular-nums shrink-0 text-[9px]', ativo ? 'text-white/80' : 'text-subtle')}>
                {o.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PainelSegmentadores({
  children,
  temFiltro,
  onLimparTudo,
  resumo,
}: {
  children:     React.ReactNode
  temFiltro:    boolean
  onLimparTudo: () => void
  resumo?:      React.ReactNode
}) {
  const [aberto, setAberto] = useState(true)

  return (
    <div className="border-b border-[0.5px] border-[var(--border-faint)]">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <button
          onClick={() => setAberto(a => !a)}
          className="text-[10px] text-muted hover:text-base flex items-center gap-1 cursor-pointer"
          title={aberto ? 'Recolher segmentadores' : 'Expandir segmentadores'}
        >
          <span className={cn('transition-transform', aberto && 'rotate-90')}>▸</span>
          Segmentadores
        </button>
        {resumo}
        {temFiltro && (
          <button
            onClick={onLimparTudo}
            className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[0.5px] border-[var(--border-input)] text-muted hover:bg-cream dark:hover:bg-hover cursor-pointer"
          >
            Remover filtros
          </button>
        )}
      </div>
      {aberto && (
        <div className="px-4 pb-2.5 grid gap-1.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {children}
        </div>
      )}
    </div>
  )
}
