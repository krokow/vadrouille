import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { Crosshair, Loader2, Plus, Route, X } from 'lucide-react'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { tripDays } from '@/lib/dates'
import { fmtDay } from '@/lib/format'
import { osrmRoute, reverseGeocode, haversineKm, type GeoResult } from '@/lib/geocode'
import { PlaceSearch } from '@/components/PlaceSearch'
import { MapLinks } from '@/components/MapLinks'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildPoints, POINT_KINDS, type MapPoint, type PointKind } from './mapPoints'

const iconCache = new Map<string, L.DivIcon>()
function pinIcon(color: string, emoji: string, highlight = false, label?: string) {
  const key = `${color}${emoji}${highlight}${label}`
  let icon = iconCache.get(key)
  if (!icon) {
    const size = highlight ? 44 : 36
    icon = L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size + 4],
      html: `<div style="position:relative;width:${size}px;height:${size}px">
        <div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>
        <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${highlight ? 20 : 16}px;padding-bottom:4px">${emoji}</span>
        ${label ? `<span style="position:absolute;top:-6px;right:-6px;background:#111;color:#fff;border-radius:999px;font:700 10px/16px sans-serif;min-width:16px;text-align:center;padding:0 3px;border:2px solid white">${label}</span>` : ''}
      </div>`,
    })
    iconCache.set(key, icon)
  }
  return icon
}

function FitBounds({ points, fallback }: { points: { lat: number; lng: number }[]; fallback: [number, number] | null }) {
  const map = useMap()
  const sig = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 })
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14)
    else if (fallback) map.setView(fallback, 11)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map])
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [target, map])
  return null
}

function ClickToAdd({ onPick, enabled }: { onPick: (lat: number, lng: number) => void; enabled: boolean }) {
  useMapEvents({
    contextmenu: (e) => enabled && onPick(e.latlng.lat, e.latlng.lng),
  })
  return null
}

function CenterTracker({ onChange }: { onChange: (c: { lat: number; lng: number }) => void }) {
  useMapEvents({ moveend: (e) => onChange(e.target.getCenter()) })
  return null
}

export default function MapPage() {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const [params, setParams] = useSearchParams()
  const places = useTripTable(trip.id, 'places')
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const base = `/t/${trip.id}`
  const [day, setDay] = useState<string>('all')
  const [kinds, setKinds] = useState<Set<PointKind>>(new Set(Object.keys(POINT_KINDS) as PointKind[]))
  const [road, setRoad] = useState(false)
  const [candidate, setCandidate] = useState<GeoResult | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null)
  const focusId = params.get('focus')

  const all = useMemo(() => buildPoints(base, places.data ?? [], activities.data ?? [], bookings.data ?? []), [base, places.data, activities.data, bookings.data])
  const days = useMemo(() => {
    const s = new Set(tripDays(trip.start_date, trip.end_date))
    all.forEach((p) => p.day && s.add(p.day))
    return [...s].sort()
  }, [all, trip.start_date, trip.end_date])

  const visible = useMemo(
    () => all.filter((p) => kinds.has(p.kind) && (day === 'all' || (day === 'none' ? !p.day : p.day === day))),
    [all, kinds, day],
  )
  const dayRoute = useMemo(() => (day !== 'all' && day !== 'none' ? [...visible].sort((a, b) => a.sort.localeCompare(b.sort)) : []), [visible, day])
  const routeOrder = useMemo(() => new Map(dayRoute.map((p, i) => [p.key, i + 1])), [dayRoute])
  const straightKm = dayRoute.slice(1).reduce((s, p, i) => s + haversineKm(dayRoute[i].place, p.place), 0)

  const osrm = useQuery({
    queryKey: ['osrm', dayRoute.map((p) => p.place.id).join(',')],
    queryFn: () => osrmRoute(dayRoute.map((p) => p.place)),
    enabled: road && dayRoute.length >= 2,
    staleTime: Infinity,
    meta: { persist: false },
  })

  const focused = focusId ? all.find((p) => p.place.id === focusId) : undefined
  const fallback: [number, number] | null = trip.lat != null && trip.lng != null ? [trip.lat, trip.lng] : null

  const pickPoint = async (lat: number, lng: number) => {
    setCandidate({ id: 'pick', name: 'Point choisi', label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, osm_id: null, kind: null })
    const r = await reverseGeocode(lat, lng).catch(() => null)
    if (r) setCandidate(r)
  }

  const toggleKind = (k: PointKind) =>
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k) && next.size > 1) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100dvh-57px-64px)] flex-col lg:mx-0 lg:mt-0 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden lg:rounded-3xl lg:border">
      <div className="space-y-2 border-b bg-background p-3">
        <PlaceSearch near={center} onSelect={(r) => setCandidate(r)} placeholder="Chercher un lieu à ajouter…" />
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
          <Chip active={day === 'all'} onClick={() => setDay('all')}>Tous les jours</Chip>
          {days.map((d, i) => <Chip key={d} active={day === d} onClick={() => setDay(d)}>J{i + 1} · {fmtDay(d)}</Chip>)}
          <Chip active={day === 'none'} onClick={() => setDay('none')}>💡 Non planifiés</Chip>
        </div>
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3">
          {(Object.entries(POINT_KINDS) as [PointKind, (typeof POINT_KINDS)[PointKind]][]).map(([k, v]) => (
            <button key={k} onClick={() => toggleKind(k)} aria-pressed={kinds.has(k)}
              className={cn('flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity', !kinds.has(k) && 'opacity-40')}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <MapContainer center={fallback ?? [46.6, 2.4]} zoom={fallback ? 11 : 5} className="h-full w-full" zoomControl={false} attributionControl>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <FitBounds points={visible.map((p) => p.place)} fallback={fallback} />
          <FlyTo target={candidate ?? focused?.place ?? null} />
          <CenterTracker onChange={setCenter} />
          <ClickToAdd enabled={canEdit} onPick={pickPoint} />
          {dayRoute.length >= 2 && (
            <Polyline
              positions={road && osrm.data ? osrm.data.coords : dayRoute.map((p) => [p.place.lat, p.place.lng] as [number, number])}
              pathOptions={{ color: '#ef7b62', weight: 4, opacity: 0.85, dashArray: road && osrm.data ? undefined : '8 8' }}
            />
          )}
          {visible.map((p) => (
            <PointMarker key={p.key} point={p} order={routeOrder.get(p.key)} highlight={p.place.id === focusId} />
          ))}
          {candidate && (
            <Marker position={[candidate.lat, candidate.lng]} icon={pinIcon('#111827', '➕', true)}>
              <Popup autoClose={false} closeOnClick={false}>
                <CandidatePopup candidate={candidate} canEdit={canEdit} onAdd={() => { quick({ kind: 'activity', defaults: { place: candidate, title: candidate.name === 'Point choisi' ? '' : candidate.name } }); setCandidate(null) }} onClose={() => setCandidate(null)} />
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {dayRoute.length >= 2 && (
          <div className="absolute bottom-3 left-3 right-3 z-[400] flex items-center justify-between gap-2 rounded-2xl border bg-background/95 p-2 pl-3 shadow-lg backdrop-blur sm:right-auto">
            <div className="text-xs">
              <p className="font-semibold">Itinéraire du {fmtDay(day)} · {dayRoute.length} étapes</p>
              <p className="text-muted-foreground">
                {road && osrm.data ? `${osrm.data.km.toFixed(1)} km en voiture · ~${Math.round(osrm.data.minutes)} min` : `${straightKm.toFixed(1)} km à vol d’oiseau`}
                {osrm.isError && ' · calcul routier indisponible'}
              </p>
            </div>
            <Button size="sm" variant={road ? 'default' : 'outline'} onClick={() => setRoad((r) => !r)} aria-pressed={road}>
              {osrm.isFetching ? <Loader2 className="animate-spin" /> : <Route />} Routier
            </Button>
          </div>
        )}
        {!visible.length && !places.isLoading && (
          <div className="pointer-events-none absolute inset-x-6 top-6 z-[400] rounded-2xl bg-background/95 p-3 text-center text-sm shadow-lg">
            <p className="font-semibold">Aucun lieu à afficher</p>
            <p className="text-xs text-muted-foreground">Cherche un lieu ci-dessus{canEdit ? ' ou fais un appui long / clic droit sur la carte' : ''} pour l’ajouter.</p>
          </div>
        )}
        {focused && (
          <button onClick={() => setParams({})} className="absolute right-3 top-3 z-[400] flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold shadow">
            <Crosshair className="h-3.5 w-3.5" /> {focused.title} <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-semibold', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
      {children}
    </button>
  )
}

function PointMarker({ point: p, order, highlight }: { point: MapPoint; order?: number; highlight?: boolean }) {
  const color = POINT_KINDS[p.kind].color
  return (
    <Marker position={[p.place.lat, p.place.lng]} icon={pinIcon(color, p.emoji, highlight, order ? String(order) : undefined)}
      eventHandlers={highlight ? { add: (e) => setTimeout(() => (e.target as L.Marker).openPopup(), 700) } : undefined}>
      <Popup>
        <div className="min-w-[200px] space-y-2 font-sans">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{POINT_KINDS[p.kind].label}{p.day ? ` · ${fmtDay(p.day)}` : ''}</p>
            <p className="text-sm font-bold">{p.emoji} {p.title}</p>
            {p.place.address && <p className="text-xs opacity-70">{p.place.address}</p>}
          </div>
          {p.to && <Link to={p.to} className="block text-xs font-bold text-primary">Ouvrir la fiche →</Link>}
          <MapLinks lat={p.place.lat} lng={p.place.lng} name={p.place.name} />
        </div>
      </Popup>
    </Marker>
  )
}

function CandidatePopup({ candidate, canEdit, onAdd, onClose }: { candidate: GeoResult; canEdit: boolean; onAdd: () => void; onClose: () => void }) {
  return (
    <div className="min-w-[200px] space-y-2 font-sans">
      <div>
        <p className="text-sm font-bold">{candidate.name}</p>
        {candidate.label && <p className="text-xs opacity-70">{candidate.label}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <Button size="sm" onClick={onAdd}><Plus /> Ajouter une activité ici</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
      <MapLinks lat={candidate.lat} lng={candidate.lng} name={candidate.name} />
    </div>
  )
}
