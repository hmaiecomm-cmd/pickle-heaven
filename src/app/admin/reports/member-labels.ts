import { MemberLabel, MemberIdentity, MemberPreference, MemberStatus } from './member-operations-types'

export interface MemberHistory {
  userId: string
  totalReservations: number
  totalCancellations: number
  totalNoShows: number
  lastActive: Date | null
  cardExpiryDate: Date | null
  cardBalance: number
  timeSlotPreferences: { morning: number; evening: number; weekday: number; weekend: number }
  referralCount: number
  averageGroupSize: number
}

export function determineMemberIdentity(history: MemberHistory): MemberIdentity | undefined {
  // If user refers many others, they're an organizer
  if (history.referralCount > 5) {
    return 'organizer'
  }

  // If they have active card with balance and regular bookings
  if (history.cardBalance > 0 && history.totalReservations > 20) {
    return 'monthly'
  }

  // If they have prepaid card but lower booking frequency
  if (history.cardBalance > 0) {
    return 'prepaid'
  }

  // If regular bookings without card
  if (history.totalReservations > 10 && !history.cardExpiryDate) {
    return 'regular'
  }

  // If occasional bookings
  if (history.totalReservations > 2) {
    return 'casual'
  }

  // Default to casual or trial
  return history.totalReservations === 1 ? 'trial' : 'casual'
}

export function determineMemberPreferences(history: MemberHistory): MemberPreference[] {
  const prefs: MemberPreference[] = []
  const { morning, evening, weekday, weekend } = history.timeSlotPreferences

  if (weekday > 0 && morning > weekday * 0.4) prefs.push('weekday-morning')
  if (weekday > 0 && evening > weekday * 0.4) prefs.push('weekday-evening')
  if (weekend > 0 && morning > weekend * 0.4) prefs.push('weekend-morning')
  if (weekend > 0 && evening > weekend * 0.4) prefs.push('weekend-evening')

  return prefs.length > 0 ? prefs : ['weekday-evening']
}

export function determineMemberStatus(history: MemberHistory): MemberStatus[] {
  const statuses: MemberStatus[] = []

  // Check card expiring
  if (history.cardExpiryDate) {
    const daysUntilExpiry = Math.ceil(
      (history.cardExpiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 14) {
      statuses.push('card-expiring')
    }
  }

  // Check low balance
  if (history.cardBalance > 0 && history.cardBalance < 500) {
    statuses.push('low-balance')
  }

  // Check dormant (no activity in 30 days)
  if (history.lastActive) {
    const daysSinceActive = Math.ceil(
      (new Date().getTime() - history.lastActive.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceActive > 30) {
      statuses.push('dormant')
    }
  }

  // Check high cancellation rate
  if (history.totalReservations > 0) {
    const cancelRate = history.totalCancellations / history.totalReservations
    if (cancelRate > 0.3) {
      statuses.push('high-cancel')
    }
  }

  // Check high no-show rate
  if (history.totalReservations > 0) {
    const noShowRate = history.totalNoShows / history.totalReservations
    if (noShowRate > 0.2) {
      statuses.push('high-noshow')
    }
  }

  return statuses
}

export function labelMember(history: MemberHistory): MemberLabel {
  return {
    identity: determineMemberIdentity(history),
    preferences: determineMemberPreferences(history),
    status: determineMemberStatus(history),
  }
}

export const assignMemberLabel = labelMember
