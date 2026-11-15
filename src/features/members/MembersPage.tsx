import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Ghost, Link2, Link2Off, MoreVertical, QrCode, RefreshCw, Share2, Trash2, UserPlus, Crown, Pencil, Eye, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useTrip, ROLE_LABEL } from '@/features/trips/TripContext'
import { useTripTable } from '@/lib/data'
import { randomToken, colorFor, MEMBER_COLORS } from '@/lib/ids'
import type { Role, TripMember } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageTitle } from '@/components/PageTitle'

export function inviteUrl(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/join/${token}`
}
export function shareUrl(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/share/${token}`
}

export function MembersPage() {
  const { trip, members, isOwner, writer, me } = useTrip()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const expenses = useTripTable(trip.id, 'expenses')
  const shares = useTripTable(trip.id, 'expense_shares')
  const settlements = useTripTable(trip.id, 'settlements')
  const [ghostName, setGhostName] = useState('')
  const [qr, setQr] = useState(false)
  const url = inviteUrl(trip.invite_token)

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success('Lien copié !')
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: `Rejoins « ${trip.name} » sur Vadrouille`, url })
      } catch { /* annulé */ }
    } else void copy()
  }

  const addGhost = async () => {
    const name = ghostName.trim()
    if (!name) return
    const used = new Set(members.map((m) => m.color))
    await writer.insert('trip_members', {
      trip_id: trip.id, user_id: null, display_name: name, is_ghost: true, role: 'viewer',
      color: MEMBER_COLORS.find((c) => !used.has(c)) ?? colorFor(name),
    })
    setGhostName('')
    toast.success(`${name} ajouté·e`)
  }

  const hasMoney = (m: TripMember) =>
    (expenses.data ?? []).some((e) => e.paid_by === m.id) ||
    (shares.data ?? []).some((s) => s.member_id === m.id) ||
    (settlements.data ?? []).some((s) => s.from_member === m.id || s.to_member === m.id)

  const removeMember = async (m: TripMember) => {
    const money = hasMoney(m)
    const ok = await confirm({
      title: `Retirer ${m.display_name} ?`,
      description: money
        ? 'Cette personne apparaît dans des dépenses : elle sera conservée comme participant sans compte pour garder les comptes justes.'
        : 'Cette personne n’aura plus accès au voyage.',
      confirmLabel: 'Retirer', destructive: true,
    })
    if (!ok) return
    if (money && m.user_id) await writer.update('trip_members', m.id, { user_id: null, is_ghost: true, role: 'viewer' })
    else if (money) toast.error('Ce participant a des dépenses : supprime-les ou réaffecte-les d’abord')
    else await writer.remove('trip_members', m.id)
  }

  const leave = async () => {
    if (!me) return
    const owners = members.filter((m) => m.role === 'owner' && !m.is_ghost)
    if (me.role === 'owner' && owners.length === 1) {
      toast.error('Nomme un autre organisateur avant de quitter le voyage')
      return
    }
    if (!(await confirm({ title: 'Quitter ce voyage ?', description: 'Tu pourras revenir avec le lien d’invitation.', confirmLabel: 'Quitter', destructive: true }))) return
    if (hasMoney(me)) {
      toast.error('Tu as des dépenses dans ce voyage : demande à l’organisateur de te retirer (tes comptes seront conservés).')
      return
    }
    await writer.remove('trip_members', me.id)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title="Participants" subtitle={`${members.length} personne${members.length > 1 ? 's' : ''}`} />

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Lien d'invitation</CardTitle>
            <div className="flex items-center gap-2">
              <label htmlFor="invite-on" className="text-xs text-muted-foreground">{trip.invite_enabled ? 'Actif' : 'Désactivé'}</label>
              <Switch id="invite-on" checked={trip.invite_enabled} onCheckedChange={(v) => writer.update('trips', trip.id, { invite_enabled: v })} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {trip.invite_enabled ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien d'invitation" className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copy} aria-label="Copier le lien"><Copy /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={share}><Share2 /> Partager</Button>
                  <Button variant="outline" onClick={() => setQr(true)}><QrCode /> QR code</Button>
                  <Button variant="ghost" onClick={async () => {
                    if (await confirm({ title: 'Régénérer le lien ?', description: 'L’ancien lien ne fonctionnera plus.', confirmLabel: 'Régénérer' })) {
                      await writer.update('trips', trip.id, { invite_token: randomToken() })
                      toast.success('Nouveau lien généré')
                    }
                  }}><RefreshCw /> Régénérer</Button>
                </div>
                <p className="text-xs text-muted-foreground">Les personnes qui rejoignent sont <strong>éditrices</strong> par défaut. Préviens-les que l’e-mail de connexion peut arriver dans les spams.</p>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Link2Off className="h-4 w-4" /> Personne ne peut rejoindre le voyage par lien.</p>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && <GuestLinkCard />}

      <Card>
        <CardContent className="divide-y p-0">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.display_name} color={m.color} size="md" ghost={m.is_ghost} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.display_name} {m.id === me?.id && <span className="text-xs font-normal text-muted-foreground">(toi)</span>}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {m.is_ghost ? (
                    <Badge variant="outline"><Ghost /> Sans compte</Badge>
                  ) : (
                    <Badge variant={m.role === 'owner' ? 'coral' : m.role === 'editor' ? 'default' : 'secondary'}>
                      {m.role === 'owner' ? <Crown /> : m.role === 'editor' ? <Pencil /> : <Eye />} {ROLE_LABEL[m.role]}
                    </Badge>
                  )}
                </div>
              </div>
              {isOwner && m.id !== me?.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions pour ${m.display_name}`}><MoreVertical /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!m.is_ghost && (
                      <>
                        <DropdownMenuLabel>Rôle</DropdownMenuLabel>
                        {(['owner', 'editor', 'viewer'] as Role[]).map((r) => (
                          <DropdownMenuItem key={r} disabled={m.role === r} onSelect={() => writer.update('trip_members', m.id, { role: r })}>
                            {ROLE_LABEL[r]}{m.role === r && ' ✓'}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem destructive onSelect={() => removeMember(m)}><Trash2 /> Retirer</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Ghost className="h-4 w-4 text-primary" /> Ajouter un participant sans compte</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">Pour un enfant ou quelqu’un qui n’utilisera pas l’app : il compte dans le partage des dépenses. Il pourra relier son compte plus tard via le lien d’invitation.</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addGhost() }}>
              <Input placeholder="Prénom" value={ghostName} onChange={(e) => setGhostName(e.target.value)} maxLength={60} aria-label="Prénom du participant" />
              <Button type="submit" disabled={!ghostName.trim()}><UserPlus /> Ajouter</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {me && (
        <Button variant="ghost" className="text-destructive" onClick={leave}><LogOut /> Quitter ce voyage</Button>
      )}

      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scanner pour rejoindre</DialogTitle>
            <DialogDescription>{trip.name}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex justify-center pb-8">
            <div className="rounded-3xl bg-white p-5"><QRCodeSVG value={url} size={240} fgColor="#163f4f" /></div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Lien invité : consultation sans compte, en lecture seule (programme, carte, transports et logements) */
function GuestLinkCard() {
  const { trip, writer } = useTrip()
  const [qr, setQr] = useState(false)
  const url = trip.share_token ? shareUrl(trip.share_token) : ''
  const toggle = async (on: boolean) => {
    await writer.update('trips', trip.id, { share_enabled: on, ...(on && !trip.share_token ? { share_token: randomToken() } : {}) })
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Lien invité (sans compte)</CardTitle>
        <Switch checked={!!trip.share_enabled} onCheckedChange={toggle} aria-label="Activer le lien invité" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Pour les grands-parents ou les amis qui veulent suivre le voyage : programme, carte et transports/logements, <strong>sans</strong> numéros de réservation, prix ni budget.</p>
        {trip.share_enabled && url && (
          <>
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien invité" className="font-mono text-xs" />
              <Button variant="outline" size="icon" aria-label="Copier le lien invité" onClick={async () => { await navigator.clipboard.writeText(url); toast.success('Lien invité copié') }}><Copy /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setQr(true)}><QrCode /> QR code</Button>
              <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><Eye /> Aperçu</a></Button>
              <Button variant="ghost" onClick={() => writer.update('trips', trip.id, { share_token: randomToken() }).then(() => toast.success('Nouveau lien invité généré'))}><RefreshCw /> Régénérer</Button>
            </div>
          </>
        )}
      </CardContent>
      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suivre le voyage</DialogTitle><DialogDescription>Lecture seule, sans compte</DialogDescription></DialogHeader>
          <DialogBody className="flex justify-center pb-8"><div className="rounded-3xl bg-white p-5"><QRCodeSVG value={url} size={240} fgColor="#163f4f" /></div></DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
