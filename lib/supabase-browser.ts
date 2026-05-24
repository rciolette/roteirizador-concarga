import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

// createBrowserClient (de @supabase/ssr) lê tokens de cookie, o que é
// necessário para que a sessão SSR do Next.js seja reconhecida no browser.
// createClient (de @supabase/supabase-js) usa localStorage e não enxerga
// a sessão gravada pelo servidor — causava tela preta no AuthProvider.
export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}
