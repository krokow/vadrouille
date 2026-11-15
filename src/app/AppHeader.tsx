import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Moon, Sun, User } from 'lucide-react'
import { Wordmark } from '@/components/Logo'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/AuthProvider'
import { backend, isDemo } from '@/lib/backend'
import { useFileUrl } from '@/lib/files'
import { useTheme } from './theme'

export function AppHeader() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const { theme, toggle } = useTheme()
  const avatar = useFileUrl(profile?.avatar_url, 'avatars')
  return (
    <header className="container flex max-w-5xl items-center justify-between py-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link to="/" aria-label="Accueil"><Wordmark /></Link>
      <div className="flex items-center gap-2">
        {isDemo && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase">Démo</span>}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full" aria-label="Menu du compte">
            <Avatar name={profile?.display_name ?? user?.email ?? '?'} color={profile?.color ?? '#1f6f8b'} src={avatar.data} size="md" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/profile"><User /> {t('Mon profil')}</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={toggle}>{theme === 'dark' ? <Sun /> : <Moon />} Mode {theme === 'dark' ? 'clair' : 'sombre'}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void backend.signOut()}><LogOut /> {t('Se déconnecter')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
