'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UsuariosPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/perfil') }, [router])
  return null
}
