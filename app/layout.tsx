import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import { MockBanner } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Concarga — Roteirizador',
  description: 'Sistema de roteirização inteligente com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex flex-col h-screen overflow-hidden" style={{background:'#F8F8F6'}}>
        <MockBanner />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
