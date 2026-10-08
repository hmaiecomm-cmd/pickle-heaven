import { redirect } from 'next/navigation'

/** 舊「收據」頁已併入「費用與收據」（拍照登錄／上傳收據／手動登錄） */
export default function ReceiptsRedirect() {
  redirect('/admin/expenses')
}
