import { useFileUrl, resolvedUrl } from '@/lib/files'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  ['#1f6f8b', '#99d5c9'], ['#ef7b62', '#f6d186'], ['#3c6e71', '#d9d9d9'], ['#6b8bd6', '#f2c4ce'],
  ['#5b8e7d', '#f4e285'], ['#8e6bbf', '#f7a072'], ['#264653', '#e9c46a'], ['#c77d3a', '#fdf0d5'],
]

/** Image de couverture : upload ou dégradé « carte postale » par défaut */
export function TripCover({ trip, className, children }: { trip: { id: string; name: string; cover_url: string | null; destination?: string | null }; className?: string; children?: React.ReactNode }) {
  const signed = useFileUrl(trip.cover_url)
  const url = resolvedUrl(trip.cover_url, signed.data)
  let h = 0
  for (const c of trip.id) h = (h * 33 + c.charCodeAt(0)) >>> 0
  const [a, b] = GRADIENTS[h % GRADIENTS.length]
  return (
    <div
      className={cn('relative overflow-hidden bg-muted', className)}
      style={url ? undefined : { background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <path d="M0 150 Q 60 110 120 140 T 240 130 T 400 120 V200 H0Z" fill="white" />
          <path d="M0 170 Q 80 140 160 165 T 320 155 T 400 160 V200 H0Z" fill="white" opacity=".6" />
          <circle cx="330" cy="55" r="26" fill="white" />
          <path d="M40 60 l10 -6 l10 6 M70 45 l8 -5 l8 5" stroke="white" strokeWidth="3" fill="none" />
        </svg>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {children && <div className="relative h-full">{children}</div>}
    </div>
  )
}
