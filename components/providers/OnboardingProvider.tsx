'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-steps'

interface OnboardingCtx {
  /** Modal de boas-vindas visível (antes de o tour começar) */
  welcomeOpen: boolean
  /** Tour de balões em andamento */
  tourAtivo:   boolean
  /** Passos visíveis para o perfil do usuário atual (já filtrados por permissão) */
  passos:      OnboardingStep[]
  passoAtual:  number
  iniciarTour: () => void
  proximo:     () => void
  anterior:    () => void
  pular:       () => void
}

const OnboardingContext = createContext<OnboardingCtx | null>(null)

export function useOnboarding(): OnboardingCtx {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding deve ser usado dentro de OnboardingProvider')
  return ctx
}

// Só o próprio usuário pode ver o alvo de cada passo — filtramos os que a permissão dele não cobre.
function passosVisiveis(pode: (acao: string) => boolean) {
  return ONBOARDING_STEPS.filter(p => !p.acao || pode(p.acao))
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { usuario, loading, pode, refreshUsuario } = useAuth()
  const pathname = usePathname()

  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [tourAtivo,   setTourAtivo]   = useState(false)
  const [passoAtual,  setPassoAtual]  = useState(0)
  const [jaChecou,    setJaChecou]    = useState(false)

  // Dispara o modal de boas-vindas automaticamente no primeiro acesso.
  useEffect(() => {
    if (loading || jaChecou || !usuario) return
    setJaChecou(true)
    if (usuario.onboardingVistoEm == null && pathname !== '/login') {
      setWelcomeOpen(true)
    }
  }, [loading, usuario, jaChecou, pathname])

  const gravarConcluido = useCallback(async () => {
    try {
      await fetch('/api/perfil', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ onboarding_concluido: true }),
      })
      await refreshUsuario()
    } catch {
      // Falha ao gravar não deve travar a experiência — o usuário só verá o tour de novo.
    }
  }, [refreshUsuario])

  const iniciarTour = useCallback(() => {
    setWelcomeOpen(false)
    setPassoAtual(0)
    setTourAtivo(true)
  }, [])

  const encerrarTour = useCallback((concluiu: boolean) => {
    setTourAtivo(false)
    setWelcomeOpen(false)
    if (concluiu) gravarConcluido()
  }, [gravarConcluido])

  const passos = passosVisiveis(pode)

  const proximo = useCallback(() => {
    setPassoAtual(i => {
      if (i + 1 >= passos.length) {
        encerrarTour(true)
        return i
      }
      return i + 1
    })
  }, [passos.length, encerrarTour])

  const anterior = useCallback(() => {
    setPassoAtual(i => Math.max(0, i - 1))
  }, [])

  const pular = useCallback(() => {
    encerrarTour(true)
  }, [encerrarTour])

  return (
    <OnboardingContext.Provider value={{
      welcomeOpen,
      tourAtivo,
      passos,
      passoAtual,
      iniciarTour,
      proximo,
      anterior,
      pular,
    }}>
      {children}
    </OnboardingContext.Provider>
  )
}
