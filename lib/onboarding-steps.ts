// Definição dos passos do tour de primeiro acesso.
// `target` é o valor do atributo data-tour do elemento a destacar (undefined = passo sem âncora, ex.: boas-vindas).
// `acao` é a permissão RBAC (ver PERMISSOES em lib/auth.ts) — passos cujo alvo o usuário não pode ver são pulados.

export interface OnboardingStep {
  id:      string
  target?: string
  titulo:  string
  texto:   string
  acao?:   string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id:     'dashboard',
    target: 'nav-/',
    titulo: 'Dashboard',
    texto:  'Aqui você acompanha a visão geral do dia: rotas em andamento, notas fiscais pendentes e indicadores da operação.',
    acao:   'dashboard',
  },
  {
    id:     'rotas',
    target: 'nav-/rotas',
    titulo: 'Rotas do dia',
    texto:  'Importe as notas fiscais do SIAT e gere rotas otimizadas com IA a partir delas.',
    acao:   'rotas',
  },
  {
    id:     'historico',
    target: 'nav-/historico',
    titulo: 'Histórico',
    texto:  'Consulte rotas já concluídas, com detalhes de entregas, motorista e ocorrências.',
    acao:   'historico',
  },
  {
    id:     'frota',
    target: 'nav-/frota',
    titulo: 'Frota',
    texto:  'Gerencie motoristas e veículos disponíveis para roteirização.',
    acao:   'frota',
  },
  {
    id:     'configuracoes',
    target: 'nav-/configuracoes',
    titulo: 'Configurações',
    texto:  'Ajuste parâmetros da operação, integrações e preferências do sistema.',
    acao:   'configuracoes',
  },
  {
    id:     'ajuda',
    target: 'sidebar-ajuda',
    titulo: 'Precisa rever isso depois?',
    texto:  'Clique aqui a qualquer momento para rodar este tour novamente.',
  },
]
