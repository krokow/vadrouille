/** Modèles de la page Préparatifs */

/** Tâches d'avant départ ; `before` = nombre de jours avant le départ pour l'échéance */
export const TASK_TEMPLATES: Record<string, { emoji: string; tasks: { label: string; before: number }[] }> = {
  Essentiels: { emoji: '✅', tasks: [
    { label: 'Vérifier la validité des passeports / cartes d’identité', before: 45 },
    { label: 'Souscrire une assurance voyage', before: 30 },
    { label: 'Vérifier les formalités (visa, ESTA, vaccins)', before: 30 },
    { label: 'Prévenir la banque / activer les paiements à l’étranger', before: 7 },
    { label: 'Télécharger les cartes hors ligne', before: 3 },
    { label: 'Faire l’enregistrement en ligne du vol', before: 1 },
    { label: 'Charger téléphone, batterie et appareil photo', before: 1 },
  ] },
  Maison: { emoji: '🏠', tasks: [
    { label: 'Faire garder les animaux', before: 14 },
    { label: 'Organiser l’arrosage des plantes / le relevé du courrier', before: 7 },
    { label: 'Vider le frigo, sortir les poubelles', before: 1 },
    { label: 'Couper l’eau / baisser le chauffage', before: 0 },
  ] },
  'À l’étranger': { emoji: '🌍', tasks: [
    { label: 'Retirer ou changer des devises', before: 5 },
    { label: 'Acheter une eSIM / vérifier le forfait', before: 5 },
    { label: 'Enregistrer l’ambassade et les numéros d’urgence', before: 3 },
  ] },
}

/** Affaires à emporter */
export const PACK_TEMPLATES: Record<string, { emoji: string; groups: Record<string, string[]> }> = {
  Essentiels: { emoji: '🎒', groups: {
    Papiers: ['Passeport / carte d’identité', 'Carte bancaire', 'Assurance voyage', 'Billets et réservations', 'Permis de conduire'],
    Électronique: ['Téléphone + chargeur', 'Batterie externe', 'Adaptateur de prise', 'Écouteurs'],
    Trousse: ['Brosse à dents + dentifrice', 'Médicaments', 'Crème solaire', 'Lunettes / lentilles'],
    Vêtements: ['Sous-vêtements', 'Chaussettes', 'Pyjama', 'Veste de pluie'],
  } },
  Plage: { emoji: '🏖️', groups: { Plage: ['Maillots de bain', 'Serviettes de plage', 'Lunettes de soleil', 'Chapeau', 'Tongs', 'Après-soleil', 'Masque et tuba'] } },
  Montagne: { emoji: '🏔️', groups: { Montagne: ['Chaussures de rando', 'Polaire', 'Gourde', 'Frontale', 'Bâtons', 'Trousse de secours', 'Couverture de survie'] } },
  Ville: { emoji: '🏙️', groups: { Ville: ['Chaussures confortables', 'Petit sac à dos', 'Parapluie', 'Tenue pour sortir'] } },
  'Avec bébé': { emoji: '👶', groups: { Bébé: ['Couches', 'Lingettes', 'Biberons', 'Doudou', 'Poussette / porte-bébé', 'Thermomètre', 'Lit parapluie'] } },
}
