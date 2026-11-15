/** Météo via Open-Meteo (gratuit, sans clé) — conditions actuelles + 16 jours de prévisions */
export interface DayForecast {
  date: string
  code: number
  tmax: number
  tmin: number
  rain: number
}

export interface CurrentWeather {
  /** heure locale à destination, ex. "2026-11-15T14:30" */
  time: string
  temp: number
  feels: number
  code: number
  wind: number
  humidity: number
  isDay: boolean
}

export interface Forecast {
  current: CurrentWeather
  days: DayForecast[]
  /** date du jour à destination (yyyy-MM-dd) */
  localToday: string
  timezone: string
}

export async function forecast(lat: number, lng: number): Promise<Forecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(3))
  url.searchParams.set('longitude', lng.toFixed(3))
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '16')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo indisponible')
  const j = await res.json()
  const c = j.current ?? {}
  const current: CurrentWeather = {
    time: c.time ?? '',
    temp: Math.round(c.temperature_2m ?? NaN),
    feels: Math.round(c.apparent_temperature ?? NaN),
    code: c.weather_code ?? 0,
    wind: Math.round(c.wind_speed_10m ?? 0),
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    isDay: c.is_day !== 0,
  }
  const days: DayForecast[] = ((j.daily?.time ?? []) as string[]).map((date, i) => ({
    date,
    code: j.daily.weather_code[i],
    tmax: Math.round(j.daily.temperature_2m_max[i]),
    tmin: Math.round(j.daily.temperature_2m_min[i]),
    rain: j.daily.precipitation_probability_max[i] ?? 0,
  }))
  return { current, days, localToday: (current.time || days[0]?.date || '').slice(0, 10), timezone: j.timezone ?? '' }
}

/** Jours de prévision à partir d'aujourd'hui (heure locale de la destination) */
export function upcomingDays(f: Forecast | undefined): DayForecast[] {
  if (!f) return []
  return f.days.filter((d) => d.date >= f.localToday)
}

/** « Aujourd'hui », « Demain », sinon null */
export function relativeDayLabel(date: string, localToday: string): string | null {
  if (date === localToday) return "Aujourd'hui"
  const t = new Date(`${localToday}T12:00:00`)
  t.setDate(t.getDate() + 1)
  if (date === t.toISOString().slice(0, 10)) return 'Demain'
  return null
}

/** Codes WMO → emoji + libellé */
export function weatherIcon(code: number, isDay = true): { icon: string; label: string } {
  if (code === 0) return { icon: isDay ? '☀️' : '🌙', label: 'Ciel dégagé' }
  if (code <= 2) return { icon: isDay ? '🌤️' : '☁️', label: 'Éclaircies' }
  if (code === 3) return { icon: '☁️', label: 'Couvert' }
  if (code <= 48) return { icon: '🌫️', label: 'Brouillard' }
  if (code <= 57) return { icon: '🌦️', label: 'Bruine' }
  if (code <= 67) return { icon: '🌧️', label: 'Pluie' }
  if (code <= 77) return { icon: '❄️', label: 'Neige' }
  if (code <= 82) return { icon: '🌧️', label: 'Averses' }
  if (code <= 86) return { icon: '🌨️', label: 'Averses de neige' }
  return { icon: '⛈️', label: 'Orage' }
}
