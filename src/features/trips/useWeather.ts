import { useQuery } from '@tanstack/react-query'
import { forecast } from '@/lib/weather'
import type { Trip } from '@/lib/types'

/** Météo de la destination, rafraîchie toutes les 30 min (conditions actuelles) */
export function useWeather(trip: Pick<Trip, 'lat' | 'lng'>, enabled = true) {
  return useQuery({
    queryKey: ['weather-v2', trip.lat?.toFixed(2), trip.lng?.toFixed(2)],
    queryFn: () => forecast(trip.lat!, trip.lng!),
    enabled: enabled && trip.lat != null && trip.lng != null,
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  })
}
