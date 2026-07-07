import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AppDataProvider } from '@/components/providers/AppDataProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { OnboardingProvider } from '@/components/providers/OnboardingProvider'
import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { TourSpotlight } from '@/components/onboarding/TourSpotlight'

export const metadata: Metadata = {
  title: 'Concarga — Roteirizador',
  description: 'Sistema de roteirização inteligente com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="flex flex-col h-screen overflow-hidden bg-page text-base">
        <ThemeProvider>
          <AuthProvider>
            <AppDataProvider>
              <OnboardingProvider>
                <SidebarProvider>
                  <div className="flex flex-1 min-h-0 overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
                      <div className="flex flex-col grow w-full max-w-[1800px] mx-auto">
                        {children}
                      </div>
                    </main>
                  </div>
                  <WelcomeModal />
                  <TourSpotlight />
                </SidebarProvider>
              </OnboardingProvider>
            </AppDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
