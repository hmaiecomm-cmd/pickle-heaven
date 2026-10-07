import { NotOpen } from '@/components/admin/page-bits'

export const metadata = { title: '行銷活動與通知' }

export default function CampaignsPage() {
  return (
    <NotOpen
      title="行銷活動與通知"
      reason="群發通知需要已啟用的 LINE 官方帳號推播或簡訊服務，並需要會員同意接收行銷訊息的紀錄；目前尚未建置，因此不提供可送出的群發功能。"
      needs={['LINE Messaging API 推播額度與官方帳號設定', '會員行銷同意與退訂紀錄', '發送前預覽、對象篩選與發送結果追蹤']}
      links={[{ href: '/admin/marketing/vouchers', label: '優惠與票券方案' }]}
    />
  )
}
