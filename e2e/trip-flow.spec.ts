import { test, expect, login, createTrip, quickAdd } from './fixtures'

test('créer un voyage, ajouter une activité à réserver puis une dépense', async ({ page }) => {
  await login(page, 'alice@exemple.fr')
  await createTrip(page, 'Rome en famille')

  // activité « à réserver » avec date limite et lieu
  await quickAdd(page, 'Activité')
  await page.getByLabel('Titre').fill('Visite du Colisée')
  await page.getByLabel('Jour').selectOption({ index: 2 })
  await page.getByLabel('Lieu').fill('colisée')
  await page.getByRole('listbox').getByRole('option').first().click()
  await page.getByRole('switch', { name: 'À réserver' }).click()
  await page.getByLabel('Réserver avant le').fill('2027-05-01')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

  // elle remonte sur le tableau de bord et dans l'onglet À réserver
  await expect(page.getByRole('main').getByText('Visite du Colisée').first()).toBeVisible()
  await page.goto(page.url().replace(/#\/t\/([^/]+).*/, '#/t/$1/todo'))
  await expect(page.getByRole('heading', { name: 'À réserver' })).toBeVisible()
  await expect(page.getByText('Visite du Colisée')).toBeVisible()

  // planning
  await page.getByRole('navigation').getByRole('link', { name: 'Planning' }).click()
  await expect(page.getByRole('link', { name: 'Visite du Colisée' })).toBeVisible()

  // dépense
  await quickAdd(page, 'Dépense')
  await page.getByLabel('Titre').fill('Pizzas')
  await page.getByLabel('Montant', { exact: true }).fill('42,50')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Budget' }).click()
  await expect(page.getByText('Pizzas')).toBeVisible()
  await expect(page.getByText('42,50 €').first()).toBeVisible()

  // carte : le lieu de l'activité est affiché
  await page.getByRole('navigation').getByRole('link', { name: 'Carte' }).click()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
})

test('le rechargement d’une page profonde fonctionne (routing hash)', async ({ page }) => {
  await login(page, 'reload@exemple.fr')
  await createTrip(page, 'Reload')
  await page.getByRole('navigation').getByRole('link', { name: 'Budget' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible()
})

test('pas de défilement horizontal à 375 px', async ({ page }) => {
  await login(page, 'mobile@exemple.fr')
  await createTrip(page, 'Mobile')
  for (const tab of ['Accueil', 'Planning', 'Réservations', 'Budget']) {
    await page.getByRole('navigation').getByRole('link', { name: tab }).click()
    await page.waitForTimeout(200)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `onglet ${tab}`).toBeLessThanOrEqual(0)
  }
})
