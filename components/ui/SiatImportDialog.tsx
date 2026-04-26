'use client'
import { useState } from 'react'
import { Btn, TextInput, Select } from '@/components/ui'
import type { SiatFilters } from '@/lib/siat'

export function SiatImportDialog({ onClose, onConfirm }: {
  onClose:   () => void
  onConfirm: (filters: SiatFilters) => void
}) {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim,    setDataFim]    = useState('')
  const [situacao,   setSituacao]   = useState('')
  const [codigoRota, setCodigoRota] = useState('')
  const [qtdMaxima,  setQtdMaxima]  = useState('')

  function handleConfirm() {
    const filters: SiatFilters = {}
    if (dataInicio) filters.dataInicio = dataInicio
    if (dataFim)    filters.dataFim    = dataFim
    if (situacao)   filters.situacao   = situacao
    if (codigoRota) filters.codigoRota = codigoRota.trim()
    const n = Number(qtdMaxima)
    if (qtdMaxima && Number.isFinite(n) && n > 0) filters.qtdMaxima = n
    onConfirm(filters)
  }

  return (
    <div
      className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] p-6 w-[460px] max-w-[90vw]">
        <div className="text-sm font-medium mb-1">Importar dados do SIAT</div>
        <div className="text-[11px] text-muted mb-4">
          Filtros opcionais — deixe em branco pra importar todas as NFs aguardando entrega.
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-muted mb-1">Data início (DATEMI)</label>
            <TextInput type="date" value={dataInicio} onChange={setDataInicio} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Data fim</label>
            <TextInput type="date" value={dataFim} onChange={setDataFim} />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] text-muted mb-1">Situação do veículo</label>
          <Select value={situacao} onChange={setSituacao}>
            <option value="">Todas</option>
            <option value="DISPONÍVEL">Disponível</option>
            <option value="EM ROTA">Em rota</option>
            <option value="MANUTENÇÃO">Manutenção</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-muted mb-1">Código da rota</label>
            <TextInput mono value={codigoRota} onChange={setCodigoRota} placeholder="ex: 34.1" />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Qtd. máxima de NFs</label>
            <TextInput type="number" value={qtdMaxima} onChange={setQtdMaxima} placeholder="sem limite" />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={handleConfirm}>
            <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10"/>
            </svg>
            Importar do SIAT
          </Btn>
        </div>
      </div>
    </div>
  )
}
