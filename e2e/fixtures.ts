import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'

const PLACES = [
  { key: 'colis', name: 'Colisée', city: 'Rome', country: 'Italie', c: [12.4922, 41.8902] },
  { key: 'trevi', name: 'Fontaine de Trevi', city: 'Rome', country: 'Italie', c: [12.4833, 41.9009] },
  { key: 'rome', name: 'Rome', city: 'Rome', country: 'Italie', c: [12.4964, 41.9028] },
]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4/+8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64')

/** Simule les services externes pour des tests déterministes et hors ligne */
export async function mockExternal(ctx: BrowserContext) {
  await ctx.route('https://photon.komoot.io/**', (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    const features = PLACES.filter((p) => q.includes(p.key)).map((p, i) => ({
      geometry: { coordinates: p.c },
      properties: { osm_id: 1000 + i, osm_type: 'N', name: p.name, city: p.city, country: p.country },
    }))
    return route.fulfill({ json: { features } })
  })
  await ctx.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com|arcgisonline\.com/, (r) => r.fulfill({ body: PNG, contentType: 'image/png' }))
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] } } }))
  await ctx.route('https://routing.openstreetmap.de/**', (r) => r.fulfill({ status: 503, body: '' }))
  await ctx.route('https://api.frankfurter.app/**', (r) => r.fulfill({ json: { rates: { EUR: 0.9 } } }))
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '' }))
}

export async function login(page: Page, email: string) {
  // nouvelle session indépendante (en mode démo, un nouvel onglet reprend sinon le dernier compte)
  await page.goto('./?demo#/login')
  await page.evaluate(() => {
    sessionStorage.removeItem('vadrouille-demo-user')
    localStorage.removeItem('vadrouille-demo-user')
  })
  await page.goto('about:blank')
  await page.goto('./?demo#/login')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByRole('button', { name: /Entrer/ }).click()
  await expect(page.getByRole('heading', { name: 'Mes voyages' })).toBeVisible()
}

export async function createTrip(page: Page, name: string, start = '2027-06-10', end = '2027-06-14') {
  await page.getByRole('button', { name: /Créer un voyage|Nouveau voyage/ }).first().click()
  await page.getByLabel('Nom du voyage').fill(name)
  await page.getByLabel('Début', { exact: true }).fill(start)
  await page.getByLabel('Fin', { exact: true }).fill(end)
  await page.getByRole('button', { name: 'Créer le voyage' }).click()
  await expect(page.getByRole('heading', { name, level: 1 }).first()).toBeVisible()
}

export async function quickAdd(page: Page, kind: 'Activité' | 'Réservation' | 'Dépense') {
  await page.getByRole('button', { name: 'Ajout rapide' }).click()
  await page.getByRole('button', { name: kind, exact: true }).click()
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await mockExternal(context)
    await use(context)
  },
})
export { expect }
