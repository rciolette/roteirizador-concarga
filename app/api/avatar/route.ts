import { getSessaoServidor, getAdminClient } from '@/lib/auth-server'

const BUCKET = 'roteirizador-avatares'
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: Request) {
  const sessao = await getSessaoServidor()
  if (!sessao)       return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!sessao.ativo) return Response.json({ error: 'Usuário inativo' }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type))
    return Response.json({ error: 'Tipo de arquivo não permitido (use JPG, PNG, WEBP ou GIF)' }, { status: 400 })
  if (file.size > MAX_SIZE)
    return Response.json({ error: 'Imagem deve ter no máximo 2 MB' }, { status: 400 })

  const sb = getAdminClient()

  // Cria o bucket se ainda não existir
  const { error: bucketErr } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  })
  if (bucketErr && !bucketErr.message.toLowerCase().includes('already exists')) {
    return Response.json({ error: `Erro ao preparar storage: ${bucketErr.message}` }, { status: 500 })
  }

  const buffer = await file.arrayBuffer()
  const path   = `${sessao.userId}/avatar`

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path)

  // Atualiza o perfil com a nova URL
  const { error: dbErr } = await sb
    .from('perfis_usuario')
    .update({ avatar_url: publicUrl, atualizado_em: new Date().toISOString() })
    .eq('user_id', sessao.userId)

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  return Response.json({ url: publicUrl })
}
