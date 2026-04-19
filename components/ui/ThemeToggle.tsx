'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Stable placeholder avoids layout shift before mount
  if (!mounted) return <div className="w-7 h-7 shrink-0" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-base hover:bg-cream transition-colors duration-100 border border-[0.5px] border-[var(--border-subtle)] cursor-pointer shrink-0"
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {isDark
        ? <Sun size={13} strokeWidth={1.6} />
        : <Moon size={13} strokeWidth={1.6} />
      }
    </button>
  )
}
