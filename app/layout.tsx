import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import { MockBanner } from '@/components/ui'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'Concarga — Roteirizador',
  description: 'Sistema de roteirização inteligente com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="flex flex-col h-screen overflow-hidden bg-page text-base">
        <ThemeProvider>
          <MockBanner />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
