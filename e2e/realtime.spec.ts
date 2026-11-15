import { test, expect, login, createTrip, quickAdd } from './fixtures'

test('deux comptes voient en direct les modifications de l’autre', async ({ context }) => {
  const alice = await context.newPage()
  await login(alice, 'alice@exemple.fr')
  await createTrip(alice, 'Week-end à Lisbonne')
  const tripUrl = alice.url()

  // lien d'invitation
  await alice.goto(tripUrl + '/members')
  const invite = await alice.getByLabel("Lien d'invitation").inputValue()

  // Bob rejoint (autre onglet = autre session)
  const bob = await context.newPage()
  await login(bob, 'bob@exemple.fr')
  await bob.goto(invite.replace('#', '?demo#'))
  await bob.getByRole('button', { name: 'Rejoindre le voyage' }).click()
  await expect(bob.getByRole('heading', { name: 'Week-end à Lisbonne', level: 1 }).first()).toBeVisible()
  await bob.getByRole('navigation').getByRole('link', { name: 'Planning' }).click()

  // Alice voit Bob arriver dans la liste des participants, sans recharger
  await expect(alice.getByText('Bob', { exact: true })).toBeVisible()

  // Alice ajoute une idée : elle apparaît chez Bob
  await alice.goto(tripUrl + '/planning')
  await quickAdd(alice, 'Activité')
  await alice.getByLabel('Titre').fill('Pastéis de Belém')
  await alice.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(bob.getByRole('link', { name: 'Pastéis de Belém' })).toBeVisible()

  // Bob vote, Alice voit le vote
  await bob.getByRole('button', { name: /Voter/ }).click()
  await expect(alice.getByRole('button', { name: /\(1\)/ })).toBeVisible()
})

test('un non-membre ne voit pas le voyage', async ({ context }) => {
  const alice = await context.newPage()
  await login(alice, 'alice2@exemple.fr')
  await createTrip(alice, 'Secret')
  const url = alice.url()
  const eve = await context.newPage()
  await login(eve, 'eve@exemple.fr')
  await eve.goto(url.replace('#', '?demo#'))
  await expect(eve.getByText('Voyage introuvable')).toBeVisible()
})

test('lien invité : lecture seule sans compte, désactivable', async ({ context }) => {
  const owner = await context.newPage()
  await login(owner, 'orga@exemple.fr')
  await owner.getByRole('button', { name: /voyage d’exemple/ }).click()
  await expect(owner.getByRole('heading', { name: 'Lisbonne entre amis (exemple)', level: 1 }).first()).toBeVisible()
  await owner.goto(owner.url() + '/members')
  await owner.getByRole('switch', { name: 'Activer le lien invité' }).click()
  const url = await owner.getByLabel('Lien invité', { exact: true }).inputValue()

  const guest = await context.newPage()
  await guest.goto('./?demo#/')
  await guest.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('vadrouille-demo-user') })
  await guest.goto('about:blank')
  await guest.goto(url.replace('#', '?demo#'))
  await expect(guest.getByRole('heading', { name: 'Lisbonne entre amis (exemple)' })).toBeVisible()
  await expect(guest.getByText('Balade en tram 28')).toBeVisible()
  await guest.getByRole('tab', { name: /Transports/ }).click()
  await expect(guest.getByText('Vol Paris-Orly → Lisbonne')).toBeVisible()
  await expect(guest.getByText('TP8K2Q')).toHaveCount(0) // pas de numéro de confirmation

  await owner.getByRole('switch', { name: 'Activer le lien invité' }).click()
  await guest.reload()
  await expect(guest.getByText('Lien de partage invalide')).toBeVisible()
})
