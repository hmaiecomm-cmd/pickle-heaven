'use client'

import { useState } from 'react'
import { Plus, ChevronRight, ChevronLeft, AlertCircle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'

interface SeasonPassPlan {
  id: string
  name: string
  price: number
  description: string
  active: boolean
  startDate: string
  endDate: string
  sessions: number
  sessionMinutes: number
  applicableWeekdays: string[]
  timeStart: string
  timeEnd: string
  courts: string[]
  allowCrossSession: boolean
  transferable: boolean
  cancellationPolicy: string
  status: 'DRAFT' | 'ACTIVE' | 'ENDED' | 'DISABLED'
  createdAt: Date
}

type WizardStep = 1 | 2 | 3

export function SeasonPassTab() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<SeasonPassPlan[]>([])
  const [showWizard, setShowWizard] = useState(false)
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<SeasonPassPlan>>({
    applicableWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  })
  const [saving, setSaving] = useState(false)

  const validateStep = (step: WizardStep): string | null => {
    switch (step) {
      case 1:
        if (!formData.name) return '方案名稱必填'
        if (!formData.price || formData.price < 0) return '方案價格必填且需大於 0'
        if (!Number.isInteger(formData.price)) return '方案價格必須為整數'
        return null
      case 2:
        if (!formData.startDate) return '開始日期必填'
        if (!formData.endDate) return '結束日期必填'
        if (new Date(formData.endDate) < new Date(formData.startDate)) return '結束日期不可早於開始日期'
        return null
      case 3:
        if (!formData.sessions || formData.sessions <= 0) return '可使用堂數必填且需大於 0'
        if (!formData.sessionMinutes || formData.sessionMinutes <= 0) return '每堂時間必填且需大於 0'
        if (!formData.timeStart) return '適用開始時間必填'
        if (!formData.timeEnd) return '適用結束時間必填'
        return null
      default:
        return null
    }
  }

  const goToNextStep = () => {
    const error = validateStep(currentStep)
    if (error) {
      toast(error, 'error')
      return
    }
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as WizardStep)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep)
    }
  }

  const handleSavePlan = async () => {
    const error = validateStep(3)
    if (error) {
      toast(error, 'error')
      return
    }

    setSaving(true)
    try {
      const newPlan: SeasonPassPlan = {
        id: editingId || `pass-${Date.now()}`,
        name: formData.name || '',
        price: formData.price || 0,
        description: formData.description || '',
        active: formData.active !== false,
        startDate: formData.startDate || '',
        endDate: formData.endDate || '',
        sessions: formData.sessions || 0,
        sessionMinutes: formData.sessionMinutes || 0,
        applicableWeekdays: formData.applicableWeekdays || [],
        timeStart: formData.timeStart || '',
        timeEnd: formData.timeEnd || '',
        courts: formData.courts || [],
        allowCrossSession: formData.allowCrossSession !== false,
        transferable: formData.transferable !== false,
        cancellationPolicy: formData.cancellationPolicy || '',
        status: editingId ? 'ACTIVE' : 'DRAFT',
        createdAt: new Date(),
      }

      if (editingId) {
        setPlans(plans.map((p) => (p.id === editingId ? newPlan : p)))
        toast('包季方案已更新', 'success')
      } else {
        setPlans([...plans, newPlan])
        toast('包季方案已新增為草稿', 'success')
      }

      resetWizard()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!formData.name) {
      toast('請至少填寫方案名稱', 'error')
      return
    }

    setSaving(true)
    try {
      const draftPlan: SeasonPassPlan = {
        id: editingId || `pass-${Date.now()}`,
        name: formData.name,
        price: formData.price || 0,
        description: formData.description || '',
        active: false,
        startDate: formData.startDate || '',
        endDate: formData.endDate || '',
        sessions: formData.sessions || 0,
        sessionMinutes: formData.sessionMinutes || 0,
        applicableWeekdays: formData.applicableWeekdays || [],
        timeStart: formData.timeStart || '',
        timeEnd: formData.timeEnd || '',
        courts: formData.courts || [],
        allowCrossSession: formData.allowCrossSession !== false,
        transferable: formData.transferable !== false,
        cancellationPolicy: formData.cancellationPolicy || '',
        status: 'DRAFT',
        createdAt: new Date(),
      }

      if (editingId) {
        setPlans(plans.map((p) => (p.id === editingId ? draftPlan : p)))
        toast('草稿已保存', 'success')
      } else {
        setPlans([...plans, draftPlan])
        toast('包季方案已另存為草稿', 'success')
      }

      resetWizard()
    } finally {
      setSaving(false)
    }
  }

  const resetWizard = () => {
    setShowWizard(false)
    setCurrentStep(1)
    setEditingId(null)
    setFormData({
      applicableWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    })
  }

  const handleEditPlan = (plan: SeasonPassPlan) => {
    setFormData(plan)
    setEditingId(plan.id)
    setCurrentStep(1)
    setShowWizard(true)
  }

  const stepLabels = ['基本資料', '使用期間', '使用規則'] as const
  const stepDescriptions = [
    '設定方案名稱、價格與說明',
    '設定方案的有效期間',
    '設定使用規則與限制',
  ] as const

  if (showWizard) {
    return <SeasonPassWizard
      step={currentStep}
      formData={formData}
      setFormData={setFormData}
      onNext={goToNextStep}
      onPrev={goToPreviousStep}
      onSave={handleSavePlan}
      onSaveDraft={handleSaveDraft}
      saving={saving}
      stepLabels={stepLabels}
      stepDescriptions={stepDescriptions}
      editingId={editingId}
    />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">包季方案</h2>
          <p className="mt-1 text-sm text-muted">管理場地包季方案與使用規則</p>
        </div>
        <Button onClick={() => { setShowWizard(true); setEditingId(null); setFormData({ applicableWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] }); setCurrentStep(1) }}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          新增包季方案
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center text-muted">
          <p>尚未建立包季方案</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <SeasonPassCard
              key={plan.id}
              plan={plan}
              onEdit={() => handleEditPlan(plan)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SeasonPassWizard({
  step,
  formData,
  setFormData,
  onNext,
  onPrev,
  onSave,
  onSaveDraft,
  saving,
  stepLabels,
  stepDescriptions,
  editingId,
}: {
  step: WizardStep
  formData: Partial<SeasonPassPlan>
  setFormData: (data: Partial<SeasonPassPlan>) => void
  onNext: () => void
  onPrev: () => void
  onSave: () => void
  onSaveDraft: () => void
  saving: boolean
  stepLabels: readonly string[]
  stepDescriptions: readonly string[]
  editingId: string | null
}) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="border-b border-[rgb(var(--border))] p-4">
        <div className="flex items-center justify-between">
          {stepLabels.map((label, idx) => {
            const stepNum = (idx + 1) as WizardStep
            const isActive = step === stepNum
            const isDone = step > stepNum
            return (
              <div key={idx} className="flex flex-1 items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isActive ? 'bg-brand-500 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-[rgb(var(--bg-hover))] text-muted'
                  }`}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted">{stepDescriptions[idx]}</p>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div className={`ml-4 h-1 flex-1 ${step > stepNum ? 'bg-green-500' : 'bg-[rgb(var(--border))]'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-6">
        {step === 1 && <Step1Content formData={formData} setFormData={setFormData} />}
        {step === 2 && <Step2Content formData={formData} setFormData={setFormData} />}
        {step === 3 && <Step3Content formData={formData} setFormData={setFormData} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--border))] p-4">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onPrev}
            disabled={step === 1 || saving}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            上一步
          </Button>
          {step < 3 && (
            <Button onClick={onNext} disabled={saving}>
              下一步
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>

        {step === 3 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onSaveDraft}
              loading={saving}
              disabled={saving}
            >
              保存草稿
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={saving}
            >
              {editingId ? '更新並啟用' : '儲存並啟用包季方案'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Step1Content({
  formData,
  setFormData,
}: {
  formData: Partial<SeasonPassPlan>
  setFormData: (data: Partial<SeasonPassPlan>) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="方案名稱 *" htmlFor="plan-name" required>
        <Input
          id="plan-name"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="例：春季平日方案"
        />
      </Field>

      <Field label="方案價格（NT$） *" htmlFor="plan-price" required>
        <Input
          id="plan-price"
          type="number"
          min={0}
          value={formData.price || ''}
          onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
          placeholder="例：8000"
        />
      </Field>

      <Field label="方案說明" htmlFor="plan-desc">
        <textarea
          id="plan-desc"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="例：適用平日離峰時段"
          className="min-h-20 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </Field>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.active !== false}
          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
          className="h-4 w-4 rounded border-[rgb(var(--border))]"
        />
        <span className="text-sm">預設啟用此方案</span>
      </label>
    </div>
  )
}

function Step2Content({
  formData,
  setFormData,
}: {
  formData: Partial<SeasonPassPlan>
  setFormData: (data: Partial<SeasonPassPlan>) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="方案開始日期 *" htmlFor="start-date" required>
        <Input
          id="start-date"
          type="date"
          value={formData.startDate || ''}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        />
      </Field>

      <Field label="方案結束日期 *" htmlFor="end-date" required>
        <Input
          id="end-date"
          type="date"
          value={formData.endDate || ''}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
        />
      </Field>

      {formData.startDate && formData.endDate && (
        <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>方案有效期間：{formData.startDate} 至 {formData.endDate}</p>
        </div>
      )}
    </div>
  )
}

function Step3Content({
  formData,
  setFormData,
}: {
  formData: Partial<SeasonPassPlan>
  setFormData: (data: Partial<SeasonPassPlan>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="可使用堂數 *" htmlFor="sessions" required>
          <Input
            id="sessions"
            type="number"
            min={0}
            value={formData.sessions || ''}
            onChange={(e) => setFormData({ ...formData, sessions: Number(e.target.value) })}
            placeholder="例：12"
          />
        </Field>

        <Field label="每堂使用時間（分鐘） *" htmlFor="session-min" required>
          <Input
            id="session-min"
            type="number"
            min={0}
            value={formData.sessionMinutes || ''}
            onChange={(e) => setFormData({ ...formData, sessionMinutes: Number(e.target.value) })}
            placeholder="例：60"
          />
        </Field>

        <Field label="適用開始時間 *" htmlFor="time-start" required>
          <Input
            id="time-start"
            type="time"
            value={formData.timeStart || ''}
            onChange={(e) => setFormData({ ...formData, timeStart: e.target.value })}
          />
        </Field>

        <Field label="適用結束時間 *" htmlFor="time-end" required>
          <Input
            id="time-end"
            type="time"
            value={formData.timeEnd || ''}
            onChange={(e) => setFormData({ ...formData, timeEnd: e.target.value })}
          />
        </Field>
      </div>

      <div className="border-t border-[rgb(var(--border))] pt-4">
        <p className="mb-3 text-sm font-medium">適用星期（全選表示每天）</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => {
            const dayLabels: Record<string, string> = { MON: '一', TUE: '二', WED: '三', THU: '四', FRI: '五', SAT: '六', SUN: '日' }
            const isSelected = formData.applicableWeekdays?.includes(day) ?? false
            return (
              <label key={day} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    const current = formData.applicableWeekdays || []
                    setFormData({
                      ...formData,
                      applicableWeekdays: e.target.checked ? [...current, day] : current.filter((d) => d !== day),
                    })
                  }}
                  className="h-4 w-4 rounded border-[rgb(var(--border))]"
                />
                <span className="text-sm">週{dayLabels[day]}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[rgb(var(--border))] pt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.allowCrossSession !== false}
            onChange={(e) => setFormData({ ...formData, allowCrossSession: e.target.checked })}
            className="h-4 w-4 rounded border-[rgb(var(--border))]"
          />
          <span className="text-sm">允許跨時段使用</span>
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.transferable !== false}
            onChange={(e) => setFormData({ ...formData, transferable: e.target.checked })}
            className="h-4 w-4 rounded border-[rgb(var(--border))]"
          />
          <span className="text-sm">可以轉讓</span>
        </label>
      </div>

      <Field label="取消或逾期規則" htmlFor="cancellation">
        <textarea
          id="cancellation"
          value={formData.cancellationPolicy || ''}
          onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
          placeholder="例：逾期未使用自動作廢，不可退款"
          className="min-h-16 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </Field>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p className="font-medium">待後端配合的欄位：</p>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-xs">
          <li>適用場地選擇（courtId 多選）</li>
          <li>包季與會員點數對應關係</li>
          <li>包季使用記錄與核銷邏輯</li>
        </ul>
      </div>
    </div>
  )
}

function SeasonPassCard({ plan, onEdit }: { plan: SeasonPassPlan; onEdit: () => void }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: '草稿', className: 'bg-gray-100 text-gray-700' },
    ACTIVE: { label: '啟用中', className: 'bg-green-100 text-green-700' },
    ENDED: { label: '已結束', className: 'bg-gray-100 text-gray-700' },
    DISABLED: { label: '已停用', className: 'bg-red-100 text-red-700' },
  }

  const config = statusConfig[plan.status] || statusConfig.DRAFT

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{plan.name}</h3>
            <span className={`rounded px-2 py-1 text-xs font-medium ${config.className}`}>{config.label}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {plan.sessions} 堂 × {plan.sessionMinutes} 分鐘｜NT${plan.price.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            有效期：{plan.startDate} 至 {plan.endDate}｜適用時間：{plan.timeStart}–{plan.timeEnd}
          </p>
          {plan.description && <p className="mt-2 text-sm text-muted">{plan.description}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
