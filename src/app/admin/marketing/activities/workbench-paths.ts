import type { EditorPaths } from '@/app/admin/activities/activity-editor'

/** 行銷入口的活動編輯器：返回與儲存後都留在「活動與行銷設計」 */
export const MARKETING_ACTIVITY_PATHS: EditorPaths = {
  list: '/admin/marketing#activities',
  edit: '/admin/marketing/activities/:id',
  occupancy: '/admin/maintenance?tab=activity&activity=:id',
}
