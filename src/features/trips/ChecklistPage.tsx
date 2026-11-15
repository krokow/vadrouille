import { useMemo, useState } from 'react'
import { ListChecks, Plus, Trash2, Sparkles, User } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { Gauge } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/lib/types'

/** Modèles de listes de bagages */
export const TEMPLATES: Record<string, { emoji: string; groups: Record<string, string[]> }> = {
  Essentiels: { emoji: '🎒', groups: {
    Papiers: ['Passeport / carte d’identité', 'Carte bancaire', 'Assurance voyage', 'Billets et réservations', 'Permis de conduire'],
    Électronique: ['Téléphone + chargeur', 'Batterie externe', 'Adaptateur de prise', 'Écouteurs'],
    Trousse: ['Brosse à dents + dentifrice', 'Médicaments', 'Crème solaire', 'Lunettes / lentilles'],
    Vêtements: ['Sous-vêtements', 'Chaussettes', 'Pyjama', 'Veste de pluie'],
  } },
  Plage: { emoji: '🏖️', groups: { Plage: ['Maillots de bain', 'Serviettes de plage', 'Lunettes de soleil', 'Chapeau', 'Tongs', 'Après-soleil', 'Masque et tuba'] } },
  Montagne: { emoji: '🏔️', groups: { Montagne: ['Chaussures de rando', 'Polaire', 'Gourde', 'Frontale', 'Bâtons', 'Trousse de secours', 'Couverture de survie'] } },
  Ville: { emoji: '🏙️', groups: { Ville: ['Chaussures confortables', 'Petit sac à dos', 'Parapluie', 'Tenue pour sortir'] } },
  'Avec bébé': { emoji: '👶', groups: { Bébé: ['Couches', 'Lingettes', 'Biberons', 'Doudou', 'Poussette / porte-bébé', 'Thermomètre', 'Lit parapluie'] } },
}

export default function ChecklistPage() {
  const { trip, members, me, canEdit, writer, memberById } = useTrip()
  const items = useTripTable(trip.id, 'checklist_items')
  const [label, setLabel] = useState('')
  const [group, setGroup] = useState('Général')
  const [assignee, setAssignee] = useState('')
  const [mine, setMine] = useState(false)

  const list = useMemo(() => (items.data ?? []).filter((i) => !mine || i.assigned_to === me?.id || !i.assigned_to), [items.data, mine, me])
  const groups = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = {}
    for (const i of [...list].sort((a, b) => a.sort_order - b.sort_order)) (g[i.group_name] ??= []).push(i)
    return g
  }, [list])
  const done = list.filter((i) => i.done).length
  const groupNames = [...new Set(['Général', ...(items.data ?? []).map((i) => i.group_name)])]

  const add = async () => {
    const text = label.trim()
    if (!text) return
    const max = Math.max(0, ...(items.data ?? []).map((i) => i.sort_order))
    await writer.insert('checklist_items', { trip_id: trip.id, label: text, group_name: group.trim() || 'Général', assigned_to: assignee || null, done: false, sort_order: max + 1 })
    setLabel('')
  }

  const applyTemplate = async (name: string) => {
    const existing = new Set((items.data ?? []).map((i) => i.label.toLowerCase()))
    let order = Math.max(0, ...(items.data ?? []).map((i) => i.sort_order))
    const rows = Object.entries(TEMPLATES[name].groups).flatMap(([g, labels]) =>
      labels.filter((l) => !existing.has(l.toLowerCase())).map((l) => ({ trip_id: trip.id, label: l, group_name: g, assigned_to: null, done: false, sort_order: ++order })),
    )
    if (!rows.length) return toast.info('Tout est déjà dans la liste')
    await writer.insertMany('checklist_items', rows)
    toast.success(`${rows.length} éléments ajoutés`)
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Bagages" subtitle={list.length ? `${done} / ${list.length} prêts` : 'Liste partagée, chacun coche ce qu’il a pris'}
        action={canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><Sparkles /> Modèles</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ajouter un modèle</DropdownMenuLabel>
              {Object.entries(TEMPLATES).map(([n, t]) => <DropdownMenuItem key={n} onSelect={() => applyTemplate(n)}>{t.emoji} {n}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )} />
      {list.length > 0 && <Gauge value={done} max={list.length} label="Progression des bagages" />}

      {canEdit && (
        <Card className="space-y-2 p-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add() }}>
            <Input placeholder="Ajouter un élément…" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nouvel élément" />
            <Button type="submit" size="icon" aria-label="Ajouter l’élément" disabled={!label.trim()}><Plus /></Button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <Input list="checklist-groups" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Catégorie" placeholder="Catégorie" />
            <datalist id="checklist-groups">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
            <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Attribuer à">
              <option value="">Pour tout le groupe</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </NativeSelect>
          </div>
        </Card>
      )}

      {me && (items.data?.length ?? 0) > 0 && (
        <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={mine} onCheckedChange={(c) => setMine(!!c)} /> <User className="h-4 w-4" /> Seulement mes affaires et le commun</label>
      )}

      {!list.length ? (
        <EmptyState icon={ListChecks} title="Liste vide" description="Pars d’un modèle (essentiels, plage, montagne…) ou ajoute tes propres éléments." />
      ) : (
        Object.entries(groups).map(([g, its]) => (
          <section key={g}>
            <h2 className="mb-2 flex items-baseline justify-between text-sm font-bold text-muted-foreground">
              {g} <span className="text-xs font-semibold">{its.filter((i) => i.done).length}/{its.length}</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {its.map((i) => {
                const who = i.assigned_to ? memberById[i.assigned_to] : undefined
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Checkbox id={`ck-${i.id}`} checked={i.done} disabled={!canEdit} onCheckedChange={(c) => writer.update('checklist_items', i.id, { done: !!c })} />
                    <label htmlFor={`ck-${i.id}`} className={cn('min-w-0 flex-1 text-sm', i.done && 'text-muted-foreground line-through')}>{i.label}</label>
                    {canEdit ? (
                      <NativeSelect className="h-8 w-auto max-w-[8rem] py-0 pl-2 text-xs" value={i.assigned_to ?? ''} aria-label={`Attribuer « ${i.label} »`}
                        onChange={(e) => writer.update('checklist_items', i.id, { assigned_to: e.target.value || null })}>
                        <option value="">Tous</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                      </NativeSelect>
                    ) : who && <Avatar name={who.display_name} color={who.color} size="xs" />}
                    {canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${i.label} »`} onClick={() => writer.remove('checklist_items', i.id)}><Trash2 /></Button>}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
