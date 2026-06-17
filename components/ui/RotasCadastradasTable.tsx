'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Btn, Card, CardHeader, TextInput, TextArea, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RotaCadastrada {
  id:               number
  codigo_rota:      string
  descricao:        string | null
  regiao:           string | null
  tipo_veiculo:     string | null
  motorista_padrao: string | null
  observacoes:      string | null
  ativo:            boolean
}

type Draft = {
  codigo_rota:      string
  descricao:        string
  regiao:           string
  tipo_veiculo:     string
  motorista_padrao: string
  observacoes:      string
}

const TIPOS_VEICULO = ['Fiorino', 'VUC', '3/4', 'Truck', 'Carreta']

const EMPTY_DRAFT: Draft = {
  codigo_rota: '', descricao: '', regiao: '',
  tipo_veiculo: 'VUC', motorista_padrao: '', observacoes: '',
}

function rowToDraft(row: RotaCadastrada): Draft {
  return {
    codigo_rota:      row.codigo_rota,
    descricao:        row.descricao        ?? '',
    regiao:           row.regiao           ?? '',
    tipo_veiculo:     row.tipo_veiculo     ?? 'VUC',
    motorista_padrao: row.motorista_padrao ?? '',
    observacoes:      row.observacoes      ?? '',
  }
}

// ── Modal de adição ───────────────────────────────────────────────────────────

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [draft,   setDraft]   = useState<Draft>(EMPTY_DRAFT)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const set = (k: keyof Draft, v: string) => setDraft(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!draft.codigo_rota.trim()) { setError('Informe o código da rota.'); return }
    setSaving(true)
    setError('')
    const sb = getSupabaseBrowser()
    const { error: err } = await sb.from('rotas_cadastradas').insert({
      codigo_rota:      draft.codigo_rota.trim(),
      descricao:        draft.descricao        || null,
      regiao:           draft.regiao           || null,
      tipo_veiculo:     draft.tipo_veiculo     || null,
      motorista_padrao: draft.motorista_padrao || null,
      observacoes:      draft.observacoes      || null,
      ativo:            true,
    })
    if (err) {
      setError(err.code === '23505' ? 'Já existe uma rota com este código.' : err.message)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] w-[480px] max-w-full max-h-[90vh] overflow-y-auto shadow-xl">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[0.5px] border-[var(--border-faint)]">
          <div>
            <div className="text-sm font-semibold">Nova rota cadastrada</div>
            <div className="text-[11px] text-muted mt-0.5">Preencha os dados da rota</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-base hover:bg-cream transition-colors cursor-pointer bg-transparent border-none"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 2l12 12M14 2L2 14"/>
            </svg>
          </button>
        </div>

        {/* Campos */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-1">Código da rota <span className="text-danger">*</span></label>
            <TextInput
              value={draft.codigo_rota}
              onChange={v => set('codigo_rota', v)}
              placeholder="Ex: 30.12 BARREIRO"
              mono
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Descrição</label>
            <TextInput
              value={draft.descricao}
              onChange={v => set('descricao', v)}
              placeholder="Descrição da rota"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted mb-1">Motorista padrão</label>
              <TextInput
                value={draft.motorista_padrao}
                onChange={v => set('motorista_padrao', v)}
                placeholder="Nome do motorista"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">Tipo de veículo</label>
              <Select value={draft.tipo_veiculo} onChange={v => set('tipo_veiculo', v)}>
                <option value="">— Selecione —</option>
                {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Região</label>
            <TextInput
              value={draft.regiao}
              onChange={v => set('regiao', v)}
              placeholder="Ex: METROPOLITANA"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Observações</label>
            <TextArea
              value={draft.observacoes}
              onChange={v => set('observacoes', v)}
              placeholder="Observações para o agente IA…"
              rows={3}
            />
          </div>
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </div>

        {/* Rodapé */}
        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-[0.5px] border-[var(--border-faint)]">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar rota'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Toggle Ativo ──────────────────────────────────────────────────────────────

function AtivoToggle({ ativo, loading, onToggle }: { ativo: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
        ativo ? 'bg-cond-ok' : 'bg-[var(--border-input)]',
        loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200',
          ativo ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RotasCadastradasTable() {
  const [rows,         setRows]        = useState<RotaCadastrada[]>([])
  const [loading,      setLoading]     = useState(true)
  const [busca,        setBusca]       = useState('')
  const [showModal,    setShowModal]   = useState(false)
  const [visibleCount, setVisibleCount] = useState(25)

  // Edição inline
  const [editId,     setEditId]     = useState<number | null>(null)
  const [editDraft,  setEditDraft]  = useState<Draft>(EMPTY_DRAFT)
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  // Toggle ativo
  const [togglingId, setTogglingId] = useState<number | null>(null)

  // Exclusão
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleting,      setDeleting]      = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = getSupabaseBrowser()
    const { data } = await sb
      .from('rotas_cadastradas')
      .select('id, codigo_rota, descricao, regiao, tipo_veiculo, motorista_padrao, observacoes, ativo')
      .order('codigo_rota', { ascending: true })
    if (data) setRows(data as RotaCadastrada[])
    setLoading(false)
  }

  useEffect(() => { setVisibleCount(25) }, [busca])

  // ── Filtro ────────────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      (r.codigo_rota      ?? '').toLowerCase().includes(q) ||
      (r.descricao        ?? '').toLowerCase().includes(q) ||
      (r.motorista_padrao ?? '').toLowerCase().includes(q)
    )
  })
  const visible = filtered.slice(0, visibleCount)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function startEdit(row: RotaCadastrada) {
    if (editId === row.id) return
    setEditId(row.id)
    setEditDraft(rowToDraft(row))
    setEditError('')
    setDeleteConfirm(null)
  }

  function cancelEdit() { setEditId(null); setEditError('') }

  async function handleSaveEdit() {
    if (!editId) return
    if (!editDraft.codigo_rota.trim()) { setEditError('Informe o código da rota.'); return }
    setEditSaving(true)
    setEditError('')
    const sb = getSupabaseBrowser()
    const { error } = await sb
      .from('rotas_cadastradas')
      .update({
        codigo_rota:      editDraft.codigo_rota.trim(),
        descricao:        editDraft.descricao        || null,
        regiao:           editDraft.regiao           || null,
        tipo_veiculo:     editDraft.tipo_veiculo     || null,
        motorista_padrao: editDraft.motorista_padrao || null,
        observacoes:      editDraft.observacoes      || null,
      })
      .eq('id', editId)
    if (error) {
      setEditError(error.code === '23505' ? 'Já existe uma rota com este código.' : error.message)
      setEditSaving(false)
      return
    }
    setRows(prev => prev.map(r =>
      r.id === editId
        ? { ...r, ...editDraft, descricao: editDraft.descricao || null, regiao: editDraft.regiao || null,
            tipo_veiculo: editDraft.tipo_veiculo || null, motorista_padrao: editDraft.motorista_padrao || null,
            observacoes: editDraft.observacoes || null }
        : r
    ))
    setEditId(null)
    setEditSaving(false)
  }

  async function toggleAtivo(id: number, novoValor: boolean) {
    setTogglingId(id)
    const sb = getSupabaseBrowser()
    await sb.from('rotas_cadastradas').update({ ativo: novoValor }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, ativo: novoValor } : r))
    setTogglingId(null)
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    const sb = getSupabaseBrowser()
    await sb.from('rotas_cadastradas').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
    setDeleteConfirm(null)
  }

  // ── Classes ───────────────────────────────────────────────────────────────

  const thCls = 'text-left text-[10px] text-muted font-medium px-3 py-2 border-b border-[0.5px] border-[var(--border-subtle)] bg-page uppercase tracking-wide whitespace-nowrap sticky top-0'
  const tdCls = 'px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px] align-middle'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <div className="text-xs font-medium">Rotas cadastradas</div>
            <div className="text-[11px] text-muted mt-0.5">
              Define os códigos de rota, motoristas padrão e tipo de veículo. O agente IA usa essa tabela ao sugerir alocações.
            </div>
          </div>
          <Btn variant="primary" size="sm" onClick={() => setShowModal(true)}>
            + Nova rota
          </Btn>
        </CardHeader>

        {/* Busca */}
        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-[0.5px] border-[var(--border-faint)]">
          <div className="flex-1 max-w-[280px]">
            <TextInput value={busca} onChange={v => setBusca(v)} placeholder="Buscar código, descrição ou motorista…" />
          </div>
          {!loading && (
            <span className="text-[10px] text-muted ml-auto">
              {filtered.length} de {rows.length} rota{rows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted">
              <svg className="w-4 h-4 text-primary animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
              </svg>
              <span className="text-[12px]">Carregando rotas…</span>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="z-10">
                <tr>
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>Motorista padrão</th>
                  <th className={thCls}>Tipo veículo</th>
                  <th className={cn(thCls, 'text-center')}>Ativo</th>
                  <th className={cn(thCls, 'w-[130px] text-right pr-4')} />
                </tr>
              </thead>
              <tbody>

                {/* Estado vazio */}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-muted">
                      {rows.length === 0
                        ? 'Nenhuma rota cadastrada. Clique em "+ Nova rota" para começar.'
                        : 'Nenhuma rota corresponde à busca.'}
                    </td>
                  </tr>
                )}

                {visible.map((row, i) => {
                  const isEditing = editId === row.id
                  const isDelConf = deleteConfirm === row.id
                  const isDel     = deleting === row.id
                  const set = (k: keyof Draft, v: string) => setEditDraft(p => ({ ...p, [k]: v }))

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page',
                        !isEditing && 'cursor-pointer hover:bg-cream dark:hover:bg-[#28282A]',
                        'transition-colors',
                        !row.ativo && !isEditing && 'opacity-50',
                      )}
                      onClick={() => { if (!isEditing) startEdit(row) }}
                    >
                      {/* Código rota */}
                      <td className={cn(tdCls, 'font-mono font-medium whitespace-nowrap')} onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing
                          ? <TextInput value={editDraft.codigo_rota} onChange={v => set('codigo_rota', v)} mono placeholder="30.12 BARREIRO" />
                          : row.codigo_rota}
                      </td>

                      {/* Descrição */}
                      <td className={cn(tdCls, 'max-w-[160px]')} onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing
                          ? <TextInput value={editDraft.descricao} onChange={v => set('descricao', v)} placeholder="Descrição" />
                          : <span className="truncate block text-muted" title={row.descricao ?? ''}>{row.descricao ?? <span className="text-subtle">—</span>}</span>}
                      </td>

                      {/* Motorista padrão */}
                      <td className={cn(tdCls, 'max-w-[140px]')} onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing
                          ? <TextInput value={editDraft.motorista_padrao} onChange={v => set('motorista_padrao', v)} placeholder="Nome" />
                          : <span className="truncate block" title={row.motorista_padrao ?? ''}>{row.motorista_padrao ?? <span className="text-subtle">—</span>}</span>}
                      </td>

                      {/* Tipo veículo */}
                      <td className={tdCls} onClick={e => isEditing && e.stopPropagation()}>
                        {isEditing
                          ? (
                            <Select value={editDraft.tipo_veiculo} onChange={v => set('tipo_veiculo', v)}>
                              <option value="">— Tipo —</option>
                              {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                          )
                          : row.tipo_veiculo
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream text-mid font-medium whitespace-nowrap">{row.tipo_veiculo}</span>
                            : <span className="text-subtle">—</span>}
                      </td>

                      {/* Toggle ativo */}
                      <td className={cn(tdCls, 'text-center')} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <AtivoToggle
                            ativo={row.ativo}
                            loading={togglingId === row.id}
                            onToggle={() => toggleAtivo(row.id, !row.ativo)}
                          />
                        </div>
                      </td>

                      {/* Ações */}
                      <td className={cn(tdCls, 'text-right pr-3 whitespace-nowrap')} onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <Btn size="sm" variant="success" onClick={handleSaveEdit} disabled={editSaving}>
                                {editSaving ? '…' : 'Salvar'}
                              </Btn>
                              <button
                                onClick={cancelEdit}
                                className="text-[11px] text-muted hover:text-base cursor-pointer bg-transparent border-none transition-colors px-1"
                              >
                                Cancelar
                              </button>
                            </div>
                            {editError && <span className="text-[10px] text-danger">{editError}</span>}
                          </div>
                        ) : isDelConf ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-danger">Excluir?</span>
                            <Btn size="sm" variant="danger-soft" onClick={() => handleDelete(row.id)} disabled={isDel}>
                              {isDel ? '…' : 'Sim'}
                            </Btn>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[11px] text-muted hover:text-base cursor-pointer bg-transparent border-none transition-colors px-1"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => startEdit(row)}
                              className="text-[11px] text-muted hover:text-primary px-2 py-1 rounded hover:bg-primary-bg cursor-pointer bg-transparent border-none transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => { setDeleteConfirm(row.id); setEditId(null) }}
                              className="text-[11px] text-muted hover:text-danger px-2 py-1 rounded hover:bg-danger-bg cursor-pointer bg-transparent border-none transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Ver mais */}
        {!loading && visible.length < filtered.length && (
          <div className="px-4 py-3 border-t border-[0.5px] border-[var(--border-faint)] flex justify-center">
            <button
              onClick={() => setVisibleCount(c => c + 25)}
              className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none transition-colors"
            >
              Ver mais {Math.min(25, filtered.length - visible.length)} rotas ({filtered.length - visible.length} restantes)
            </button>
          </div>
        )}

        {/* Rodapé */}
        {!loading && rows.length > 0 && (
          <div className="px-4 py-2 border-t border-[0.5px] border-[var(--border-faint)] flex items-center justify-between">
            <span className="text-[10px] text-muted">
              {visible.length} de {filtered.length} · {rows.filter(r => r.ativo).length} ativa{rows.filter(r => r.ativo).length !== 1 ? 's' : ''} · {rows.length} total
            </span>
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="text-[10px] text-muted hover:text-danger cursor-pointer bg-transparent border-none transition-colors"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
      </Card>

      {showModal && (
        <AddModal
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </>
  )
}
