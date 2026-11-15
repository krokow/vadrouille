import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Rangée défilante horizontale sans barre de défilement visible :
 * fondu sur les bords, flèches sur desktop, molette verticale convertie en défilement horizontal.
 */
export function ScrollRow({ children, className, innerClassName }: { children: React.ReactNode; className?: string; innerClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    Array.from(el.children).forEach((c) => ro.observe(c))
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [update, children])

  const scrollBy = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' })
  const mask = edges.left && edges.right
    ? 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)'
    : edges.left ? 'linear-gradient(to right, transparent, black 40px)'
    : edges.right ? 'linear-gradient(to right, black calc(100% - 40px), transparent)' : undefined

  return (
    <div className={cn('group/row relative min-w-0', className)}>
      <div ref={ref} onScroll={update} className={cn('no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth', innerClassName)} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {children}
      </div>
      {edges.left && (
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Défiler vers la gauche" tabIndex={-1}
          className="absolute left-0 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent sm:flex">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {edges.right && (
        <button type="button" onClick={() => scrollBy(1)} aria-label="Défiler vers la droite" tabIndex={-1}
          className="absolute right-0 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent sm:flex">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
