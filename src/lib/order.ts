/** Calcule un sort_order entre deux voisins (évite de renuméroter toute la liste) */
export function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1000
  if (before === undefined) return after! - 1000
  if (after === undefined) return before + 1000
  return (before + after) / 2
}
