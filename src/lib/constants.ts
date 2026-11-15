import type { ActivityCategory, AttentionNotes, BookingStatus, BookingType, BudgetCategory } from './types'

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; emoji: string }> = {
  visit: { label: 'Visite', emoji: '🏛️' },
  nature: { label: 'Nature', emoji: '🌿' },
  food: { label: 'Gastronomie', emoji: '🍽️' },
  culture: { label: 'Culture', emoji: '🎭' },
  sport: { label: 'Sport', emoji: '🚴' },
  nightlife: { label: 'Sortie', emoji: '🍸' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  relax: { label: 'Détente', emoji: '🏖️' },
  other: { label: 'Autre', emoji: '📍' },
}

export const ATTENTION_FIELDS: { key: keyof AttentionNotes; label: string; emoji: string; placeholder: string }[] = [
  { key: 'opening_hours', label: "Horaires d'ouverture", emoji: '🕘', placeholder: '9h–18h, dernière entrée 17h15' },
  { key: 'closed_days', label: 'Jour de fermeture', emoji: '🚫', placeholder: 'Fermé le lundi' },
  { key: 'best_time', label: 'Meilleure heure', emoji: '⭐', placeholder: "Tôt le matin pour éviter la foule" },
  { key: 'dress_code', label: 'Dress code', emoji: '👔', placeholder: 'Épaules couvertes' },
  { key: 'gear', label: 'Matériel à emporter', emoji: '🎒', placeholder: "Maillot, crème solaire, 2 L d'eau" },
  { key: 'accessibility', label: 'Accessibilité', emoji: '♿', placeholder: 'Escaliers, pas de poussette' },
  { key: 'weather', label: 'Météo sensible', emoji: '🌦️', placeholder: 'À éviter s’il pleut' },
  { key: 'other', label: 'Autre point d’attention', emoji: '⚠️', placeholder: '' },
]

export const BUDGET_CATEGORIES: Record<BudgetCategory, { label: string; emoji: string; color: string }> = {
  transport: { label: 'Transport', emoji: '🚆', color: '#1f6f8b' },
  lodging: { label: 'Hébergement', emoji: '🏨', color: '#8e6bbf' },
  food: { label: 'Nourriture', emoji: '🍝', color: '#ef7b62' },
  activities: { label: 'Activités', emoji: '🎟️', color: '#e9b44c' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#d65d8c' },
  other: { label: 'Autre', emoji: '📦', color: '#5b8e7d' },
}

export const BOOKING_TYPES: Record<BookingType, { label: string; emoji: string; color: string; budget: BudgetCategory }> = {
  flight: { label: 'Vol', emoji: '✈️', color: '#1f6f8b', budget: 'transport' },
  train: { label: 'Train', emoji: '🚆', color: '#3c9d9b', budget: 'transport' },
  bus: { label: 'Bus / ferry', emoji: '⛴️', color: '#6b8bd6', budget: 'transport' },
  car: { label: 'Location de voiture', emoji: '🚗', color: '#4f6d7a', budget: 'transport' },
  lodging: { label: 'Hébergement', emoji: '🏨', color: '#8e6bbf', budget: 'lodging' },
  restaurant: { label: 'Restaurant', emoji: '🍽️', color: '#ef7b62', budget: 'food' },
  ticket: { label: 'Activité / billet', emoji: '🎟️', color: '#e9b44c', budget: 'activities' },
  other: { label: 'Autre', emoji: '📌', color: '#5b8e7d', budget: 'other' },
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; variant: 'warning' | 'default' | 'success' | 'outline' }> = {
  to_book: { label: 'À réserver', variant: 'warning' },
  booked: { label: 'Réservé', variant: 'default' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  cancelled: { label: 'Annulé', variant: 'outline' },
}
