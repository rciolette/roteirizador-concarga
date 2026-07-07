'use client'
import { useOnboarding } from '@/components/providers/OnboardingProvider'

export function WelcomeModal() {
  const { welcomeOpen, passos, iniciarTour, pular } = useOnboarding()
  if (!welcomeOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/55 z-[300] flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) pular() }}
    >
      <div className="animate-fade-in bg-surface rounded-xl border border-[0.5px] border-[var(--border-light)] w-[440px] max-w-[92vw]">
        <div className="px-6 pt-6 pb-4 border-b border-[0.5px] border-[var(--border-subtle)]">
          <div className="w-10 h-10 rounded-lg bg-primary-bg flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-primary">
              <path d="M3 12.5C4.5 5.5 6.5 3 8 3S11.5 5.5 13 12.5"/>
              <circle cx="3" cy="12.5" r="1.3" fill="currentColor" stroke="none"/>
              <circle cx="13" cy="12.5" r="1.3" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div className="text-[15px] font-medium">Bem-vindo ao Concarga!</div>
          <div className="text-[11px] text-muted mt-1 leading-relaxed">
            Vamos te mostrar rapidinho como usar o roteirizador em {passos.length} passos.
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-2.5">
          {passos.map((p, i) => (
            <div key={p.id} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-cream dark:bg-white/8 text-[10px] font-medium text-mid flex items-center justify-center shrink-0 mt-px">
                {i + 1}
              </span>
              <div className="text-[12px] text-base leading-relaxed">{p.titulo}</div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 pt-1 flex gap-2 justify-end">
          <button
            type="button"
            onClick={pular}
            className="px-3.5 py-2 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={iniciarTour}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-bg text-xs font-medium hover:opacity-90 transition-opacity border-none cursor-pointer"
          >
            Começar tour
          </button>
        </div>
      </div>
    </div>
  )
}
