'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Btn, Card, CardHeader, TextInput, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface GradeCidade {
  id:     string
  cidade: string
  regiao: string | null
  grade:  string | null
}

const REGIOES = [
  'METROPOLITANA',
  'CENTRO OESTE',
  'V.AÇO/R.DOCE',
  'NORTE/S.CIPO',
  'Z.MATA/OESTE',
]

const GRADES = [
  'DIARIO',
  'DIAS ALTERNADOS',
  'SEGUNDA FEIRA',
  'TERÇA FEIRA',
  'QUARTA FEIRA',
  'QUINTA FEIRA',
  'SEXTA',
  'QUINZENAL',
  'DEDICADO',
]

export function GradeCidadesTable() {
  const [rows,        setRows]        = useState<GradeCidade[]>([])
  const [loading,     setLoading]     = useState(true)
  const [busca,       setBusca]       = useState('')
  const [regiaoFlt,   setRegiaoFlt]   = useState('Todas')
  const [gradeFlt,    setGradeFlt]    = useState('Todas')

  // ── Adicionar ────────────────────────────────────────────────────────────────
  const [addMode,    setAddMode]    = useState(false)
  const [addDraft,   setAddDraft]   = useState({ cidade: '', regiao: REGIOES[0], grade: GRADES[0] })
  const [addSaving,  setAddSaving]  = useState(false)
  const [addError,   setAddError]   = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Editar ───────────────────────────────────────────────────────────────────
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editDraft,  setEditDraft]  = useState({ cidade: '', regiao: '', grade: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  // ── Excluir ──────────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  // ── Deduplicar ───────────────────────────────────────────────────────────────
  const [normMode,    setNormMode]    = useState(false)
  const [normLoading, setNormLoading] = useState(false)
  const [normDone,    setNormDone]    = useState<number | null>(null)

  const duplicatas = useMemo(() => {
    const grupos = new Map<string, GradeCidade[]>()
    for (const r of rows) {
      const key = normalizar(r.cidade)
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(r)
    }
    return Array.from(grupos.values()).filter(g => g.length > 1)
  }, [rows])

  async function handleDeduplicar() {
    if (duplicatas.length === 0) return
    setNormLoading(true)
    const sb = getSupabaseBrowser()
    const idsParaRemover: string[] = []
    for (const grupo of duplicatas) {
      // manter o primeiro (menor id), remover os demais
      const [, ...resto] = grupo
      idsParaRemover.push(...resto.map(r => r.id))
    }
    await sb.from('grade_cidades').delete().in('id', idsParaRemover)
    setRows(prev => prev.filter(r => !idsParaRemover.includes(r.id)))
    setNormDone(idsParaRemover.length)
    setNormMode(false)
    setNormLoading(false)
    setTimeout(() => setNormDone(null), 4000)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (addMode) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [addMode])

  async function load() {
    setLoading(true)
    const sb = getSupabaseBrowser()
    const { data } = await sb
      .from('grade_cidades')
      .select('id, cidade, regiao, grade')
      .order('cidade', { ascending: true })
    if (data) setRows(data as GradeCidade[])
    setLoading(false)
  }

  // ── Filtro ───────────────────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    if (busca && !(r.cidade ?? '').toLowerCase().includes(busca.toLowerCase())) return false
    if (regiaoFlt !== 'Todas' && (r.regiao ?? '').toUpperCase() !== regiaoFlt) return false
    if (gradeFlt  !== 'Todas' && (r.grade  ?? '').toUpperCase() !== gradeFlt)  return false
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const cidade = addDraft.cidade.trim()
    if (!cidade) { setAddError('Informe o nome da cidade.'); return }
    setAddSaving(true)
    setAddError('')
    const sb = getSupabaseBrowser()
    const { error } = await sb
      .from('grade_cidades')
      .insert({ cidade, regiao: addDraft.regiao, grade: addDraft.grade })
    if (error) {
      setAddError(error.code === '23505' ? 'Cidade já cadastrada.' : error.message)
      setAddSaving(false)
      return
    }
    setAddMode(false)
    setAddDraft({ cidade: '', regiao: REGIOES[0], grade: GRADES[0] })
    setAddSaving(false)
    load()
  }

  function startEdit(row: GradeCidade) {
    if (editId === row.id) return
    setEditId(row.id)
    setEditDraft({ cidade: row.cidade, regiao: row.regiao ?? REGIOES[0], grade: row.grade ?? GRADES[0] })
    setEditError('')
    setDeleteConfirm(null)
  }

  function cancelEdit() { setEditId(null); setEditError('') }

  async function handleSaveEdit() {
    if (!editId) return
    const cidade = editDraft.cidade.trim()
    if (!cidade) { setEditError('Informe a cidade.'); return }
    setEditSaving(true)
    setEditError('')
    const sb = getSupabaseBrowser()
    const { error } = await sb
      .from('grade_cidades')
      .update({ cidade, regiao: editDraft.regiao, grade: editDraft.grade })
      .eq('id', editId)
    if (error) {
      setEditError(error.code === '23505' ? 'Já existe uma cidade com este nome.' : error.message)
      setEditSaving(false)
      return
    }
    setRows(prev => prev.map(r => r.id === editId ? { ...r, cidade, regiao: editDraft.regiao, grade: editDraft.grade } : r))
    setEditId(null)
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const sb = getSupabaseBrowser()
    await sb.from('grade_cidades').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
    setDeleteConfirm(null)
  }

  // ── Classes ──────────────────────────────────────────────────────────────────
  const thCls = 'text-left text-[10px] text-muted font-medium px-3 py-2 border-b border-[0.5px] border-[var(--border-subtle)] bg-page uppercase tracking-wide whitespace-nowrap'
  const tdCls = 'px-3 py-[6px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Tabela de cidades e frequências de entrega</span>
            {duplicatas.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warn-bg text-warn font-medium">
                {duplicatas.length} dup.
              </span>
            )}
            {normDone !== null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success-bg text-success font-medium">
                ✓ {normDone} removida{normDone !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Define em quais dias cada cidade recebe entrega. Consultada pelo agente IA ao gerar rotas.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {duplicatas.length > 0 && !normMode && (
            <Btn size="sm" variant="warn-soft" onClick={() => setNormMode(true)}>
              Deduplicar
            </Btn>
          )}
          <Btn
            size="sm"
            variant="primary"
            onClick={() => { setAddMode(true); setAddError(''); setEditId(null) }}
            disabled={addMode}
          >
            + Adicionar cidade
          </Btn>
        </div>
      </CardHeader>

      {/* Painel de deduplicação */}
      {normMode && (
        <div className="px-4 py-3 border-b border-[0.5px] border-warn bg-warn-bg/30">
          <div className="text-[11px] font-medium text-warn mb-1.5">
            {duplicatas.length} grupo{duplicatas.length !== 1 ? 's' : ''} com nomes duplicados detectado{duplicatas.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-[80px] overflow-y-auto">
            {duplicatas.map(grupo => (
              <span key={grupo[0].id} className="text-[10px] px-2 py-0.5 rounded bg-warn-bg text-warn border border-warn/30 whitespace-nowrap">
                {grupo[0].cidade} ({grupo.length}×)
              </span>
            ))}
          </div>
          <div className="text-[10px] text-muted mb-2">
            Será mantida a primeira entrada de cada grupo. As demais serão excluídas permanentemente.
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="danger-soft" onClick={handleDeduplicar} disabled={normLoading}>
              {normLoading ? '…' : `Remover ${duplicatas.reduce((acc, g) => acc + g.length - 1, 0)} duplicata${duplicatas.reduce((acc, g) => acc + g.length - 1, 0) !== 1 ? 's' : ''}`}
            </Btn>
            <button
              onClick={() => setNormMode(false)}
              className="text-[11px] text-muted hover:text-base cursor-pointer bg-transparent border-none transition-colors px-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-[0.5px] border-[var(--border-faint)]">
        <div className="flex-1 min-w-[150px] max-w-[210px]">
          <TextInput value={busca} onChange={v => setBusca(v)} placeholder="Buscar cidade…" />
        </div>
        <Select value={regiaoFlt} onChange={v => setRegiaoFlt(v)}>
          <option value="Todas">Região</option>
          {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={gradeFlt} onChange={v => setGradeFlt(v)}>
          <option value="Todas">Grade</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </Select>
        {!loading && (
          <span className="text-[10px] text-muted ml-auto">
            {filtered.length} de {rows.length} cidade{rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted">
            <svg className="w-4 h-4 text-primary animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
            </svg>
            <span className="text-[12px]">Carregando cidades…</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={thCls}>Cidade</th>
                <th className={thCls}>Região</th>
                <th className={thCls}>Grade</th>
                <th className={cn(thCls, 'w-[160px] text-right pr-4')} />
              </tr>
            </thead>
            <tbody>

              {/* Linha de adição */}
              {addMode && (
                <tr className="bg-primary-bg dark:bg-[#111e31]">
                  <td className={tdCls}>
                    <input
                      ref={addInputRef}
                      value={addDraft.cidade}
                      onChange={e => setAddDraft(p => ({ ...p, cidade: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddMode(false) }}
                      placeholder="Nome da cidade"
                      className="w-full h-7 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-white dark:bg-[#1a2a3a] px-2.5 text-xs font-sans outline-none focus:border-primary transition-colors"
                    />
                    {addError && <div className="text-[10px] text-danger mt-1">{addError}</div>}
                  </td>
                  <td className={tdCls}>
                    <Select value={addDraft.regiao} onChange={v => setAddDraft(p => ({ ...p, regiao: v }))}>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </td>
                  <td className={tdCls}>
                    <Select value={addDraft.grade} onChange={v => setAddDraft(p => ({ ...p, grade: v }))}>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </Select>
                  </td>
                  <td className={cn(tdCls, 'text-right pr-3')}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Btn size="sm" variant="success" onClick={handleAdd} disabled={addSaving}>
                        {addSaving ? '…' : 'Salvar'}
                      </Btn>
                      <button
                        onClick={() => { setAddMode(false); setAddError('') }}
                        className="text-[11px] text-muted hover:text-base cursor-pointer bg-transparent border-none transition-colors px-1"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Estado vazio */}
              {filtered.length === 0 && !addMode && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[12px] text-muted">
                    {rows.length === 0
                      ? 'Nenhuma cidade cadastrada. Clique em "+ Adicionar cidade" para começar.'
                      : 'Nenhuma cidade corresponde aos filtros selecionados.'}
                  </td>
                </tr>
              )}

              {/* Linhas de dados */}
              {filtered.map((row, i) => {
                const isEditing = editId === row.id
                const isDelConf = deleteConfirm === row.id
                const isDel     = deleting === row.id
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page',
                      !isEditing && 'cursor-pointer hover:bg-cream dark:hover:bg-[#28282A]',
                      'transition-colors',
                    )}
                    onClick={() => { if (!isEditing) startEdit(row) }}
                  >
                    {/* Cidade */}
                    <td className={cn(tdCls, 'font-medium')} onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <TextInput
                          value={editDraft.cidade}
                          onChange={v => setEditDraft(p => ({ ...p, cidade: v }))}
                          placeholder="Nome da cidade"
                        />
                      ) : row.cidade}
                    </td>

                    {/* Região */}
                    <td className={cn(tdCls)} onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <Select value={editDraft.regiao} onChange={v => setEditDraft(p => ({ ...p, regiao: v }))}>
                          {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                      ) : (
                        row.regiao
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-bg text-primary-dark font-medium whitespace-nowrap">{row.regiao}</span>
                          : <span className="text-subtle">—</span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className={cn(tdCls)} onClick={e => isEditing && e.stopPropagation()}>
                      {isEditing ? (
                        <Select value={editDraft.grade} onChange={v => setEditDraft(p => ({ ...p, grade: v }))}>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </Select>
                      ) : (
                        row.grade
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream text-mid font-medium whitespace-nowrap">{row.grade}</span>
                          : <span className="text-subtle">—</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className={cn(tdCls, 'text-right pr-3 whitespace-nowrap')} onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {editError && <span className="text-[10px] text-danger mr-1">{editError}</span>}
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

      {/* Rodapé com contagem */}
      {!loading && rows.length > 0 && (
        <div className="px-4 py-2 border-t border-[0.5px] border-[var(--border-faint)] flex items-center justify-between">
          <span className="text-[10px] text-muted">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · {rows.length} total
          </span>
          {(busca || regiaoFlt !== 'Todas' || gradeFlt !== 'Todas') && (
            <button
              onClick={() => { setBusca(''); setRegiaoFlt('Todas'); setGradeFlt('Todas') }}
              className="text-[10px] text-muted hover:text-danger cursor-pointer bg-transparent border-none transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
