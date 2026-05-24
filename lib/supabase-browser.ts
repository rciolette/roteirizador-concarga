import { supabase } from '@/lib/supabase'

// Reutiliza o singleton de lib/supabase para evitar múltiplas instâncias
// de GoTrueClient no mesmo contexto de browser.
export function getSupabaseBrowser() {
  return supabase
}
