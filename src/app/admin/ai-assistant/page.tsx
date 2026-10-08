import { redirect } from 'next/navigation'

/** 舊的全頁對話已併入主入口「詢問小P」：導回後台並開啟同一套對話面板（紀錄共用） */
export default function AiAssistantRedirect() {
  redirect('/admin?ai=1')
}
