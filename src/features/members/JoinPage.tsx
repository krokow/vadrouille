import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, PartyPopper, Ghost, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { backend } from '@/lib/backend'
import { qk } from '@/lib/data'
import { fmtDateRange } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Wordmark } from '@/components/Logo'
import { cn } from '@/lib/utils'

interface Preview {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  already_member: boolean
  ghosts: { id: string; display_name: string }[]
}

/** /#/join/:token — l'utilisateur est forcément connecté (RequireAuth) */
export function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [ghost, setGhost] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const preview = useQuery({
    queryKey: ['preview', token],
    queryFn: () => backend.rpc<Preview>('trip_preview', { token }),
    retry: false,
    meta: { persist: false },
  })

  const join = async () => {
    setJoining(true)
    try {
      const id = await backend.rpc<string>('join_trip', { token, ghost_id: ghost })
      await qc.invalidateQueries({ queryKey: qk.trips })
      await qc.invalidateQueries({ queryKey: qk.allMembers })
      toast.success('Bienvenue dans le voyage ! 🎉')
      navigate(`/t/${id}`, { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de rejoindre')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 paper">
      <Wordmark className="mb-8" />
      {preview.isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : preview.isError || !preview.data ? (
        <EmptyState
          className="max-w-sm"
          icon={UserPlus}
          title="Lien d'invitation invalide"
          description="Il a peut-être été désactivé ou régénéré par l'organisateur. Demande-lui un nouveau lien."
          action={<Button asChild><Link to="/">Mes voyages</Link></Button>}
        />
      ) : (
        <Card className="w-full max-w-sm p-6 text-center">
          <PartyPopper className="mx-auto mb-3 h-10 w-10 text-coral" />
          <p className="text-sm text-muted-foreground">Tu es invité·e à rejoindre</p>
          <h1 className="mt-1 text-2xl font-bold">{preview.data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[preview.data.destination, fmtDateRange(preview.data.start_date, preview.data.end_date)].filter(Boolean).join(' · ')}
          </p>
          {preview.data.already_member ? (
            <Button className="mt-6 w-full" asChild><Link to={`/t/${preview.data.id}`}>Ouvrir le voyage</Link></Button>
          ) : (
            <>
              {preview.data.ghosts.length > 0 && (
                <div className="mt-5 space-y-2 text-left">
                  <p className="text-sm font-semibold">Es-tu déjà dans la liste ?</p>
                  <p className="text-xs text-muted-foreground">L'organisateur a peut-être déjà ajouté ton nom (avec tes dépenses).</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.data.ghosts.map((g) => (
                      <button key={g.id} onClick={() => setGhost(ghost === g.id ? null : g.id)} aria-pressed={ghost === g.id}
                        className={cn('flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold', ghost === g.id && 'border-primary bg-primary text-primary-foreground')}>
                        <Ghost className="h-3.5 w-3.5" /> C'est moi : {g.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button className="mt-6 w-full" size="lg" onClick={join} disabled={joining}>
                {joining && <Loader2 className="animate-spin" />} Rejoindre le voyage
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
