'use client'
import { useState, useLayoutEffect, type CSSProperties } from 'react'
import { useOnboarding } from '@/components/providers/OnboardingProvider'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface Rect { top: number; left: number; width: number; height: number }

function medirAlvo(target?: string): Rect | null {
  if (!target) return null
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourSpotlight() {
  const { tourAtivo, passos, passoAtual, proximo, anterior, pular } = useOnboarding()
  const { collapsed, toggle } = useSidebar()
  const [rect, setRect] = useState<Rect | null>(null)

  const passo = passos[passoAtual]

  // A sidebar colapsada esconde o rótulo dos itens — expandimos durante o tour para o passo fazer sentido.
  useLayoutEffect(() => {
    if (tourAtivo && collapsed) toggle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourAtivo])

  useLayoutEffect(() => {
    if (!tourAtivo || !passo) { setRect(null); return }

    function medir() { setRect(medirAlvo(passo.target)) }
    medir()
    // A sidebar pode estar em transição de largura (200ms, ver Sidebar.tsx) — remedimos ao final.
    const t = setTimeout(medir, 220)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [tourAtivo, passo])

  if (!tourAtivo || !passo) return null

  const isPrimeiro = passoAtual === 0
  const isUltimo   = passoAtual === passos.length - 1
  const padding    = 6

  const spot = rect ? {
    top:    rect.top - padding,
    left:   rect.left - padding,
    width:  rect.width + padding * 2,
    height: rect.height + padding * 2,
  } : null

  // Balão à direita do alvo (a sidebar fica sempre à esquerda); sem alvo, centraliza na tela.
  const balloonStyle: CSSProperties = spot
    ? {
        position: 'fixed',
        top:  Math.min(Math.max(spot.top, 12), typeof window !== 'undefined' ? window.innerHeight - 170 : spot.top),
        left: spot.left + spot.width + 14,
      }
    : {
        position:  'fixed',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
      }

  return (
    <div className="fixed inset-0 z-[250]" style={{ pointerEvents: 'none' }}>
      {spot && (
        <div
          className="absolute rounded-lg transition-[top,left,width,height] duration-150 ease-out"
          style={{
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            boxShadow:     '0 0 0 9999px rgba(0,0,0,0.55)',
            outline:       '2px solid var(--color-primary)',
            outlineOffset: 2,
          }}
        />
      )}

      <div
        className="animate-fade-in bg-surface rounded-xl border border-[0.5px] border-[var(--border-light)] w-[280px] px-4 py-4"
        style={{ ...balloonStyle, pointerEvents: 'auto' }}
      >
        <div className="text-[10px] text-muted mb-1">{passoAtual + 1} de {passos.length}</div>
        <div className="text-[13px] font-medium mb-1.5">{passo.titulo}</div>
        <div className="text-[11px] text-muted leading-relaxed mb-3.5">{passo.texto}</div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={pular}
            className="text-[11px] text-muted hover:text-base cursor-pointer bg-transparent border-none"
          >
            Pular
          </button>
          <div className="flex gap-2">
            {!isPrimeiro && (
              <button
                type="button"
                onClick={anterior}
                className="px-2.5 py-1.5 rounded-lg border border-[0.5px] border-[var(--border-input)] text-[11px] text-muted hover:text-base cursor-pointer bg-transparent"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={proximo}
              className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-bg text-[11px] font-medium hover:opacity-90 cursor-pointer border-none"
            >
              {isUltimo ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
