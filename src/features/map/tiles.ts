/** Fonds de carte gratuits et sans clé (attributions obligatoires affichées par Leaflet) */
export interface TileStyle {
  label: string
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
  dark?: boolean
}

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const CARTO = `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`

export const TILE_STYLES = {
  voyager: { label: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: CARTO, subdomains: 'abcd', maxZoom: 20 },
  light: { label: 'Clair', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: CARTO, subdomains: 'abcd', maxZoom: 20 },
  dark: { label: 'Sombre', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: CARTO, subdomains: 'abcd', maxZoom: 20, dark: true },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19, dark: true },
  osm: { label: 'OSM classique', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, maxZoom: 19 },
} satisfies Record<string, TileStyle>

export type TileKey = keyof typeof TILE_STYLES | 'auto'

export function resolveTile(key: TileKey, darkTheme: boolean): TileStyle {
  if (key === 'auto') return darkTheme ? TILE_STYLES.dark : TILE_STYLES.voyager
  return TILE_STYLES[key]
}

/** Couleurs des trajets par jour (vue « tous les jours ») */
export const DAY_COLORS = ['#ef7b62', '#1f6f8b', '#8e6bbf', '#e9b44c', '#3c9d9b', '#d65d8c', '#5b8e7d', '#6b8bd6', '#c77d3a', '#b55252']
