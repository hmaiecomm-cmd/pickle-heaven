import { redirect } from 'next/navigation'

/** 「我的預約」已整合進「我的帳戶」；舊連結導向帳戶頁的預約分頁 */
export default function BookingsPage() {
  redirect('/account?tab=bookings')
}
