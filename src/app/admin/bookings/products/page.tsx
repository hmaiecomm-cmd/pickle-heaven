import { NotOpen } from '@/components/admin/page-bits'

export const metadata = { title: '商品訂單' }

export default function ProductOrdersPage() {
  return (
    <NotOpen
      title="商品訂單"
      reason="系統目前沒有商城：沒有商品、庫存、購物與出貨資料，因此沒有商品訂單可以顯示。"
      needs={['建立商品與庫存資料', '前台商品購買與付款流程', '出貨或現場取貨狀態']}
      links={[{ href: '/admin/bookings', label: '訂場與活動訂單' }]}
    />
  )
}
