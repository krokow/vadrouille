/** Météo prévue via Open-Meteo (gratuit, sans clé) — 16 jours maximum */
export interface DayForecast {
  date: string
  code: number
  tmax: number
  tmin: number
  rain: number
}

export async function forecast(lat: number, lng: number): Promise<DayForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(3))
  url.searchParams.set('longitude', lng.toFixed(3))
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '16')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo indisponible')
  const j = await res.json()
  return (j.daily.time as string[]).map((date, i) => ({
    date,
    code: j.daily.weather_code[i],
    tmax: Math.round(j.daily.temperature_2m_max[i]),
    tmin: Math.round(j.daily.temperature_2m_min[i]),
    rain: j.daily.precipitation_probability_max[i] ?? 0,
  }))
}

/** Codes WMO → emoji + libellé */
export function weatherIcon(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Ensoleillé' }
  if (code <= 2) return { icon: '🌤️', label: 'Éclaircies' }
  if (code === 3) return { icon: '☁️', label: 'Couvert' }
  if (code <= 48) return { icon: '🌫️', label: 'Brouillard' }
  if (code <= 57) return { icon: '🌦️', label: 'Bruine' }
  if (code <= 67) return { icon: '🌧️', label: 'Pluie' }
  if (code <= 77) return { icon: '❄️', label: 'Neige' }
  if (code <= 82) return { icon: '🌧️', label: 'Averses' }
  if (code <= 86) return { icon: '🌨️', label: 'Averses de neige' }
  return { icon: '⛈️', label: 'Orage' }
}
