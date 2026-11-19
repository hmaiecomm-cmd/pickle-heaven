'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface TopUpPlan {
  id: string
  price: number
  points: number
  name: string
  note?: string
  active: boolean
}

export function MembershipPlansTab() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<TopUpPlan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<TopUpPlan>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [vipEnabled, setVipEnabled] = useState(false)
  const [vipThreshold, setVipThreshold] = useState(10000)

  useEffect(() => {
    const stored = localStorage.getItem('topupPlans')
    if (stored) setPlans(JSON.parse(stored))
    const vipStored = localStorage.getItem('vipConfig')
    if (vipStored) {
      const cfg = JSON.parse(vipStored)
      setVipEnabled(cfg.enabled)
      setVipThreshold(cfg.threshold)
    }
  }, [])

  const validatePlanForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.name) errors.name = '必須填寫方案名稱'
    if (!formData.price || formData.price <= 0) errors.price = '支付金額必須 > 0'
    if (!formData.points || formData.points <= 0) errors.points = '購買點數必須 > 0'
    if (!Number.isInteger(formData.price)) errors.price = '支付金額必須為整數'
    if (!Number.isInteger(formData.points)) errors.points = '購買點數必須為整數'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePlan = () => {
    if (!validatePlanForm()) return
    if (editingId) {
      setPlans((p) => p.map((pl) => (pl.id === editingId ? { ...pl, ...formData } as TopUpPlan : pl)))
      toast('已更新儲值方案', 'success')
    } else {
      const newPlan: TopUpPlan = {
        id: Date.now().toString(),
        active: true,
        ...formData,
      } as TopUpPlan
      setPlans((p) => [newPlan, ...p])
      toast('已新增儲值方案', 'success')
    }
    localStorage.setItem('topupPlans', JSON.stringify(plans))
    resetForm()
  }

  const handleEditPlan = (plan: TopUpPlan) => {
    setFormData(plan)
    setEditingId(plan.id)
    setShowForm(true)
  }

  const handleDeletePlan = (id: string) => {
    if (plans.length <= 1) {
      toast('至少保留一個儲值方案', 'info')
      return
    }
    setPlans((p) => p.filter((pl) => pl.id !== id))
    toast('已刪除儲值方案', 'success')
  }

  const handleTogglePlanActive = (id: string) => {
    setPlans((p) => p.map((pl) => (pl.id === id ? { ...pl, active: !pl.active } : pl)))
  }

  const resetForm = () => {
    setFormData({})
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  const handleSaveVipConfig = () => {
    localStorage.setItem('vipConfig', JSON.stringify({ enabled: vipEnabled, threshold: vipThreshold }))
    toast('VIP 設定已保存', 'success')
  }

  return (
    <div className="space-y-6">
      {/* 儲值方案管理 */}
      <div className="rounded-lg border border-[rgb(var(--border))]">
        <div className="border-b border-[rgb(var(--border))] px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">儲值方案管理</h3>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                新增方案
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="border-b border-[rgb(var(--border))] p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">方案名稱</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                placeholder="例：1000 元方案"
                className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2"
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">支付金額</label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => setFormData((d) => ({ ...d, price: Number(e.target.value) }))}
                  placeholder="1000"
                  className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2"
                />
                {formErrors.price && <p className="text-xs text-red-500 mt-1">{formErrors.price}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">購買點數</label>
                <input
                  type="number"
                  value={formData.points || ''}
                  onChange={(e) => setFormData((d) => ({ ...d, points: Number(e.target.value) }))}
                  placeholder="1000"
                  className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2"
                />
                {formErrors.points && <p className="text-xs text-red-500 mt-1">{formErrors.points}</p>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">備註</label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => setFormData((d) => ({ ...d, note: e.target.value }))}
                placeholder="選填"
                className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[rgb(var(--border))]">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                取消
              </Button>
              <Button size="sm" onClick={handleSavePlan}>
                儲存
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-[rgb(var(--border))]">
          {plans.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">尚未設定儲值方案</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="px-4 py-3 hover:bg-[rgb(var(--bg-hover))]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{plan.name}</p>
                    <p className="text-xs text-muted">支付 NT${plan.price} = 購買 {plan.points} 點數</p>
                    {plan.note && <p className="text-xs text-muted mt-1">{plan.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plan.active}
                        onChange={() => handleTogglePlanActive(plan.id)}
                        className="rounded"
                      />
                      上架
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditPlan(plan)}
                    >
                      編輯
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* VIP 自動升級設定 */}
      <div className="rounded-lg border border-[rgb(var(--border))] p-4">
        <h3 className="font-semibold">VIP 自動升級設定</h3>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={vipEnabled}
              onChange={(e) => setVipEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">啟用 VIP 自動升級</span>
          </label>

          {vipEnabled && (
            <div>
              <label className="text-sm font-medium">累計消費金額達到 VIP 標準</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm">NT$</span>
                <input
                  type="number"
                  value={vipThreshold}
                  onChange={(e) => setVipThreshold(Number(e.target.value))}
                  className="w-32 rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted">即可升級為 VIP 會員</span>
              </div>
            </div>
          )}

          <Button size="sm" onClick={handleSaveVipConfig}>
            保存設定
          </Button>
        </div>
      </div>
    </div>
  )
}
