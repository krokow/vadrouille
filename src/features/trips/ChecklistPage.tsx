import { useMemo, useState } from 'react'
import { CalendarClock, ListChecks, Luggage, Plus, Sparkles, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from './TripContext'
import { useTripTable } from '@/lib/data'
import { deadlineLabel, deadlineUrgency, shiftDay } from '@/lib/dates'
import { fmtDay } from '@/lib/format'
import { useMediaQuery } from '@/lib/hooks'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { Gauge } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/lib/types'
import { PACK_TEMPLATES, TASK_TEMPLATES } from './prepTemplates'

const isTask = (i: ChecklistItem) => i.kind === 'task'

/** Préparatifs : todo-list d'avant départ + liste des affaires à emporter */
export default function ChecklistPage() {
  const { trip } = useTrip()
  const items = useTripTable(trip.id, 'checklist_items')
  const desktop = useMediaQuery('(min-width: 1024px)')
  const tasks = (items.data ?? []).filter(isTask)
  const pack = (items.data ?? []).filter((i) => !isTask(i))
  const subtitle = `${tasks.filter((t) => t.done).length}/${tasks.length} tâches faites · ${pack.filter((p) => p.done).length}/${pack.length} affaires prêtes`

  return (
    <div className="space-y-4">
      <PageTitle title="Préparatifs" subtitle={subtitle} />
      {desktop ? (
        <div className="grid grid-cols-2 items-start gap-6">
          <TaskList items={tasks} />
          <PackList items={pack} />
        </div>
      ) : (
        <Tabs defaultValue="tasks">
          <TabsList className="w-full">
            <TabsTrigger value="tasks"><CalendarClock /> Avant le départ</TabsTrigger>
            <TabsTrigger value="pack"><Luggage /> À emporter</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks"><TaskList items={tasks} /></TabsContent>
          <TabsContent value="pack"><PackList items={pack} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function AssigneeSelect({ value, onChange, label, small }: { value: string; onChange: (v: string) => void; label: string; small?: boolean }) {
  const { members } = useTrip()
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={small ? 'h-8 w-auto max-w-[8rem] py-0 pl-2 text-xs' : undefined}>
      <option value="">{small ? 'Tous' : 'Pour tout le groupe'}</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
    </NativeSelect>
  )
}

// ---------------------------------------------------------------- tâches
function TaskList({ items }: { items: ChecklistItem[] }) {
  const { trip, canEdit, writer, me, memberById } = useTrip()
  const all = useTripTable(trip.id, 'checklist_items')
  const [label, setLabel] = useState('')
  const [due, setDue] = useState('')
  const [assignee, setAssignee] = useState('')
  const [mine, setMine] = useState(false)
  const nextOrder = () => Math.max(0, ...(all.data ?? []).map((i) => i.sort_order)) + 1

  const sorted = useMemo(
    () => items
      .filter((i) => !mine || !i.assigned_to || i.assigned_to === me?.id)
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.sort_order - b.sort_order),
    [items, mine, me],
  )

  const add = async () => {
    if (!label.trim()) return
    await writer.insert('checklist_items', { trip_id: trip.id, kind: 'task', label: label.trim(), group_name: 'Tâches', due_date: due || null, assigned_to: assignee || null, done: false, sort_order: nextOrder() })
    setLabel('')
    setDue('')
  }

  const applyTemplate = async (name: string) => {
    const existing = new Set(items.map((i) => i.label.toLowerCase()))
    let order = nextOrder()
    const rows = TASK_TEMPLATES[name].tasks.filter((t) => !existing.has(t.label.toLowerCase())).map((t) => ({
      trip_id: trip.id, kind: 'task' as const, label: t.label, group_name: name, done: false, assigned_to: null,
      due_date: trip.start_date ? shiftDay(trip.start_date, -t.before) : null, sort_order: order++,
    }))
    if (!rows.length) return toast.info('Ces tâches sont déjà dans la liste')
    await writer.insertMany('checklist_items', rows)
    toast.success(`${rows.length} tâches ajoutées${trip.start_date ? ', avec leurs échéances' : ''}`)
  }

  const done = items.filter((i) => i.done).length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-coral" /> À faire avant le départ</CardTitle>
        {canEdit && <TemplateMenu names={Object.entries(TASK_TEMPLATES).map(([n, t]) => [n, t.emoji])} onPick={applyTemplate} />}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && <Gauge value={done} max={items.length} label="Tâches faites" />}
        {canEdit && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void add() }}>
            <div className="flex gap-2">
              <Input placeholder="Réserver la navette, faire le change…" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nouvelle tâche" />
              <Button type="submit" size="icon" aria-label="Ajouter la tâche" disabled={!label.trim()}><Plus /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="À faire avant le" max={trip.start_date ?? undefined} />
              <AssigneeSelect value={assignee} onChange={setAssignee} label="Responsable" />
            </div>
          </form>
        )}
        {me && items.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={mine} onCheckedChange={(c) => setMine(!!c)} /> <User className="h-4 w-4" /> Mes tâches et celles du groupe</label>
        )}
        {!sorted.length ? (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Aucune tâche. Pars d’un modèle ou ajoute la tienne.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border">
            {sorted.map((t) => {
              const u = t.done ? 'none' : deadlineUrgency(t.due_date ?? null)
              const who = t.assigned_to ? memberById[t.assigned_to] : undefined
              return (
                <li key={t.id} className={cn('flex items-start gap-3 px-3 py-2.5', u === 'overdue' && 'bg-destructive/5', u === 'soon' && 'bg-warning/5')}>
                  <Checkbox className="mt-0.5" id={`tk-${t.id}`} checked={t.done} disabled={!canEdit} onCheckedChange={(c) => writer.update('checklist_items', t.id, { done: !!c })} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`tk-${t.id}`} className={cn('block text-sm font-medium', t.done && 'text-muted-foreground line-through')}>{t.label}</label>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {t.due_date && (
                        <span className={cn(u === 'overdue' && 'font-bold text-destructive', u === 'soon' && 'font-semibold text-warning-foreground dark:text-warning')}>
                          {t.done ? `avant le ${fmtDay(t.due_date)}` : `${deadlineLabel(t.due_date)} · ${fmtDay(t.due_date)}`}
                        </span>
                      )}
                      {who && <span className="flex items-center gap-1"><Avatar name={who.display_name} color={who.color} size="xs" className="h-4 w-4 text-[8px] ring-0" />{who.display_name}</span>}
                    </p>
                  </div>
                  {canEdit && (
                    <>
                      <AssigneeSelect small value={t.assigned_to ?? ''} onChange={(v) => writer.update('checklist_items', t.id, { assigned_to: v || null })} label={`Responsable de « ${t.label} »`} />
                      <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${t.label} »`} onClick={() => writer.remove('checklist_items', t.id)}><Trash2 /></Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- affaires
function PackList({ items }: { items: ChecklistItem[] }) {
  const { trip, canEdit, writer, me, memberById } = useTrip()
  const all = useTripTable(trip.id, 'checklist_items')
  const [label, setLabel] = useState('')
  const [group, setGroup] = useState('Général')
  const [assignee, setAssignee] = useState('')
  const [mine, setMine] = useState(false)
  const nextOrder = () => Math.max(0, ...(all.data ?? []).map((i) => i.sort_order)) + 1

  const list = items.filter((i) => !mine || !i.assigned_to || i.assigned_to === me?.id)
  const groups = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = {}
    for (const i of [...list].sort((a, b) => a.sort_order - b.sort_order)) (g[i.group_name] ??= []).push(i)
    return g
  }, [list])
  const groupNames = [...new Set(['Général', ...items.map((i) => i.group_name)])]

  const add = async () => {
    if (!label.trim()) return
    await writer.insert('checklist_items', { trip_id: trip.id, kind: 'pack', label: label.trim(), group_name: group.trim() || 'Général', assigned_to: assignee || null, done: false, sort_order: nextOrder() })
    setLabel('')
  }
  const applyTemplate = async (name: string) => {
    const existing = new Set(items.map((i) => i.label.toLowerCase()))
    let order = nextOrder()
    const rows = Object.entries(PACK_TEMPLATES[name].groups).flatMap(([g, labels]) =>
      labels.filter((l) => !existing.has(l.toLowerCase())).map((l) => ({ trip_id: trip.id, kind: 'pack' as const, label: l, group_name: g, assigned_to: null, done: false, sort_order: order++ })),
    )
    if (!rows.length) return toast.info('Tout est déjà dans la liste')
    await writer.insertMany('checklist_items', rows)
    toast.success(`${rows.length} éléments ajoutés`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Luggage className="h-4 w-4 text-primary" /> À emporter</CardTitle>
        {canEdit && <TemplateMenu names={Object.entries(PACK_TEMPLATES).map(([n, t]) => [n, t.emoji])} onPick={applyTemplate} />}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && <Gauge value={items.filter((i) => i.done).length} max={items.length} label="Affaires prêtes" />}
        {canEdit && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void add() }}>
            <div className="flex gap-2">
              <Input placeholder="Ajouter un élément…" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nouvel élément à emporter" />
              <Button type="submit" size="icon" aria-label="Ajouter l’élément" disabled={!label.trim()}><Plus /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input list="checklist-groups" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Catégorie" placeholder="Catégorie" />
              <datalist id="checklist-groups">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
              <AssigneeSelect value={assignee} onChange={setAssignee} label="Qui l’emporte" />
            </div>
          </form>
        )}
        {me && items.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={mine} onCheckedChange={(c) => setMine(!!c)} /> <User className="h-4 w-4" /> Seulement mes affaires et le commun</label>
        )}
        {!list.length ? (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground"><ListChecks className="mx-auto mb-1 h-5 w-5" />Liste vide : pars d’un modèle (plage, montagne, bébé…).</p>
        ) : (
          Object.entries(groups).map(([g, its]) => (
            <section key={g}>
              <h3 className="mb-1.5 flex items-baseline justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {g} <span>{its.filter((i) => i.done).length}/{its.length}</span>
              </h3>
              <ul className="divide-y overflow-hidden rounded-2xl border">
                {its.map((i) => {
                  const who = i.assigned_to ? memberById[i.assigned_to] : undefined
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox id={`ck-${i.id}`} checked={i.done} disabled={!canEdit} onCheckedChange={(c) => writer.update('checklist_items', i.id, { done: !!c })} />
                      <label htmlFor={`ck-${i.id}`} className={cn('min-w-0 flex-1 text-sm', i.done && 'text-muted-foreground line-through')}>{i.label}</label>
                      {canEdit ? (
                        <AssigneeSelect small value={i.assigned_to ?? ''} onChange={(v) => writer.update('checklist_items', i.id, { assigned_to: v || null })} label={`Qui emporte « ${i.label} »`} />
                      ) : who && <Avatar name={who.display_name} color={who.color} size="xs" />}
                      {canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${i.label} »`} onClick={() => writer.remove('checklist_items', i.id)}><Trash2 /></Button>}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TemplateMenu({ names, onPick }: { names: [string, string][]; onPick: (n: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Sparkles /> Modèles</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ajouter un modèle</DropdownMenuLabel>
        {names.map(([n, emoji]) => <DropdownMenuItem key={n} onSelect={() => onPick(n)}>{emoji} {n}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
