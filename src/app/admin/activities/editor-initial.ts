import { addDays, taipeiDateString } from '@/lib/time'
import type { ActivityTypeKey, PriceUnitKey } from '@/lib/activity-shared'
import type { getActivityAdmin } from '@/server/activity-admin'
import type { EditorForm } from './activity-editor'

type VenueGrid = { openMinute: number; closeMinute: number; slotMinutes: number }

/** 新增活動的預設值：一週後、晚上七點起兩個時段，場地不預設（必須明確選擇） */
export function newEditorForm(venue: VenueGrid, weekly: boolean): EditorForm {
  const start = addDays(taipeiDateString(), 7)
  const startMinute = Math.min(Math.max(venue.openMinute, 19 * 60), venue.closeMinute - 2 * venue.slotMinutes)
  return {
    title: '',
    type: 'OPEN_PLAY',
    customTypeLabel: '',
    summary: '',
    description: '',
    levelLabel: '',
    requirements: '',
    includes: '',
    refundNote: '',
    coverAssetId: null,
    coverFocusX: 50,
    coverFocusY: 50,
    hostId: null,
    visibility: 'PUBLIC',
    locationNote: '',
    price: 0,
    priceUnit: 'PER_PERSON',
    capacity: 8,
    reservedCapacity: 0,
    maxPerOrder: 4,
    repeatKind: weekly ? 'WEEKLY' : 'ONCE',
    weekdays: weekly ? [new Date(`${start}T00:00:00+08:00`).getUTCDay()] : [],
    intervalWeeks: 1,
    startMinute,
    endMinute: startMinute + 2 * venue.slotMinutes,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    seriesStartDate: start,
    endMode: 'COUNT',
    seriesEndDate: addDays(start, 56),
    occurrenceCount: 8,
    skipDates: [],
    courtIds: [],
    openDaysBefore: 7,
    openMinute: null,
    closeMinutesBefore: 60,
  }
}

type AdminActivity = NonNullable<Awaited<ReturnType<typeof getActivityAdmin>>>['activity']

export function editorFormFromActivity(a: AdminActivity): EditorForm {
  return {
    title: a.title,
    type: a.type as ActivityTypeKey,
    customTypeLabel: a.customTypeLabel ?? '',
    summary: a.summary ?? '',
    description: a.description ?? '',
    levelLabel: a.levelLabel ?? '',
    requirements: a.requirements ?? '',
    includes: a.includes ?? '',
    refundNote: a.refundNote ?? '',
    coverAssetId: a.coverAssetId,
    coverFocusX: a.coverFocusX,
    coverFocusY: a.coverFocusY,
    hostId: a.hostId,
    visibility: (a.visibility as 'PUBLIC' | 'UNLISTED' | 'PRIVATE') ?? 'PUBLIC',
    locationNote: a.locationNote ?? '',
    price: a.price,
    priceUnit: a.priceUnit as PriceUnitKey,
    capacity: a.capacity,
    reservedCapacity: a.reservedCapacity,
    maxPerOrder: a.maxPerOrder,
    repeatKind: a.repeatKind as 'ONCE' | 'WEEKLY',
    weekdays: a.weekdays,
    intervalWeeks: a.intervalWeeks,
    startMinute: a.startMinute,
    endMinute: a.endMinute,
    bufferBeforeMinutes: a.bufferBeforeMinutes,
    bufferAfterMinutes: a.bufferAfterMinutes,
    seriesStartDate: a.seriesStartDate,
    endMode: a.occurrenceCount && !a.seriesEndDate ? 'COUNT' : 'DATE',
    seriesEndDate: a.seriesEndDate ?? a.seriesStartDate,
    occurrenceCount: a.occurrenceCount ?? 8,
    skipDates: a.skipDates,
    courtIds: a.courtIds,
    openDaysBefore: a.openDaysBefore,
    openMinute: a.openMinute,
    closeMinutesBefore: a.closeMinutesBefore,
  }
}
