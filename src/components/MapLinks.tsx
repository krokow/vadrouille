import { Navigation } from 'lucide-react'
import { mapsLinks } from '@/lib/geocode'
import { Button } from './ui/button'

export function MapLinks({ lat, lng, name, size = 'sm' }: { lat: number; lng: number; name?: string; size?: 'sm' | 'default' }) {
  const l = mapsLinks(lat, lng, name)
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size={size}><a href={l.google} target="_blank" rel="noreferrer"><Navigation /> Google Maps</a></Button>
      <Button asChild variant="outline" size={size}><a href={l.apple} target="_blank" rel="noreferrer"><Navigation /> Apple Plans</a></Button>
    </div>
  )
}
