import { NotOpen } from '@/components/admin/page-bits'

export const metadata = { title: '商品與庫存' }

export default function ProductsPage() {
  return (
    <NotOpen
      title="商品與庫存"
      reason="商城尚未建立，系統沒有商品與庫存資料。"
      needs={['商品資料（名稱、價格、圖片、規格）', '庫存數量與調整紀錄', '前台購買與付款流程']}
    />
  )
}
