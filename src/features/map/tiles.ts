/**
 * Fonds de carte.
 * - CARTO (Voyager, Positron, Dark Matter) : clé gratuite obligatoire depuis septembre 2026
 *   → VITE_CARTO_API_KEY (clé publique destinée au navigateur, cf. carto.com/basemaps/apikey).
 * - Sans clé : OpenStreetMap et Esri (satellite), gratuits et sans clé.
 */
export interface TileStyle {
  label: string
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
  dim?: boolean
}

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const CARTO = `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`
export const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() || ''

const carto = (path: string, label: string): TileStyle => ({
  label,
  url: `https://basemaps.cartocdn.com/${path}/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY)}`,
  attribution: CARTO,
  maxZoom: 20,
})

export const TILE_STYLES: Record<string, TileStyle> = {
  ...(CARTO_KEY
    ? { voyager: carto('rastertiles/voyager', 'Voyager'), light: carto('light_all', 'Clair'), dark: carto('dark_all', 'Sombre') }
    : {}),
  osm: { label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, maxZoom: 19, dim: true },
  topo: { label: 'Relief', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Fond &copy; Esri', maxZoom: 19, dim: true },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
}

export type TileKey = string

export function resolveTile(key: TileKey, darkTheme: boolean): TileStyle {
  if (key !== 'auto' && TILE_STYLES[key]) return TILE_STYLES[key]
  if (CARTO_KEY) return darkTheme ? TILE_STYLES.dark : TILE_STYLES.voyager
  return TILE_STYLES.osm
}

/** Couleurs des trajets par jour (vue « tous les jours ») */
export const DAY_COLORS = ['#ef7b62', '#1f6f8b', '#8e6bbf', '#e9b44c', '#3c9d9b', '#d65d8c', '#5b8e7d', '#6b8bd6', '#c77d3a', '#b55252']
