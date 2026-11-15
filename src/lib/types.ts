// Types métier — reflètent les tables Postgres (supabase/migrations)

export type Role = 'owner' | 'editor' | 'viewer'
export type BookingStatus = 'to_book' | 'booked' | 'confirmed' | 'cancelled'
export type ActivityBookingStatus = 'to_book' | 'booked'
export type BudgetCategory = 'transport' | 'lodging' | 'food' | 'activities' | 'shopping' | 'other'
export type BookingType = 'flight' | 'train' | 'bus' | 'car' | 'lodging' | 'restaurant' | 'ticket' | 'other'
export type ActivityCategory = 'visit' | 'nature' | 'food' | 'culture' | 'sport' | 'nightlife' | 'shopping' | 'relax' | 'other'
export type ParentType = 'activity' | 'booking' | 'expense' | 'journal' | 'album' | 'option'

interface Base {
  id: string
  created_at: string
  updated_at: string
  updated_by?: string | null
}

export interface Profile extends Base {
  display_name: string
  avatar_url: string | null
  color: string
  preferred_currency: string
}

export interface Trip extends Base {
  name: string
  destination: string | null
  lat: number | null
  lng: number | null
  start_date: string | null
  end_date: string | null
  currency: string
  cover_url: string | null
  invite_token: string
  invite_enabled: boolean
  total_budget: number | null
  notes: string | null
  share_token?: string | null
  share_enabled?: boolean
  created_by: string
}

export interface TripMember extends Base {
  trip_id: string
  user_id: string | null
  display_name: string
  color: string
  role: Role
  is_ghost: boolean
}

export interface Place extends Base {
  trip_id: string
  name: string
  address: string | null
  lat: number
  lng: number
  osm_id: string | null
}

export interface AttentionNotes {
  opening_hours?: string
  closed_days?: string
  best_time?: string
  dress_code?: string
  gear?: string
  accessibility?: string
  weather?: string
  other?: string
}

export interface Activity extends Base {
  trip_id: string
  place_id: string | null
  title: string
  description: string | null
  day_date: string | null
  start_time: string | null
  end_time: string | null
  duration_min: number | null
  sort_order: number
  est_cost: number | null
  currency: string | null
  category: ActivityCategory
  needs_booking: boolean
  booking_status: ActivityBookingStatus | null
  booking_deadline: string | null
  attention_notes: AttentionNotes
  linked_booking_id: string | null
  notes: string | null
}

export interface ActivityLink extends Base {
  trip_id: string
  activity_id: string
  label: string | null
  url: string
}

export interface ActivityVote extends Base {
  trip_id: string
  activity_id: string
  member_id: string
}

export interface Attendee extends Base {
  trip_id: string
  member_id: string
  activity_id?: string
  booking_id?: string
}

export interface Booking extends Base {
  trip_id: string
  place_id: string | null
  type: BookingType
  title: string
  start_at: string | null
  end_at: string | null
  confirmation_code: string | null
  price: number | null
  currency: string | null
  status: BookingStatus
  url: string | null
  notes: string | null
  booking_deadline: string | null
}

export interface Attachment extends Base {
  trip_id: string
  parent_type: ParentType
  parent_id: string
  storage_path: string
  file_name: string
  mime: string | null
  size: number | null
}

export interface Expense extends Base {
  trip_id: string
  title: string
  amount: number
  currency: string
  fx_rate: number
  amount_main: number
  date: string
  category: BudgetCategory
  paid_by: string
  split_mode: 'equal' | 'amount' | 'shares' | 'percent'
  booking_id: string | null
  activity_id: string | null
  receipt_path: string | null
}

export interface ExpenseShare extends Base {
  trip_id: string
  expense_id: string
  member_id: string
  share_amount: number
  weight: number | null
}

export interface Settlement extends Base {
  trip_id: string
  from_member: string
  to_member: string
  amount: number
  settled_at: string
}

export interface Budget extends Base {
  trip_id: string
  category: BudgetCategory
  planned_amount: number
}

export interface Comment extends Base {
  trip_id: string
  parent_type: ParentType
  parent_id: string
  author_id: string | null
  body: string
}

export interface ActivityLogEntry {
  id: string
  created_at: string
  trip_id: string
  actor_id: string | null
  action: 'insert' | 'update' | 'delete'
  entity_type: string
  entity_id: string
  payload: { title?: string; [k: string]: unknown }
}

export interface ChecklistItem extends Base {
  trip_id: string
  label: string
  group_name: string
  assigned_to: string | null
  done: boolean
  sort_order: number
  kind?: 'pack' | 'task'
  due_date?: string | null
}

export interface JournalEntry extends Base {
  trip_id: string
  day_date: string | null
  body: string
  author_id: string | null
  photo_path: string | null
}

export type DocumentKind = 'passport' | 'id' | 'insurance' | 'visa' | 'health' | 'license' | 'other'
export interface TripDocument extends Base {
  trip_id: string
  owner_id: string
  title: string
  kind: DocumentKind
  visibility: 'trip' | 'private'
  storage_path: string | null
  file_name: string | null
  mime: string | null
  expires_on: string | null
  notes: string | null
}

export interface TripOption extends Base {
  trip_id: string
  group_name: string
  title: string
  url: string | null
  price: number | null
  currency: string | null
  rating: number | null
  pros: string | null
  cons: string | null
  notes: string | null
  place_id: string | null
  chosen: boolean
  booking_id: string | null
  sort_order: number
}

export interface OptionVote extends Base {
  trip_id: string
  option_id: string
  member_id: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
  updated_at: string
}

export interface TableMap {
  profiles: Profile
  trips: Trip
  trip_members: TripMember
  places: Place
  activities: Activity
  activity_links: ActivityLink
  activity_votes: ActivityVote
  activity_attendees: Attendee
  bookings: Booking
  booking_attendees: Attendee
  attachments: Attachment
  expenses: Expense
  expense_shares: ExpenseShare
  settlements: Settlement
  budgets: Budget
  comments: Comment
  activity_log: ActivityLogEntry
  checklist_items: ChecklistItem
  journal_entries: JournalEntry
  documents: TripDocument
  options: TripOption
  option_votes: OptionVote
  push_subscriptions: PushSubscriptionRow
}
export type TableName = keyof TableMap
/** Tables rattachées à un voyage (colonne trip_id) */
export const TRIP_TABLES = [
  'trip_members', 'places', 'activities', 'activity_links', 'activity_votes', 'activity_attendees',
  'bookings', 'booking_attendees', 'attachments', 'expenses', 'expense_shares', 'settlements',
  'budgets', 'comments', 'activity_log', 'checklist_items', 'journal_entries', 'documents',
  'options', 'option_votes',
] as const satisfies readonly TableName[]
export type TripTable = (typeof TRIP_TABLES)[number]
