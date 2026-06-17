'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

export default function UsuariosPage() {
  const router = useRouter()
  const { usuario, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!usuario) { router.replace('/'); return }
    if (usuario.perfil === 'owner' || usuario.perfil === 'administrador') {
      router.replace('/configuracoes?tab=acessos')
    } else {
      router.replace('/')
    }
  }, [usuario, loading, router])

  return null
}
