import { useMemo } from 'react'
import { useTripTable } from '@/lib/data'
import { useTrip } from '@/features/trips/TripContext'
import { indexBy } from '@/lib/utils'
import type { TripMember } from '@/lib/types'

/** Activités + données associées, indexées pour l'affichage */
export function useActivityData() {
  const { trip, memberById, me, writer } = useTrip()
  const activities = useTripTable(trip.id, 'activities')
  const places = useTripTable(trip.id, 'places')
  const attendees = useTripTable(trip.id, 'activity_attendees')
  const votes = useTripTable(trip.id, 'activity_votes')
  const comments = useTripTable(trip.id, 'comments')

  return useMemo(() => {
    const placeById = indexBy(places.data)
    const attendeesOf: Record<string, TripMember[]> = {}
    for (const a of attendees.data ?? []) {
      const m = memberById[a.member_id]
      if (m && a.activity_id) (attendeesOf[a.activity_id] ??= []).push(m)
    }
    const votesOf: Record<string, { count: number; mine?: string }> = {}
    for (const v of votes.data ?? []) {
      const e = (votesOf[v.activity_id] ??= { count: 0 })
      e.count++
      if (v.member_id === me?.id) e.mine = v.id
    }
    const commentsOf: Record<string, number> = {}
    for (const c of comments.data ?? []) if (c.parent_type === 'activity') commentsOf[c.parent_id] = (commentsOf[c.parent_id] ?? 0) + 1
    const toggleVote = async (activityId: string) => {
      if (!me) return
      const mine = votesOf[activityId]?.mine
      if (mine) await writer.remove('activity_votes', mine)
      else await writer.insert('activity_votes', { trip_id: me.trip_id, activity_id: activityId, member_id: me.id })
    }
    return {
      activities: activities.data ?? [],
      loading: activities.isLoading,
      placeById, attendeesOf, votesOf, commentsOf, toggleVote,
    }
  }, [activities.data, activities.isLoading, places.data, attendees.data, votes.data, comments.data, memberById, me, writer])
}
