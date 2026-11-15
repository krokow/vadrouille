import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Lightbulb, Plus } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { tripDays } from '@/lib/dates'
import { fmtDay, fmtDayLong, isoDay } from '@/lib/format'
import { forecast, weatherIcon } from '@/lib/weather'
import { orderBetween } from '@/lib/order'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Activity } from '@/lib/types'
import { ActivityCard, DragHandle } from './ActivityCard'
import { useActivityData } from './useActivityData'
import { sortDay } from './logic'

const IDEAS = 'ideas'

export default function PlanningPage() {
  const { trip, canEdit, members, writer } = useTrip()
  const quick = useQuickAdd()
  const data = useActivityData()
  const days = useMemo(() => {
    const set = new Set(tripDays(trip.start_date, trip.end_date))
    for (const a of data.activities) if (a.day_date) set.add(a.day_date)
    return [...set].sort()
  }, [trip.start_date, trip.end_date, data.activities])

  const weather = useQuery({
    queryKey: ['weather', trip.lat, trip.lng],
    queryFn: () => forecast(trip.lat!, trip.lng!),
    enabled: trip.lat != null && trip.lng != null && days.length > 0,
    staleTime: 3 * 60 * 60_000,
  })
  const weatherByDay = useMemo(() => Object.fromEntries((weather.data ?? []).map((w) => [w.date, w])), [weather.data])

  // conteneurs : un par jour + idées ; état local pendant le glisser
  const derived = useMemo(() => {
    const map: Record<string, string[]> = { [IDEAS]: [] }
    for (const d of days) map[d] = []
    const byId: Record<string, Activity> = {}
    for (const a of data.activities) byId[a.id] = a
    const grouped: Record<string, Activity[]> = {}
    for (const a of data.activities) (grouped[a.day_date ?? IDEAS] ??= []).push(a)
    for (const [k, list] of Object.entries(grouped)) {
      map[k] = (k === IDEAS
        ? [...list].sort((x, y) => (data.votesOf[y.id]?.count ?? 0) - (data.votesOf[x.id]?.count ?? 0) || x.sort_order - y.sort_order)
        : sortDay(list)
      ).map((a) => a.id)
    }
    return { map, byId }
  }, [data.activities, data.votesOf, days])

  const [items, setItems] = useState(derived.map)
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    if (!activeId) setItems(derived.map)
  }, [derived.map, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const containerOf = (id: string) => (id in items ? id : Object.keys(items).find((k) => items[k].includes(id)))

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = containerOf(String(active.id))
    const to = containerOf(String(over.id))
    if (!from || !to || from === to) return
    setItems((prev) => {
      const fromList = prev[from].filter((x) => x !== active.id)
      const toList = [...prev[to]]
      const overIndex = toList.indexOf(String(over.id))
      toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, String(active.id))
      return { ...prev, [from]: fromList, [to]: toList }
    })
  }
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    setActiveId(null)
    if (!over) return setItems(derived.map)
    const to = containerOf(String(over.id))
    if (!to) return
    let list = items[to]
    const oldIndex = list.indexOf(id)
    const overIndex = list.indexOf(String(over.id))
    if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) list = arrayMove(list, oldIndex, overIndex)
    setItems((prev) => ({ ...prev, [to]: list }))
    const idx = list.indexOf(id)
    const before = derived.byId[list[idx - 1]]?.sort_order
    const after = derived.byId[list[idx + 1]]?.sort_order
    const a = derived.byId[id]
    const day = to === IDEAS ? null : to
    if (a && (a.day_date !== day || derived.map[to]?.indexOf(id) !== idx)) {
      // si on déplace une activité horodatée dans un autre jour, l'heure est conservée
      await writer.update('activities', id, { day_date: day, sort_order: orderBetween(before, after) })
    }
  }

  const scrollTo = (d: string) => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const today = isoDay()
  const jumped = useRef(false)
  useEffect(() => {
    if (jumped.current || !days.includes(today)) return
    jumped.current = true
    setTimeout(() => scrollTo(today), 300)
  }, [days, today])

  if (data.loading) return <ListSkeleton rows={5} />

  const card = (id: string, sortable: boolean) => {
    const a = derived.byId[id]
    if (!a) return null
    return (
      <SortableActivity key={id} id={id} disabled={!sortable}>
        {(handle) => (
          <ActivityCard
            activity={a}
            place={a.place_id ? data.placeById[a.place_id] : undefined}
            attendees={data.attendeesOf[a.id]}
            totalMembers={members.length}
            votes={data.votesOf[a.id]?.count}
            voted={!!data.votesOf[a.id]?.mine}
            comments={data.commentsOf[a.id]}
            onVote={!a.day_date ? () => data.toggleVote(a.id) : undefined}
            dragHandle={sortable ? handle : undefined}
          />
        )}
      </SortableActivity>
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Planning"
        subtitle={days.length ? `${days.length} jour${days.length > 1 ? 's' : ''} · ${data.activities.length} activité${data.activities.length > 1 ? 's' : ''}` : 'Ajoute des dates au voyage pour planifier jour par jour'}
        action={canEdit && <Button onClick={() => quick({ kind: 'activity' })} className="hidden sm:inline-flex"><Plus /> Activité</Button>}
      />

      {days.length > 1 && (
        <div className="sticky top-[57px] z-20 -mx-4 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur lg:top-0">
          <div className="flex gap-2">
            {days.map((d) => (
              <button key={d} onClick={() => scrollTo(d)}
                className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold', d === today ? 'border-coral bg-coral text-coral-foreground' : 'bg-card')}>
                {fmtDay(d)} {weatherByDay[d] && weatherIcon(weatherByDay[d].code).icon}
              </button>
            ))}
            <button onClick={() => scrollTo(IDEAS)} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">💡 Idées</button>
          </div>
        </div>
      )}

      {!data.activities.length && (
        <EmptyState icon={CalendarDays} title="Le carnet est vide" description="Ajoute des activités à un jour précis ou dans la liste d’idées, puis votez pour vos préférées."
          action={canEdit && <Button onClick={() => quick({ kind: 'activity' })}><Plus /> Première activité</Button>} />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setItems(derived.map) }}>
        {days.map((d, i) => {
          const w = weatherByDay[d]
          return (
            <section key={d} id={`day-${d}`} className="scroll-mt-28" aria-labelledby={`h-${d}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id={`h-${d}`} className="flex items-baseline gap-2 font-display text-lg font-semibold first-letter:uppercase">
                  <span className={cn('flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-sans text-xs font-bold', d === today ? 'bg-coral text-coral-foreground' : 'bg-primary/10 text-primary')}>J{i + 1}</span>
                  {fmtDayLong(d)}
                </h2>
                <div className="flex items-center gap-2">
                  {w && <span className="text-xs text-muted-foreground" title={weatherIcon(w.code).label}>{weatherIcon(w.code).icon} {w.tmin}°/{w.tmax}°{w.rain >= 40 ? ` · 💧${w.rain}%` : ''}</span>}
                  {canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Ajouter une activité le ${fmtDay(d)}`} onClick={() => quick({ kind: 'activity', defaults: { day_date: d } })}><Plus /></Button>}
                </div>
              </div>
              <DayDropZone id={d} empty={!items[d]?.length}>
                <SortableContext id={d} items={items[d] ?? []} strategy={verticalListSortingStrategy}>
                  {(items[d] ?? []).map((id) => card(id, canEdit))}
                </SortableContext>
              </DayDropZone>
            </section>
          )
        })}

        <section id={`day-${IDEAS}`} className="scroll-mt-28 rounded-3xl border border-dashed bg-sand/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb className="h-5 w-5 text-warning" /> Idées non planifiées</h2>
            {canEdit && <Button variant="ghost" size="sm" onClick={() => quick({ kind: 'activity', defaults: { day_date: '' } })}><Plus /> Idée</Button>}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Votez 👍 pour vos envies, puis glissez-les dans un jour.</p>
          <DayDropZone id={IDEAS} empty={!items[IDEAS]?.length}>
            <SortableContext id={IDEAS} items={items[IDEAS] ?? []} strategy={verticalListSortingStrategy}>
              {(items[IDEAS] ?? []).map((id) => card(id, canEdit))}
            </SortableContext>
          </DayDropZone>
        </section>

        <DragOverlay>
          {activeId && derived.byId[activeId] ? (
            <ActivityCard activity={derived.byId[activeId]} place={data.placeById[derived.byId[activeId].place_id ?? '']} className="rotate-1 shadow-xl ring-2 ring-primary" />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function DayDropZone({ id, empty, children }: { id: string; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn('flex min-h-[3.5rem] flex-col gap-2 rounded-2xl transition-colors', isOver && 'bg-primary/5 ring-2 ring-primary/30')}>
      {children}
      {empty && <p className="flex h-14 items-center justify-center rounded-2xl border border-dashed text-xs text-muted-foreground">Journée libre ✨</p>}
    </div>
  )
}

function SortableActivity({ id, disabled, children }: { id: string; disabled?: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'opacity-40')}>
      {children(<DragHandle {...attributes} {...listeners} />)}
    </div>
  )
}
