import { redirect } from 'next/navigation'

/** 舊網址：AI 智慧球場已併入「無人化控制」 */
export default function AiCourtsRedirect() {
  redirect('/admin/control')
}
