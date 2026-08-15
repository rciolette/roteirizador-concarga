// ─────────────────────────────────────────────────────────────────────────────
// Engine INTERNO de roteirização — substitui o WF-B do n8n quando ativado.
//
// Fluxo (porta fiel do workflow "WF-B — Gerador de Rotas Concarga"):
//   1. prepararDados()   — NFs do payload + frota declarada pelo operador
//   2. carregarReferencias() — rotas_cadastradas / grade_cidades / configuracoes
//   3. chamarModelo()    — OpenAI Chat Completions (modelo configurável)
//   4. parsearResposta() — reidrata NFs pelos números, monta link do Maps
//   5. gravarResultado() — INSERT em `rotas` e `notas_fiscais` (Supabase)
// O painel acompanha por polling (aguardarRotasGeradas) — nada muda no cliente.
//
// Server-only: usa a service role do Supabase e a OPENAI_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import type { GerarRotasPayload } from '@/lib/webhooks'
import { PROMPT_MESTRE, montarPromptUsuario } from '@/lib/roteirizador/prompt-mestre'

const MODELO_DEFAULT = 'gpt-4.1-mini'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role não configurada')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Normalizações (portadas do nó "Preparar Dados para IA") ──────────────────
const norm = (s: unknown) => (s ?? '').toString().trim().toUpperCase()

function iso(d: unknown): string | null {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  const s = String(d).trim()
  const br = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (ymd) return ymd[1]
  const p = new Date(s)
  return isNaN(p.getTime()) ? null : p.toISOString().slice(0, 10)
}

interface NfPreparada {
  numnfs:          number | string
  rota:            string | null
  pesoBruto:       number
  destinatario:    string | null
  municipio:       string | null
  bairro:          string | null
  endereco:        string | null
  numero:          string | null
  uf:              string | null
  cep:             string | null
  tipoCliente:     string | null
  regiao:          string | null
  dataEmissao:     string | null
  dataAgendamento: string | null
  horaAgendamento: string | null
  cond:            'ok' | 'laranja' | 'vermelho'
  reentrega:       boolean
  sac:             string | null
  observacao:      string | null
  sequencia?:      number
}

interface VeiculoPreparado {
  placa:        string
  tipoVeiculo:  string
  capacidadeKg: number
  motorista:    string
  celular:      string
}

export interface DadosPreparados {
  nfs:      NfPreparada[]
  veiculos: VeiculoPreparado[]
  dataEntrega: string
  limiteOcupacaoPercent: number
}

export function prepararDados(payload: GerarRotasPayload): DadosPreparados {
  const hojeIso = new Date().toISOString().slice(0, 10)
  const derivaCond = (ag: string | null): NfPreparada['cond'] => {
    if (!ag) return 'ok'
    return ag <= hojeIso ? 'vermelho' : 'laranja'
  }

  const rows = Array.isArray(payload.notasFiscais) ? payload.notasFiscais as Record<string, unknown>[] : []
  const nfs: NfPreparada[] = rows
    .filter(n => n.NUMNFS != null)
    .map(n => {
      const ag = iso(n.DataAgendamento)
      return {
        numnfs:          n.NUMNFS as number | string,
        rota:            (n.ROTA as string) ?? null,
        pesoBruto:       Number(n.PesoBruto) || 0,
        destinatario:    (n.Destinatario as string) ?? null,
        municipio:       (n.MunicipioFinal as string) || (n.Municipio as string) || null,
        bairro:          (n.BairroFinal as string)    || (n.Bairro as string)    || null,
        endereco:        (n.EnderecoFinal as string)  || (n.Endereco as string)  || null,
        numero:          (n.Numero as string) ?? null,
        uf:              (n.UFFinal as string) || (n.UF as string) || null,
        cep:             (n.Cep as string) ?? null,
        tipoCliente:     (n.TipoCliente as string) ?? null,
        regiao:          (n.Regiao as string) ?? null,
        dataEmissao:     iso(n.DataEmissao),
        dataAgendamento: ag,
        horaAgendamento: n.HoraAgendamento != null ? String(n.HoraAgendamento) : null,
        cond:            derivaCond(ag),
        reentrega:       n.Reentrega === 1 || n.Reentrega === true,
        sac:             n.SAC != null ? String(n.SAC) : null,
        observacao:      (n.Observacao as string) ?? null,
      }
    })

  const ausentes   = (payload.motoristasAusentes ?? []).map(norm).filter(Boolean)
  const bloqueados = (payload.veiculosBloqueados ?? []).map(norm).filter(Boolean)

  const veiculos: VeiculoPreparado[] = (payload.veiculosDisponiveis ?? [])
    .map(v => ({
      placa:        norm(v.placa),
      tipoVeiculo:  v.tipo ?? '',
      capacidadeKg: Number(v.capacidadeKg) || 0,
      motorista:    v.motoristaNome ?? '',
      celular:      v.motoristaCelular ?? '',
    }))
    .filter(v =>
      v.placa &&
      !bloqueados.includes(v.placa) &&
      !ausentes.some(a => a && norm(v.motorista).includes(a)),
    )

  return {
    nfs,
    veiculos,
    dataEntrega: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    limiteOcupacaoPercent: 95,
  }
}

// ── Referências (catálogo de rotas, grade de cidades, config da empresa) ─────
async function carregarReferencias(admin: ReturnType<typeof getAdmin>) {
  const [rc, gc, cfg] = await Promise.all([
    admin.from('rotas_cadastradas').select('*'),
    admin.from('grade_cidades').select('*').limit(2000),
    admin.from('configuracoes').select('*'),
  ])
  return {
    rotasCadastradas: rc.data ?? [],
    gradeCidades:     gc.data ?? [],
    configuracoes:    cfg.data ?? [],
  }
}

// ── Chamada ao modelo ────────────────────────────────────────────────────────
async function chamarModelo(system: string, user: string, modelo: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY não configurada no ambiente')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`)
  }
  const json = await res.json() as { choices?: { message?: { content?: string } }[] }
  return json.choices?.[0]?.message?.content ?? ''
}

// ── Parse + reidratação (portado do nó "Parsear Resposta IA") ────────────────
interface RotaSupabase {
  data: string
  codigo_rota: string
  sub_rota: string | null
  regiao: string
  status: string
  veiculo_placa: string | null
  motorista_nome: string | null
  motorista_celular: string | null
  peso_total: number
  ocupacao_percent: number
  qtd_notas: number
  tempo_estimado_min: number | null
  horario_saida: string
  link_maps: string | null
  alertas: unknown[]
  _notas: NfPreparada[]
}

function montarLink(notas: NfPreparada[]): string | null {
  const vistos = new Set<string>()
  const paradas: string[] = []
  for (const n of notas) {
    const addr = [n.endereco, n.bairro, n.municipio].filter(x => x && x !== '-').join(', ')
    if (!addr) continue
    const k = addr.toUpperCase()
    if (vistos.has(k)) continue
    vistos.add(k)
    paradas.push(addr)
  }
  if (paradas.length === 0) return null
  return 'https://www.google.com/maps/dir/' +
    paradas.slice(0, 25).map(p => encodeURIComponent(p).replace(/%20/g, '+')).join('/')
}

export function parsearResposta(bruto: string, prep: DadosPreparados): {
  rotasSupabase: RotaSupabase[]
  naoAlocadas:   { numnfs: unknown; motivo: string; origem: string }[]
  erro?:         string
} {
  const porNumero = new Map<string, NfPreparada>()
  for (const nf of prep.nfs) porNumero.set(String(nf.numnfs), nf)

  let parsed: Record<string, unknown>
  try {
    let txt = String(bruto).trim()
    txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const ini = txt.indexOf('{')
    const fim = txt.lastIndexOf('}')
    if (ini < 0 || fim <= ini) throw new Error('nenhum JSON na resposta')
    parsed = JSON.parse(txt.slice(ini, fim + 1))
  } catch (e) {
    return {
      rotasSupabase: [],
      naoAlocadas: [],
      erro: 'Falha ao parsear resposta do agente: ' + (e instanceof Error ? e.message : String(e)),
    }
  }

  const data = (parsed.dataEntrega as string) ?? prep.dataEntrega
  const usadas = new Set<string>()

  type RotaIA = {
    codigoRota?: string; subRota?: string; veiculoPlaca?: string
    motoristaNome?: string; motoristaCelular?: string
    pesoTotal?: number; ocupacaoPercent?: number
    tempoEstimadoMin?: number; horarioSaida?: string; alertas?: unknown[]
    nfs?: unknown[]; notas?: { nNF?: unknown; numnfs?: unknown }[]
  }

  const rotasSupabase: RotaSupabase[] = ((parsed.rotas as RotaIA[]) ?? []).map(r => {
    const nums: unknown[] = Array.isArray(r.nfs)
      ? r.nfs
      : (Array.isArray(r.notas) ? r.notas.map(n => n.nNF ?? n.numnfs) : [])

    const notas: NfPreparada[] = []
    for (const num of nums) {
      const nf = porNumero.get(String(num))
      if (!nf || usadas.has(String(num))) continue
      usadas.add(String(num))
      notas.push({ ...nf, sequencia: notas.length + 1 })
    }

    const pesoTotal = notas.reduce((a, n) => a + (Number(n.pesoBruto) || 0), 0)
    const codigo = r.codigoRota ?? ''

    return {
      data,
      codigo_rota:        codigo,
      sub_rota:           r.subRota || null,
      regiao:             notas[0]?.regiao ?? (String(codigo).split(' ').slice(1).join(' ') || codigo),
      status:             'aguardando',
      veiculo_placa:      r.veiculoPlaca     || null,
      motorista_nome:     r.motoristaNome    || null,
      motorista_celular:  r.motoristaCelular || null,
      peso_total:         Number(r.pesoTotal) || pesoTotal,
      ocupacao_percent:   Number(r.ocupacaoPercent) || 0,
      qtd_notas:          notas.length,
      tempo_estimado_min: r.tempoEstimadoMin ?? null,
      horario_saida:      r.horarioSaida ?? '03:00',
      link_maps:          montarLink(notas),
      alertas:            r.alertas ?? [],
      _notas:             notas,
    }
  }).filter(r => r.qtd_notas > 0)

  type NfMotivo = { nNF?: unknown; numnfs?: unknown; motivo?: string }
  const marcadas = [
    ...(((parsed.nfsExcluidas as NfMotivo[]) ?? []).map(n => ({ numnfs: n.nNF ?? n.numnfs, motivo: n.motivo ?? 'excluida', origem: 'excluida' }))),
    ...(((parsed.nfsAguardando as NfMotivo[]) ?? []).map(n => ({ numnfs: n.nNF ?? n.numnfs, motivo: n.motivo ?? 'aguardando', origem: 'aguardando' }))),
  ].filter(n => n.numnfs != null)

  const jaListadas = new Set(marcadas.map(n => String(n.numnfs)))
  const esquecidas = prep.nfs
    .filter(nf => !usadas.has(String(nf.numnfs)) && !jaListadas.has(String(nf.numnfs)))
    .map(nf => ({ numnfs: nf.numnfs as unknown, motivo: 'nao retornada pelo roteirizador', origem: 'excluida' }))

  return { rotasSupabase, naoAlocadas: [...marcadas, ...esquecidas] }
}

// ── Gravação (portado dos nós "Expandir Rotas/NFs" + INSERTs do Supabase) ────
async function gravarResultado(admin: ReturnType<typeof getAdmin>, rotas: RotaSupabase[]): Promise<number> {
  if (rotas.length === 0) return 0

  const payloadRotas = rotas.map(r => {
    const { _notas: _ignorado, ...resto } = r
    void _ignorado
    return resto
  })

  const { data: inseridas, error } = await admin
    .from('rotas')
    .insert(payloadRotas)
    .select('id, veiculo_placa')
  if (error) throw new Error(`INSERT rotas: ${error.message}`)

  const nfsRows: Record<string, unknown>[] = []
  ;(inseridas ?? []).forEach((row, idx) => {
    const rotaId = row.id as string
    if (!rotaId) return
    const notas = rotas[idx]?._notas ?? []
    notas.forEach((n, i) => {
      nfsRows.push({
        rota_id:          rotaId,
        n_nfs:            parseInt(String(n.numnfs), 10),
        destinatario:     n.destinatario ?? null,
        municipio:        n.municipio ?? null,
        bairro:           n.bairro ?? null,
        endereco:         n.endereco ?? null,
        cep:              n.cep ?? null,
        peso_kg:          Number(n.pesoBruto) || 0,
        tipo_cliente:     n.tipoCliente ?? null,
        cond:             n.cond ?? 'ok',
        agendamento:      n.dataAgendamento ?? null,
        hora_agendamento: n.horaAgendamento ?? null,
        reentrega:        n.reentrega ?? false,
        sac:              n.sac ?? null,
        observacao:       n.observacao ?? null,
        sequencia:        n.sequencia ?? (i + 1),
      })
    })
  })

  for (let i = 0; i < nfsRows.length; i += 500) {
    const { error: e2 } = await admin.from('notas_fiscais').insert(nfsRows.slice(i, i + 500))
    if (e2) throw new Error(`INSERT notas_fiscais: ${e2.message}`)
  }

  return rotas.length
}

// ── Orquestração ─────────────────────────────────────────────────────────────
export async function executarRoteirizacaoInterna(payload: GerarRotasPayload, modelo?: string): Promise<void> {
  const inicio = Date.now()
  const admin = getAdmin()
  try {
    const prep = prepararDados(payload)
    if (prep.nfs.length === 0)      throw new Error('payload sem notas fiscais — importe o SIAT antes de gerar')
    if (prep.veiculos.length === 0) throw new Error('payload sem veículos — marque a frota do dia no diálogo')

    const refs = await carregarReferencias(admin)

    const promptUsuario = montarPromptUsuario({
      dataEntrega:           prep.dataEntrega,
      observacoes:           payload.observacoes ?? '',
      restricoesExtras:      payload.restricoesExtras ?? '',
      instrucaoGlobal:       payload.instrucaoGlobal ?? '',
      instrucoesPorRota:     payload.instrucoesPorRota ?? [],
      prioridade:            payload.prioridade ?? 'padrao',
      motoristasAusentes:    payload.motoristasAusentes ?? [],
      veiculosBloqueados:    payload.veiculosBloqueados ?? [],
      limiteOcupacaoPercent: prep.limiteOcupacaoPercent,
      grades:                payload.grades ?? [],
      pesos:                 payload.pesos,
      horarios:              payload.horarios,
      rotasCadastradas:      refs.rotasCadastradas,
      gradeCidades:          refs.gradeCidades,
      configuracoes:         refs.configuracoes,
      veiculos:              prep.veiculos,
      nfs:                   prep.nfs,
    })

    const resposta = await chamarModelo(PROMPT_MESTRE, promptUsuario, modelo || process.env.OPENAI_MODEL || MODELO_DEFAULT)
    const resultado = parsearResposta(resposta, prep)
    if (resultado.erro) throw new Error(resultado.erro)

    const gravadas = await gravarResultado(admin, resultado.rotasSupabase)
    console.log(`[roteirizador-interno] ok: ${gravadas} rotas, ${resultado.naoAlocadas.length} NFs não alocadas, ${Math.round((Date.now() - inicio) / 1000)}s`)
  } catch (err) {
    // O painel acompanha por polling — sem rotas novas, ele mostra timeout.
    // Logamos aqui para diagnóstico via Vercel logs.
    console.error('[roteirizador-interno] FALHA:', err instanceof Error ? err.message : err)
    throw err
  }
}
