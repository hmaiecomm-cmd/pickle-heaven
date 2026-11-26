export function calculateDateRange(days: number) {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

export function calculatePrevRange(from: Date, to: Date) {
  const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  prevTo.setHours(23, 59, 59, 999)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days)
  prevFrom.setHours(0, 0, 0, 0)
  return { from: prevFrom, to: prevTo }
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
