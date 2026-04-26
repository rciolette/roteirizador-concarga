'use client'
import { Btn } from '@/components/ui'

export function ImportarSIATButton({
  onClick, running,
  label = 'Importar SIAT',
  loadingLabel = 'Importando...',
}: {
  onClick: () => void
  running: boolean
  label?: string
  loadingLabel?: string
}) {
  return (
    <Btn variant="teal" onClick={onClick} disabled={running}>
      <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
      </svg>
      {running ? loadingLabel : label}
    </Btn>
  )
}
