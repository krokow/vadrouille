import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, ExternalLink, Bike, Car, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Footprints, Layers, Loader2, LocateFixed, Maximize, Plus, Route, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTrip } from '@/features/trips/TripContext'
import { useQuickAdd } from '@/features/trips/QuickAdd'
import { useTripTable } from '@/lib/data'
import { tripDays } from '@/lib/dates'
import { fmtDay, fmtTime } from '@/lib/format'
import { osrmRoute, reverseGeocode, haversineKm, type GeoResult, type RouteMode } from '@/lib/geocode'
import { useTheme } from '@/app/theme'
import { useMediaQuery } from '@/lib/hooks'
import { PlaceSearch } from '@/components/PlaceSearch'
import { ScrollRow } from '@/components/ScrollRow'
import { MapLinks } from '@/components/MapLinks'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { buildPoints, POINT_KINDS, type MapPoint, type PointKind } from './mapPoints'
import { DAY_COLORS, resolveTile, TILE_STYLES, type TileKey } from './tiles'
import { SUGGEST_CATEGORIES, suggestAround, type SuggestCategory, type Suggestion } from '@/lib/overpass'

type Mode = 'straight' | RouteMode
const MODES: { key: Mode; label: string; icon: typeof Footprints }[] = [
  { key: 'straight', label: 'Vol d’oiseau', icon: Route },
  { key: 'foot', label: 'À pied', icon: Footprints },
  { key: 'bike', label: 'Vélo', icon: Bike },
  { key: 'car', label: 'Voiture', icon: Car },
]
const SPEED_KMH: Record<Mode, number> = { straight: 4.5, foot: 4.5, bike: 15, car: 35 }

/** Préférence locale (par appareil) */
function usePref<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`vadrouille-map-${key}`)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = (n: T) => {
    setV(n)
    try { localStorage.setItem(`vadrouille-map-${key}`, JSON.stringify(n)) } catch { /* ignore */ }
  }
  return [v, set] as const
}

// ---------------------------------------------------------------- icônes
const iconCache = new Map<string, L.DivIcon>()
function pinIcon(color: string, content: string, opts: { big?: boolean; badge?: string; square?: boolean } = {}) {
  const key = `${color}|${content}|${opts.big}|${opts.badge}|${opts.square}`
  const hit = iconCache.get(key)
  if (hit) return hit
  const size = opts.big ? 44 : 36
  const shape = opts.square ? 'border-radius:12px' : 'border-radius:50% 50% 50% 0;transform:rotate(-45deg)'
  const icon = L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, opts.square ? size / 2 : size],
    popupAnchor: [0, opts.square ? -size / 2 : -size + 4],
    html: `<div style="position:relative;width:${size}px;height:${size}px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))">
      <div style="width:${size}px;height:${size}px;${shape};background:${color};border:3px solid #fff"></div>
      <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 ${opts.big ? 18 : 15}px/1 system-ui;color:#fff;padding-bottom:${opts.square ? 0 : 4}px">${content}</span>
      ${opts.badge ? `<span style="position:absolute;top:-7px;right:-7px;background:#111827;color:#fff;border-radius:999px;font:800 10px/16px system-ui;min-width:18px;height:18px;line-height:14px;text-align:center;padding:0 4px;border:2px solid #fff">${opts.badge}</span>` : ''}
    </div>`,
  })
  iconCache.set(key, icon)
  return icon
}

function arrowIcon(color: string, bearing: number) {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<svg width="18" height="18" viewBox="0 0 24 24" style="transform:rotate(${bearing}deg)"><path d="M12 3l7 15-7-4-7 4z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`,
  })
}

/** Flèches de direction réparties le long du tracé */
function arrowsAlong(coords: [number, number][], count: number): { pos: [number, number]; bearing: number }[] {
  if (coords.length < 2) return []
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const d = haversineKm({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] })
    seg.push(d)
    total += d
  }
  if (total === 0) return []
  const out: { pos: [number, number]; bearing: number }[] = []
  let acc = 0
  let k = 0
  for (let i = 0; i < seg.length && k < count; i++) {
    while (k < count && acc + seg[i] >= ((k + 0.5) / count) * total) {
      const target = ((k + 0.5) / count) * total
      const t = seg[i] ? (target - acc) / seg[i] : 0
      const [a, b] = [coords[i], coords[i + 1]]
      const lat = a[0] + (b[0] - a[0]) * t
      const lng = a[1] + (b[1] - a[1]) * t
      const bearing = (Math.atan2((b[1] - a[1]) * Math.cos((lat * Math.PI) / 180), b[0] - a[0]) * 180) / Math.PI
      out.push({ pos: [lat, lng], bearing })
      k++
    }
    acc += seg[i]
  }
  return out
}

// ---------------------------------------------------------------- helpers carte
function FitTo({ points, fallback, signal }: { points: { lat: number; lng: number }[]; fallback: [number, number] | null; signal: number }) {
  const map = useMap()
  const sig = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 16 })
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15)
    else if (fallback) map.setView(fallback, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map, signal])
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [target, map])
  return null
}

function MapEvents({ onPick, onMove, enabled }: { onPick: (lat: number, lng: number) => void; onMove: (c: { lat: number; lng: number }) => void; enabled: boolean }) {
  useMapEvents({
    contextmenu: (e) => enabled && onPick(e.latlng.lat, e.latlng.lng),
    moveend: (e) => onMove(e.target.getCenter()),
  })
  return null
}

function InvalidateOnResize({ dep }: { dep: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`)
const fmtMin = (m: number) => (m < 60 ? `${Math.max(1, Math.round(m))} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`)

interface Stop {
  key: string
  point: MapPoint
  label: string
  kind: 'lodging' | 'step'
}

// ---------------------------------------------------------------- page
export default function MapPage() {
  const { trip, canEdit } = useTrip()
  const quick = useQuickAdd()
  const { theme } = useTheme()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [params, setParams] = useSearchParams()
  const places = useTripTable(trip.id, 'places')
  const activities = useTripTable(trip.id, 'activities')
  const bookings = useTripTable(trip.id, 'bookings')
  const base = `/t/${trip.id}`

  const [day, setDay] = useState<string>('all')
  const [kinds, setKinds] = useState<Set<PointKind>>(new Set(Object.keys(POINT_KINDS) as PointKind[]))
  const [tileKey, setTileKey] = usePref<TileKey>('tiles', 'auto')
  const [mode, setMode] = usePref<Mode>('mode', 'foot')
  const [fromLodging, setFromLodging] = usePref('lodging', true)
  const [allRoutes, setAllRoutes] = usePref('allroutes', true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [candidate, setCandidate] = useState<GeoResult | null>(null)
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [me, setMe] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestCat, setSuggestCat] = useState<SuggestCategory>('top')
  const [suggestCenter, setSuggestCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null)
  const focusId = params.get('focus')
  const tile = resolveTile(tileKey, theme === 'dark')

  const all = useMemo(() => buildPoints(base, places.data ?? [], activities.data ?? [], bookings.data ?? []), [base, places.data, activities.data, bookings.data])
  const days = useMemo(() => {
    const s = new Set(tripDays(trip.start_date, trip.end_date))
    all.forEach((p) => p.day && p.kind !== 'lodging' && s.add(p.day))
    return [...s].sort()
  }, [all, trip.start_date, trip.end_date])
  const dayIndex = (d: string | null) => (d ? days.indexOf(d) : -1)

  const visible = useMemo(
    () => all.filter((p) => kinds.has(p.kind) && (day === 'all' || p.kind === 'lodging' || (day === 'none' ? !p.day : p.day === day))),
    [all, kinds, day],
  )

  // hébergement occupé un jour donné
  const lodgingFor = (d: string): MapPoint | undefined => {
    const b = (bookings.data ?? []).find((x) => x.type === 'lodging' && x.status !== 'cancelled' && x.place_id && x.start_at && x.start_at.slice(0, 10) <= d && (x.end_at ?? x.start_at).slice(0, 10) >= d)
    return b ? all.find((p) => p.key === `b-${b.id}`) : undefined
  }

  const singleDay = day !== 'all' && day !== 'none'
  const stops: Stop[] = useMemo(() => {
    if (!singleDay) return []
    const steps = visible.filter((p) => p.day === day && p.kind !== 'lodging' && p.key.startsWith('a-')).sort((a, b) => a.sort.localeCompare(b.sort))
    const list: Stop[] = steps.map((p, i) => ({ key: p.key, point: p, label: String(i + 1), kind: 'step' }))
    const lodging = fromLodging ? lodgingFor(day) : undefined
    if (lodging && list.length) {
      list.unshift({ key: 'start', point: lodging, label: 'H', kind: 'lodging' })
      list.push({ key: 'end', point: lodging, label: 'H', kind: 'lodging' })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, day, singleDay, fromLodging, bookings.data, all])

  const routeQ = useQuery({
    queryKey: ['route', mode, stops.map((s) => s.point.place.id).join(',')],
    queryFn: () => osrmRoute(stops.map((s) => s.point.place), mode as RouteMode),
    enabled: mode !== 'straight' && stops.length >= 2,
    staleTime: Infinity,
    retry: false,
    meta: { persist: false },
  })
  useEffect(() => {
    if (routeQ.isError) toast.error('Itinéraire indisponible : tracé à vol d’oiseau affiché')
  }, [routeQ.isError])

  const routed = mode !== 'straight' && routeQ.data ? routeQ.data : null
  const lineCoords: [number, number][] = routed ? routed.coords : stops.map((s) => [s.point.place.lat, s.point.place.lng])
  const legs = useMemo(() => {
    if (routed) return routed.legs
    return stops.slice(1).map((s, i) => {
      const km = haversineKm(stops[i].point.place, s.point.place)
      return { km, minutes: (km / SPEED_KMH[mode]) * 60 }
    })
  }, [routed, stops, mode])
  const totalKm = legs.reduce((a, l) => a + l.km, 0)
  const totalMin = legs.reduce((a, l) => a + l.minutes, 0)

  // trajets de tous les jours (vue d'ensemble)
  const dayLines = useMemo(() => {
    if (day !== 'all' || !allRoutes) return []
    const byDay = new Map<string, MapPoint[]>()
    for (const p of visible) if (p.day && p.key.startsWith('a-')) byDay.set(p.day, [...(byDay.get(p.day) ?? []), p])
    return [...byDay.entries()]
      .filter(([, pts]) => pts.length >= 2)
      .map(([d, pts]) => ({ day: d, color: DAY_COLORS[Math.max(0, dayIndex(d)) % DAY_COLORS.length], coords: pts.sort((a, b) => a.sort.localeCompare(b.sort)).map((p) => [p.place.lat, p.place.lng] as [number, number]) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, day, allRoutes, days])

  const stepNumber = useMemo(() => new Map(stops.filter((s) => s.kind === 'step').map((s) => [s.point.key, s.label])), [stops])
  const dayColorOf = (p: MapPoint) => (day === 'all' && allRoutes && p.day && p.key.startsWith('a-') && dayIndex(p.day) >= 0 ? DAY_COLORS[dayIndex(p.day) % DAY_COLORS.length] : null)
  const routeColor = singleDay ? DAY_COLORS[Math.max(0, dayIndex(day)) % DAY_COLORS.length] : '#ef7b62'

  const suggestQ = useQuery({
    queryKey: ['suggest', suggestCat, suggestCenter?.lat.toFixed(3), suggestCenter?.lng.toFixed(3)],
    queryFn: () => suggestAround(suggestCat, suggestCenter!),
    enabled: suggestOpen && !!suggestCenter,
    staleTime: Infinity,
    retry: false,
    meta: { persist: false },
  })
  const existingNames = useMemo(() => new Set(all.map((p) => p.place.name.toLowerCase())), [all])
  const openSuggestions = () => {
    setSuggestOpen(true)
    setSuggestCenter(center ?? (fallback ? { lat: fallback[0], lng: fallback[1] } : null))
  }
  const addSuggestion = (sg: Suggestion) => {
    const meta = SUGGEST_CATEGORIES[suggestCat]
    quick({
      kind: 'activity',
      defaults: {
        title: sg.name, category: meta.activity, day_date: singleDay ? day : '',
        place: { id: sg.id, name: sg.name, label: sg.address ?? '', lat: sg.lat, lng: sg.lng, osm_id: sg.id, kind: sg.kind },
        description: sg.cuisine ? `Cuisine : ${sg.cuisine}` : '',
        attention_notes: sg.opening_hours ? { opening_hours: sg.opening_hours } : undefined,
        links: sg.website ? [{ label: 'Site officiel', url: sg.website }] : [],
      },
    })
  }

  const focused = focusId ? all.find((p) => p.place.id === focusId) : undefined
  const fallback: [number, number] | null = trip.lat != null && trip.lng != null ? [trip.lat, trip.lng] : null
  const fitPoints = singleDay && stops.length ? stops.map((s) => s.point.place) : visible.map((p) => p.place)

  const pickPoint = async (lat: number, lng: number) => {
    setCandidate({ id: 'pick', name: 'Point choisi', label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, osm_id: null, kind: null })
    const r = await reverseGeocode(lat, lng).catch(() => null)
    if (r) setCandidate(r)
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Géolocalisation non disponible')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }
        setMe(p)
        setFly({ lat: p.lat, lng: p.lng, zoom: 16 })
      },
      () => toast.error('Position indisponible (autorisation refusée ?)'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const toggleKind = (k: PointKind) =>
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k) && next.size > 1) next.delete(k)
      else next.add(k)
      return next
    })

  const panel = singleDay && stops.length >= 1 && (
    <RoutePanel
      day={day} dayNumber={dayIndex(day) + 1} color={routeColor} stops={stops} legs={legs} mode={mode} setMode={setMode}
      totalKm={totalKm} totalMin={totalMin} loading={routeQ.isFetching} approx={mode !== 'straight' && !routed}
      open={panelOpen || desktop} onToggle={() => setPanelOpen((o) => !o)} desktop={desktop}
      onStop={(s) => setFly({ lat: s.point.place.lat, lng: s.point.place.lng, zoom: 16 })}
    />
  )

  return (
    <div className="flex h-[calc(100dvh-57px-64px)] flex-col lg:h-dvh">
      {/* barre de recherche et filtres */}
      <div className="relative z-20 space-y-2 border-b bg-background/95 p-3 backdrop-blur">
        <div className="flex gap-2">
          <PlaceSearch near={center} onSelect={(r) => setCandidate(r)} placeholder="Chercher un lieu à ajouter…" className="flex-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Options de la carte"><Settings2 /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Options</p>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Départ et retour à l’hébergement<span className="block text-xs text-muted-foreground">si une réservation d’hébergement couvre le jour</span></span>
                <Switch checked={fromLodging} onCheckedChange={setFromLodging} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Trajets de tous les jours<span className="block text-xs text-muted-foreground">en couleur, sur la vue d’ensemble</span></span>
                <Switch checked={allRoutes} onCheckedChange={setAllRoutes} />
              </label>
              <div>
                <p className="mb-1.5 text-sm">Fond de carte</p>
                <TileChooser value={tileKey} onChange={setTileKey} />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <DayPicker days={days} value={day} onChange={setDay} />
          <ScrollRow className="lg:ml-auto">
            {(Object.entries(POINT_KINDS) as [PointKind, (typeof POINT_KINDS)[PointKind]][]).map(([k, v]) => (
              <button key={k} onClick={() => toggleKind(k)} aria-pressed={kinds.has(k)}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold transition-opacity', !kinds.has(k) && 'opacity-40')}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} /> {v.label}
              </button>
            ))}
          </ScrollRow>
        </div>
      </div>

      <div className="relative isolate flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <MapContainer center={fallback ?? [46.6, 2.4]} zoom={fallback ? 12 : 5} className="h-full w-full" zoomControl={false}>
            <TileLayer key={tile.url} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} 
              className={tile.dim ? 'dim-tiles' : undefined} />
            <FitTo points={fitPoints} fallback={fallback} signal={fitSignal} />
            <FlyTo target={fly ?? (candidate ? { lat: candidate.lat, lng: candidate.lng } : focused ? { lat: focused.place.lat, lng: focused.place.lng } : null)} />
            <MapEvents enabled={canEdit} onPick={pickPoint} onMove={setCenter} />
            <InvalidateOnResize dep={`${desktop}-${!!panel}`} />

            {dayLines.map((l) => (
              <RouteLine key={l.day} coords={l.coords} color={l.color} weight={4} dashed arrows={Math.max(1, l.coords.length - 1)} />
            ))}
            {singleDay && lineCoords.length >= 2 && (
              <RouteLine coords={lineCoords} color={routeColor} weight={6} dashed={mode === 'straight' || !routed} arrows={Math.min(14, Math.max(2, (stops.length - 1) * 2))} />
            )}

            {visible.map((p) => {
              const num = stepNumber.get(p.key)
              const color = dayColorOf(p) ?? (num ? routeColor : POINT_KINDS[p.kind].color)
              const icon = num ? pinIcon(color, num, { big: p.place.id === focusId }) : pinIcon(color, p.emoji, { big: p.place.id === focusId, square: p.kind === 'lodging' })
              return <PointMarker key={p.key} point={p} icon={icon} openOnAdd={p.place.id === focusId} />
            })}
            {suggestOpen && (suggestQ.data ?? []).map((sg) => (
              <Marker key={sg.id} position={[sg.lat, sg.lng]} icon={suggestIcon(SUGGEST_CATEGORIES[suggestCat].emoji, sg.famous)}>
                <Popup>
                  <SuggestionPopup sg={sg} canEdit={canEdit} already={existingNames.has(sg.name.toLowerCase())} onAdd={() => addSuggestion(sg)} />
                </Popup>
              </Marker>
            ))}
            {candidate && (
              <Marker position={[candidate.lat, candidate.lng]} icon={pinIcon('#111827', '+', { big: true })}>
                <Popup autoClose={false} closeOnClick={false}>
                  <div className="min-w-[200px] space-y-2 font-sans">
                    <div>
                      <p className="text-sm font-bold">{candidate.name}</p>
                      {candidate.label && <p className="text-xs opacity-70">{candidate.label}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canEdit && (
                        <Button size="sm" onClick={() => { quick({ kind: 'activity', defaults: { place: candidate, title: candidate.name === 'Point choisi' ? '' : candidate.name, day_date: singleDay ? day : '' } }); setCandidate(null) }}>
                          <Plus /> Ajouter une activité ici
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setCandidate(null)}>Fermer</Button>
                    </div>
                    <MapLinks lat={candidate.lat} lng={candidate.lng} name={candidate.name} />
                  </div>
                </Popup>
              </Marker>
            )}
            {me && (
              <>
                <Circle center={[me.lat, me.lng]} radius={Math.min(me.acc, 300)} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }} />
                <Marker position={[me.lat, me.lng]} icon={L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>' })} />
              </>
            )}
          </MapContainer>

          {/* contrôles flottants */}
          <div className="absolute right-3 top-3 z-[400] flex flex-col gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md" aria-label="Fond de carte"><Layers className="h-5 w-5" /></button>
              </PopoverTrigger>
              <PopoverContent align="end" side="left" className="w-64 p-3"><TileChooser value={tileKey} onChange={setTileKey} /></PopoverContent>
            </Popover>
            <button onClick={() => (suggestOpen ? setSuggestOpen(false) : openSuggestions())} aria-pressed={suggestOpen}
              className={cn('flex h-10 w-10 items-center justify-center rounded-full border shadow-md', suggestOpen ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')} aria-label="Suggestions autour">
              <Sparkles className="h-5 w-5" />
            </button>
            <button onClick={locate} className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md" aria-label="Me localiser"><LocateFixed className="h-5 w-5" /></button>
            <button onClick={() => { setFly(null); setCandidate(null); setFitSignal((n) => n + 1) }} className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md" aria-label="Tout afficher"><Maximize className="h-5 w-5" /></button>
          </div>

          {day === 'all' && allRoutes && dayLines.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[400] max-w-[70%] rounded-2xl border bg-background/95 p-2 text-xs shadow-lg backdrop-blur">
              <p className="mb-1 font-bold">Trajets par jour</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {dayLines.map((l) => (
                  <button key={l.day} onClick={() => setDay(l.day)} className="flex items-center gap-1 hover:underline">
                    <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: l.color }} />J{dayIndex(l.day) + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!visible.length && !places.isLoading && (
            <div className="pointer-events-none absolute left-3 right-16 top-3 z-[400] sm:left-1/2 sm:right-auto sm:w-[22rem] sm:-translate-x-1/2 rounded-2xl border bg-background/95 p-3 text-center text-sm shadow-lg">
              <p className="font-semibold">Aucun lieu à afficher</p>
              <p className="text-xs text-muted-foreground">Cherche un lieu ci-dessus{canEdit ? ' ou fais un appui long / clic droit sur la carte' : ''} pour l’ajouter.</p>
            </div>
          )}
          {singleDay && stops.length < 2 && visible.length > 0 && (
            <div className="pointer-events-none absolute left-3 right-16 top-3 z-[400] sm:left-1/2 sm:right-auto sm:w-[22rem] sm:-translate-x-1/2 rounded-2xl border bg-background/95 p-3 text-center text-xs shadow-lg">
              Ajoute au moins deux activités avec un lieu ce jour-là pour voir le trajet.
            </div>
          )}
          {focused && (
            <button onClick={() => setParams({})} className="absolute left-3 top-3 z-[400] flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold shadow">
              <Crosshair className="h-3.5 w-3.5" /> {focused.title} <X className="h-3.5 w-3.5" />
            </button>
          )}
          {suggestOpen && (
            <SuggestPanel
              cat={suggestCat} setCat={(c) => { setSuggestCat(c); setSuggestCenter(center) }} loading={suggestQ.isFetching} error={suggestQ.error as Error | null}
              items={suggestQ.data ?? []} moved={!!center && !!suggestCenter && haversineKm(center, suggestCenter) > 0.8}
              onSearchHere={() => setSuggestCenter(center)} onClose={() => setSuggestOpen(false)} canEdit={canEdit}
              existing={existingNames} onAdd={addSuggestion} onFocus={(sg) => setFly({ lat: sg.lat, lng: sg.lng, zoom: 17 })}
            />
          )}
          {!desktop && !suggestOpen && panel}
        </div>
        {desktop && panel}
      </div>
    </div>
  )
}

function suggestIcon(emoji: string, famous: boolean) {
  return pinIcon(famous ? '#f59e0b' : '#64748b', emoji, { square: true })
}

function SuggestionPopup({ sg, canEdit, already, onAdd }: { sg: Suggestion; canEdit: boolean; already: boolean; onAdd: () => void }) {
  return (
    <div className="min-w-[210px] space-y-2 font-sans">
      <div>
        <p className="text-sm font-bold">{sg.famous && '⭐ '}{sg.name}</p>
        <p className="text-xs opacity-70">{[sg.cuisine, fmtKm(sg.km)].filter(Boolean).join(' · ')}</p>
        {sg.opening_hours && <p className="text-xs opacity-70">🕘 {sg.opening_hours}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <Button size="sm" onClick={onAdd} disabled={already}><Plus /> {already ? 'Déjà ajouté' : 'Ajouter'}</Button>}
        {sg.website && <Button size="sm" variant="outline" asChild><a href={sg.website} target="_blank" rel="noreferrer"><ExternalLink /> Site</a></Button>}
      </div>
      <MapLinks lat={sg.lat} lng={sg.lng} name={sg.name} />
    </div>
  )
}

function SuggestPanel(props: {
  cat: SuggestCategory; setCat: (c: SuggestCategory) => void; loading: boolean; error: Error | null; items: Suggestion[]; moved: boolean
  onSearchHere: () => void; onClose: () => void; canEdit: boolean; existing: Set<string>; onAdd: (s: Suggestion) => void; onFocus: (s: Suggestion) => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[500] flex max-h-[55%] flex-col rounded-t-3xl border-t bg-background shadow-2xl sm:inset-x-auto sm:bottom-3 sm:left-3 sm:top-3 sm:max-h-none sm:w-80 sm:rounded-3xl sm:border">
      <div className="flex items-center gap-2 p-3 pb-2">
        <Sparkles className="h-4 w-4 text-warning" />
        <p className="flex-1 text-sm font-bold">Suggestions autour</p>
        <Button variant="ghost" size="icon-sm" aria-label="Fermer les suggestions" onClick={props.onClose}><X /></Button>
      </div>
      <ScrollRow className="px-3">
        {(Object.entries(SUGGEST_CATEGORIES) as [SuggestCategory, (typeof SUGGEST_CATEGORIES)[SuggestCategory]][]).map(([k, c]) => (
          <button key={k} onClick={() => props.setCat(k)} aria-pressed={props.cat === k}
            className={cn('shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold', props.cat === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
            {c.emoji} {c.label}
          </button>
        ))}
      </ScrollRow>
      {props.moved && (
        <button onClick={props.onSearchHere} className="mx-3 mt-2 rounded-full bg-primary/10 py-1.5 text-xs font-bold text-primary">🔄 Rechercher dans cette zone</button>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {props.loading ? (
          <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Recherche…</p>
        ) : props.error ? (
          <p className="p-4 text-center text-sm text-destructive">{props.error.message}</p>
        ) : !props.items.length ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Rien trouvé à moins de 1,5 km. Déplace la carte puis relance la recherche.</p>
        ) : (
          <ul className="space-y-1">
            {props.items.map((sg) => {
              const already = props.existing.has(sg.name.toLowerCase())
              return (
                <li key={sg.id} className="flex items-center gap-2 rounded-xl p-2 hover:bg-accent/50">
                  <button className="min-w-0 flex-1 text-left" onClick={() => props.onFocus(sg)}>
                    <span className="block truncate text-sm font-semibold">{sg.famous && <span title="Lieu très connu">⭐ </span>}{sg.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[sg.cuisine, fmtKm(sg.km)].filter(Boolean).join(' · ')}</span>
                  </button>
                  {props.canEdit && (
                    <Button size="icon-sm" variant={already ? 'ghost' : 'outline'} disabled={already} aria-label={already ? 'Déjà dans le voyage' : `Ajouter ${sg.name}`} onClick={() => props.onAdd(sg)}>
                      {already ? '✓' : <Plus />}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">Données © OpenStreetMap (Overpass) · ⭐ = lieu très connu</p>
    </div>
  )
}

/** Trait d'itinéraire bien visible : contour blanc + couleur + flèches de direction */
function RouteLine({ coords, color, weight, dashed, arrows }: { coords: [number, number][]; color: string; weight: number; dashed?: boolean; arrows: number }) {
  const marks = useMemo(() => arrowsAlong(coords, arrows), [coords, arrows])
  return (
    <>
      <Polyline positions={coords} pathOptions={{ color: '#ffffff', weight: weight + 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
      <Polyline positions={coords} pathOptions={{ color, weight, opacity: 0.95, dashArray: dashed ? `${weight * 1.8} ${weight * 1.6}` : undefined, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
      {marks.map((m, i) => <Marker key={i} position={m.pos} icon={arrowIcon(color, m.bearing)} interactive={false} keyboard={false} />)}
    </>
  )
}

function TileChooser({ value, onChange }: { value: TileKey; onChange: (k: TileKey) => void }) {
  const opts: [TileKey, string][] = [['auto', 'Auto (selon le thème)'], ...Object.entries(TILE_STYLES).map(([k, t]) => [k as TileKey, t.label] as [TileKey, string])]
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fond de carte">
      {opts.map(([k, label]) => (
        <button key={k} role="radio" aria-checked={value === k} onClick={() => onChange(k)}
          className={cn('rounded-xl border px-2 py-1.5 text-left text-xs font-semibold', value === k ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent')}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Sélecteur de jour compact : vue d'ensemble · ◀ J3 · lun. 3 mai ▶ · non planifiés */
function DayPicker({ days, value, onChange }: { days: string[]; value: string; onChange: (d: string) => void }) {
  const idx = days.indexOf(value)
  const isDay = idx >= 0
  const color = isDay ? DAY_COLORS[idx % DAY_COLORS.length] : undefined
  const go = (delta: number) => {
    const next = isDay ? idx + delta : delta > 0 ? 0 : days.length - 1
    if (days[next]) onChange(days[next])
  }
  const seg = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors'
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button onClick={() => onChange('all')} aria-pressed={value === 'all'} className={cn(seg, value === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}>
        Vue d’ensemble
      </button>
      {days.length > 0 && (
        <div className={cn('flex h-9 min-w-0 items-center rounded-full border', isDay ? 'border-primary bg-primary/10' : 'bg-card')}>
          <button onClick={() => go(-1)} disabled={isDay && idx === 0} aria-label="Jour précédent" className="flex h-full w-8 shrink-0 items-center justify-center rounded-l-full hover:bg-accent disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="relative flex min-w-0 items-center">
            {color && <span className="pointer-events-none absolute left-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
            <select value={isDay ? value : ''} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Choisir un jour"
              className={cn('h-full min-w-0 cursor-pointer appearance-none truncate bg-transparent py-1 pr-1 text-xs font-semibold outline-none', color ? 'pl-5' : 'pl-1', isDay ? 'text-primary' : 'text-muted-foreground')}>
              {!isDay && <option value="">Choisir un jour…</option>}
              {days.map((d, i) => <option key={d} value={d}>J{i + 1} · {fmtDay(d)}</option>)}
            </select>
          </span>
          <button onClick={() => go(1)} disabled={isDay && idx === days.length - 1} aria-label="Jour suivant" className="flex h-full w-8 shrink-0 items-center justify-center rounded-r-full hover:bg-accent disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <button onClick={() => onChange('none')} aria-pressed={value === 'none'} title="Lieux non planifiés" className={cn(seg, value === 'none' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}>
        💡<span className="hidden sm:inline">Non planifiés</span>
      </button>
    </div>
  )
}

function PointMarker({ point: p, icon, openOnAdd }: { point: MapPoint; icon: L.DivIcon; openOnAdd?: boolean }) {
  const color = POINT_KINDS[p.kind].color
  return (
    <Marker position={[p.place.lat, p.place.lng]} icon={icon}
      eventHandlers={openOnAdd ? { add: (e) => setTimeout(() => (e.target as L.Marker).openPopup(), 700) } : undefined}>
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

function RoutePanel(props: {
  day: string; dayNumber: number; color: string; stops: Stop[]; legs: { km: number; minutes: number }[]; mode: Mode; setMode: (m: Mode) => void
  totalKm: number; totalMin: number; loading: boolean; approx: boolean; open: boolean; onToggle: () => void; desktop: boolean; onStop: (s: Stop) => void
}) {
  const { stops, legs, mode } = props
  const modeLabel = MODES.find((m) => m.key === mode)!.label.toLowerCase()
  return (
    <aside className={cn('z-[500] flex flex-col bg-background', props.desktop ? 'w-80 shrink-0 border-l' : 'absolute inset-x-0 bottom-0 max-h-[45%] rounded-t-3xl border-t shadow-2xl')}>
      <button onClick={props.onToggle} className="flex items-center gap-3 p-3 text-left" aria-expanded={props.open} disabled={props.desktop}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: props.color }}>J{props.dayNumber}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold first-letter:uppercase">Itinéraire du {fmtDay(props.day)}</span>
          <span className="block text-xs text-muted-foreground">
            {props.loading ? 'Calcul…' : `${fmtKm(props.totalKm)} · ${fmtMin(props.totalMin)} ${mode === 'straight' ? 'à pied (estimé)' : modeLabel}`}
            {props.approx && !props.loading ? ' · estimé' : ''}
          </span>
        </span>
        {props.loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!props.desktop && <ChevronDown className={cn('h-5 w-5 transition-transform', !props.open && 'rotate-180')} />}
      </button>
      {props.open && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Mode de déplacement">
            {MODES.map((m) => (
              <button key={m.key} role="radio" aria-checked={mode === m.key} onClick={() => props.setMode(m.key)} title={m.label}
                className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold', mode === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                <m.icon className="h-4 w-4" />{m.label}
              </button>
            ))}
          </div>
          <ol className="relative">
            {stops.map((s, i) => (
              <li key={s.key}>
                <button onClick={() => props.onStop(s)} className="flex w-full items-start gap-3 rounded-xl p-1.5 text-left hover:bg-accent">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold text-white', s.kind === 'lodging' ? 'rounded-lg' : 'rounded-full')}
                    style={{ backgroundColor: s.kind === 'lodging' ? POINT_KINDS.lodging.color : props.color }}>{s.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.kind === 'lodging' ? (i === 0 ? 'Départ · ' : 'Retour · ') : ''}{s.point.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.point.time ? `${fmtTime(s.point.time)} · ` : ''}{s.point.place.name !== s.point.title ? s.point.place.name : s.point.place.address ?? ''}</span>
                  </span>
                </button>
                {legs[i] && (
                  <p className="ml-[1.35rem] border-l-2 border-dashed py-1 pl-4 text-[11px] font-semibold text-muted-foreground" style={{ borderColor: props.color }}>
                    {fmtKm(legs[i].km)} · {fmtMin(legs[i].minutes)}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-muted-foreground">Itinéraires : OSRM / FOSSGIS (OpenStreetMap). Les durées à vol d’oiseau sont estimées.</p>
        </div>
      )}
    </aside>
  )
}
