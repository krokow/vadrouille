import { defineConfig, devices } from '@playwright/test'

/**
 * Parcours e2e en « mode démo » (sans Supabase) : les données sont dans le navigateur.
 * Les API externes (géocodage, tuiles, météo, taux) sont simulées dans e2e/fixtures.ts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/vadrouille/',
    trace: 'off',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173/vadrouille/',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
