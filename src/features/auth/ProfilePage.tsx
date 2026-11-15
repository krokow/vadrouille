import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bell, BellOff, BellRing, Camera, Loader2, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { notifyEnabled, notifySupported, showSystemNotification } from '@/lib/notify'
import { disableNotifications, enableNotifications, pushAvailable } from '@/lib/push'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthProvider'
import { backend, isDemo } from '@/lib/backend'
import { useFileUrl, compressImage } from '@/lib/files'
import { MEMBER_COLORS } from '@/lib/ids'
import { CURRENCIES } from '@/lib/currencies'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useTheme } from '@/app/theme'
import { setLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const { pref, setPref } = useTheme()
  const [name, setName] = useState('')
  const [color, setColor] = useState(MEMBER_COLORS[0])
  const [currency, setCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const avatar = useFileUrl(profile?.avatar_url, 'avatars')

  useEffect(() => {
    if (!profile) return
    setName(profile.display_name)
    setColor(profile.color)
    setCurrency(profile.preferred_currency)
  }, [profile])

  const save = async (patch: Partial<Profile>) => {
    if (!user) return
    setSaving(true)
    try {
      await backend.update('profiles', user.id, patch)
      qc.setQueryData<Profile>(['me', user.id], (p) => (p ? { ...p, ...patch } : p))
      void qc.invalidateQueries({ queryKey: ['all-members'] })
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[2] === 'trip_members' })
      toast.success('Profil enregistré')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return
    try {
      const small = await compressImage(file, 400, 0.85)
      const path = `${user.id}/avatar-${Date.now()}.jpg`
      await backend.upload('avatars', path, small)
      if (profile?.avatar_url) void backend.removeFiles('avatars', [profile.avatar_url]).catch(() => undefined)
      await save({ avatar_url: path })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Envoi impossible')
    }
  }

  return (
    <div className="min-h-dvh paper">
      <div className="container max-w-lg py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button asChild variant="ghost" className="-ml-2 mb-2"><Link to="/"><ArrowLeft /> Mes voyages</Link></Button>
        <h1 className="mb-5 text-3xl font-bold">{t('Mon profil')}</h1>
        <Card className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={name || '?'} color={color} src={avatar.data} size="lg" />
              <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow" aria-label="Changer la photo">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile?.display_name}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {profile?.avatar_url && (
                <button className="mt-1 flex items-center gap-1 text-xs text-destructive" onClick={() => save({ avatar_url: null })}>
                  <Trash2 className="h-3 w-3" /> Retirer la photo
                </button>
              )}
            </div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save({ display_name: name.trim() || 'Voyageur', color, preferred_currency: currency }) }}>
            <Field label="Prénom affiché" htmlFor="pname">
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <div className="space-y-1.5">
              <span className="text-sm font-semibold">Ma couleur</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
                {MEMBER_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c}
                    onClick={() => setColor(c)}
                    className={cn('h-9 w-9 rounded-full ring-offset-2 ring-offset-background transition', c === color && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Field label="Devise préférée" htmlFor="pcur" hint="Proposée par défaut à la création d’un voyage.">
              <NativeSelect id="pcur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
              </NativeSelect>
            </Field>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} {t('Enregistrer')}</Button>
          </form>
        </Card>
        <Card className="mt-4 space-y-3 p-5">
          <h2 className="font-semibold">Préférences</h2>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Thème</span>
            <div className="flex rounded-full bg-muted p-1" role="radiogroup" aria-label="Thème">
              {([['system', Monitor, 'Auto'], ['light', Sun, 'Clair'], ['dark', Moon, 'Sombre']] as const).map(([k, Icon, label]) => (
                <button key={k} role="radio" aria-checked={pref === k} onClick={() => setPref(k)}
                  className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold', pref === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Langue</span>
            <NativeSelect className="w-40" value={i18n.language} onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')} aria-label="Langue">
              <option value="fr">Français</option>
              <option value="en">English (bêta)</option>
            </NativeSelect>
          </div>
          {isDemo && <p className="text-xs text-muted-foreground">Mode démo : profil stocké dans ce navigateur.</p>}
        </Card>
        <NotificationsCard />
      </div>
    </div>
  )
}

function NotificationsCard() {
  const { user } = useAuth()
  const [state, setState] = useState(() => (notifySupported() ? Notification.permission : 'unsupported') as NotificationPermission | 'unsupported')
  const [on, setOn] = useState(notifyEnabled())
  const [busy, setBusy] = useState(false)
  const ios = /iphone|ipad/i.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches)

  const enable = async () => {
    if (!user) return
    setBusy(true)
    try {
      const r = await enableNotifications(user.id)
      if (r === 'denied') toast.error('Notifications refusées : autorise-les dans les réglages du navigateur')
      if (r === 'granted') toast.success(pushAvailable() ? 'Notifications push activées sur cet appareil 🔔' : 'Notifications activées 🔔')
      setState(notifySupported() ? Notification.permission : 'unsupported')
      setOn(notifyEnabled())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Activation impossible')
    } finally {
      setBusy(false)
    }
  }
  const disable = async () => {
    await disableNotifications()
    setOn(false)
    toast.success('Notifications désactivées sur cet appareil')
  }

  return (
    <Card className="mt-4 space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" /> Notifications</h2>
      <p className="text-sm text-muted-foreground">
        Modifications des autres participants, @mentions et échéances de réservation.
        {pushAvailable() ? ' Elles arrivent même quand l’app est fermée.' : ' Elles s’affichent quand l’app est ouverte ou en arrière-plan.'}
      </p>
      {ios && <p className="rounded-xl bg-accent p-3 text-xs text-accent-foreground">Sur iPhone : installe d’abord l’app (Partager → « Sur l’écran d’accueil »), puis active les notifications depuis l’app installée.</p>}
      {state === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">Ce navigateur ne gère pas les notifications.</p>
      ) : on ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => showSystemNotification('Vadrouille', 'Les notifications fonctionnent 🎉', { tag: 'test' })}><BellRing /> Tester</Button>
          <Button variant="ghost" onClick={disable}><BellOff /> Désactiver</Button>
        </div>
      ) : (
        <Button onClick={enable} disabled={busy || state === 'denied'}>{busy ? <Loader2 className="animate-spin" /> : <Bell />} Activer les notifications</Button>
      )}
      {state === 'denied' && <p className="text-xs text-destructive">Bloquées par le navigateur : autorise-les dans les réglages du site.</p>}
    </Card>
  )
}
