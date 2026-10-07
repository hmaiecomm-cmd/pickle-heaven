import { NotOpen } from '@/components/admin/page-bits'

export const metadata = { title: '官網頁面管理' }

export default function SitePagesPage() {
  return (
    <NotOpen
      title="官網頁面管理"
      reason="首頁的區塊、圖片、文案與聯絡資料目前寫在程式設定檔（src/config/site.ts），修改後需要重新部署。後台編輯、草稿、預覽、發布與版本還原尚未建置。"
      needs={['將首頁內容移到資料庫並保存版本', '草稿與預覽（不影響正式頁面）', '發布前顯示影響的場館與頁面', '版本還原與操作紀錄']}
      links={[{ href: '/', label: '查看目前官網' }, { href: '/admin/settings', label: '球館基本資料（地址、電話）' }]}
    />
  )
}
