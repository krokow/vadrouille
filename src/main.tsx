import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { backend } from './lib/backend'
import { App } from './app/App'

/**
 * Le lien magique revient sur `…/vadrouille/?next=/join/xyz#access_token=…`.
 * On laisse supabase-js consommer le fragment AVANT de monter le HashRouter,
 * puis on transforme `?next=` en route hash.
 */
async function boot() {
  const hash = window.location.hash
  let authError: string | null = null
  if (/^#(error|error_code)=/.test(hash)) {
    const p = new URLSearchParams(hash.slice(1))
    authError = p.get('error_description') ?? 'Lien invalide'
    history.replaceState(null, '', window.location.pathname + window.location.search + '#/login')
  }
  const user = await backend.getUser() // attend l'initialisation de la session (et le nettoyage du fragment)

  const url = new URL(window.location.href)
  const next = url.searchParams.get('next')
  if (next || url.searchParams.has('code')) {
    url.searchParams.delete('next')
    url.searchParams.delete('code')
    const target = next && next.startsWith('/') ? next : url.hash.replace(/^#/, '') || '/'
    history.replaceState(null, '', `${url.pathname}${url.search}#${target}`)
  } else if (!window.location.hash || /^#(access_token|refresh_token)/.test(window.location.hash)) {
    history.replaceState(null, '', `${url.pathname}${url.search}#/`)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App authError={authError} userId={user?.id ?? null} />
    </StrictMode>,
  )
}

void boot()
