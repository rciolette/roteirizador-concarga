// Mapeamento de rotas → ação de permissão. Fonte única usada por proxy e Sidebar.

// Páginas. Valor null = qualquer usuário autenticado pode acessar.
export const ROTA_PERMISSAO: Record<string, string | null> = {
  '/':              'dashboard',
  '/rotas':         'rotas',
  '/rotas/acoes':   'aprovar',
  '/historico':     'historico',
  '/frota':         'frota',
  '/configuracoes': 'configuracoes',
  '/usuarios':      'usuarios',
  '/perfil':        null,
}

// API routes.
export const API_PERMISSAO: Record<string, string> = {
  '/api/config':           'webhooks',
  '/api/config/webhooks':  'webhooks',
  '/api/gerar-rotas':      'gerar',
  '/api/enviar-motorista': 'enviar',
  '/api/siat':             'importar',
  '/api/usuarios':         'usuarios',
  '/api/convites':         'usuarios',
  '/api/empresa':          'empresa',
}

// Retorna a ação exigida para uma rota de página.
// undefined = rota não mapeada (sem restrição de perfil além de estar logado).
export function permissaoDaRota(pathname: string): string | null | undefined {
  if (pathname in ROTA_PERMISSAO) return ROTA_PERMISSAO[pathname]
  if (pathname.startsWith('/rotas/acoes'))    return 'aprovar'
  if (pathname.startsWith('/rotas'))          return 'rotas'
  if (pathname.startsWith('/frota'))          return 'frota'
  if (pathname.startsWith('/historico'))      return 'historico'
  if (pathname.startsWith('/configuracoes'))  return 'configuracoes'
  if (pathname.startsWith('/usuarios'))       return 'usuarios'
  if (pathname.startsWith('/perfil'))         return null
  return undefined
}
