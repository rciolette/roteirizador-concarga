'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Mode = 'light' | 'system' | 'dark'
const MODES: Mode[] = ['light', 'system', 'dark']
const ICONS: Record<Mode, string> = { light: '☀', system: '◉', dark: '☾' }
const LABELS: Record<Mode, string> = { light: 'Modo claro', system: 'Sistema', dark: 'Modo escuro' }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-[26px] w-[76px] shrink-0" />

  const current: Mode = (MODES.includes(theme as Mode) ? theme : 'system') as Mode

  return (
    <div className="flex items-center bg-page border border-[0.5px] border-[var(--border-subtle)] rounded-lg p-0.5 gap-0.5">
      {MODES.map(m => (
        <button
          key={m}
          onClick={() => setTheme(m)}
          title={LABELS[m]}
          aria-label={LABELS[m]}
          className={cn(
            'w-[22px] h-5 flex items-center justify-center rounded text-[12px] leading-none',
            'transition-colors duration-100 cursor-pointer border-none',
            current === m
              ? 'bg-white dark:bg-hover text-base shadow-sm'
              : 'bg-transparent text-subtle hover:text-muted',
          )}
        >
          {ICONS[m]}
        </button>
      ))}
    </div>
  )
}
