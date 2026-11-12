'use client'

import { useState } from 'react'
import { Users, Plus, Mail, Trash2, Shield, CheckCircle2, Clock } from 'lucide-react'

const ROLES = [
  {
    id: 'owner',
    name: 'Owner',
    label: '擁有者',
    description: '完全控制權限',
    color: 'red',
  },
  {
    id: 'manager',
    name: 'Manager',
    label: '經理',
    description: '場館管理與營運',
    color: 'blue',
  },
  {
    id: 'staff',
    name: 'Staff',
    label: '現場人員',
    description: '預約與現場操作',
    color: 'green',
  },
  {
    id: 'finance',
    name: 'Finance',
    label: '財務',
    description: '財務與對帳',
    color: 'orange',
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    label: '設備維護',
    description: '設備與維護',
    color: 'purple',
  },
]

const PERMISSIONS = [
  { id: 'view', label: '查看', icon: '👁️' },
  { id: 'create', label: '新增', icon: '➕' },
  { id: 'edit', label: '編輯', icon: '✏️' },
  { id: 'delete', label: '刪除', icon: '🗑️' },
  { id: 'review', label: '審核', icon: '✅' },
  { id: 'export', label: '匯出', icon: '📤' },
  { id: 'control', label: '遠端控制', icon: '🎮' },
  { id: 'manage', label: '授權管理', icon: '🔐' },
]

const PERMISSION_MATRIX: Record<string, string[]> = {
  owner: ['view', 'create', 'edit', 'delete', 'review', 'export', 'control', 'manage'],
  manager: ['view', 'create', 'edit', 'delete', 'review', 'export', 'control'],
  staff: ['view', 'create', 'edit', 'export'],
  finance: ['view', 'review', 'export'],
  maintenance: ['view', 'edit', 'control'],
}

const ADMINS = [
  {
    id: 'A001',
    username: 'admin',
    displayName: 'Administrator',
    email: 'admin@picklehaven.local',
    role: 'owner',
    lineLinked: false,
    status: 'active',
    createdAt: '2026-11-01',
    lastLogin: '2026-11-12 14:32:15',
  },
  {
    id: 'A002',
    username: 'manager1',
    displayName: '經理一號',
    email: 'manager1@example.com',
    role: 'manager',
    lineLinked: true,
    status: 'active',
    createdAt: '2026-11-05',
    lastLogin: '2026-11-12 13:15:00',
  },
  {
    id: 'A003',
    username: 'staff1',
    displayName: '現場人員',
    email: 'staff@example.com',
    role: 'staff',
    lineLinked: true,
    status: 'active',
    createdAt: '2026-11-10',
    lastLogin: '2026-11-12 12:00:00',
  },
]

const INVITATIONS = [
  {
    id: 'INV001',
    email: 'newuser@example.com',
    role: 'manager',
    sentAt: '2026-11-12 10:00:00',
    expiresAt: '2026-11-19 10:00:00',
    status: 'pending',
    sentBy: 'admin',
  },
  {
    id: 'INV002',
    email: 'finance@example.com',
    role: 'finance',
    sentAt: '2026-11-11 09:00:00',
    expiresAt: '2026-11-18 09:00:00',
    status: 'accepted',
    sentBy: 'admin',
  },
]

export function StaffRbacManager() {
  const [activeTab, setActiveTab] = useState<'admins' | 'roles' | 'invitations'>('admins')
  const [showInviteForm, setShowInviteForm] = useState(false)

  return (
    <div className="space-y-6">
      {/* 標籤頁 */}
      <div className="flex gap-2 border-b border-zinc-200">
        {[
          { id: 'admins', label: '管理員帳號' },
          { id: 'roles', label: '角色與權限' },
          { id: 'invitations', label: '邀請管理' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-muted hover:text-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 管理員帳號 */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">已授權的後台帳號</h3>
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              <Plus className="w-3 h-3" />
              邀請新管理員
            </button>
          </div>

          {showInviteForm && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold mb-4">邀請新管理員</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Email 地址
                  </label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">角色</label>
                  <select className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
                    {ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors">
                    發送邀請
                  </button>
                  <button
                    onClick={() => setShowInviteForm(false)}
                    className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 管理員清單 */}
          <div className="grid gap-3">
            {ADMINS.map((admin) => {
              const role = ROLES.find((r) => r.id === admin.role)!
              return (
                <div
                  key={admin.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{admin.displayName}</p>
                      <p className="text-xs text-muted mt-0.5">{admin.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold text-white ${
                          role.color === 'red'
                            ? 'bg-red-600'
                            : role.color === 'blue'
                              ? 'bg-blue-600'
                              : role.color === 'green'
                                ? 'bg-emerald-600'
                                : role.color === 'orange'
                                  ? 'bg-orange-600'
                                  : 'bg-purple-600'
                        }`}
                      >
                        <Shield className="w-2.5 h-2.5 mr-1" />
                        {role.label}
                      </span>
                      {admin.lineLinked && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                          LINE 已綁定
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted space-y-1 py-2 border-t border-b border-zinc-100">
                    <div className="flex justify-between">
                      <span>帳號：</span>
                      <span className="font-mono">{admin.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最後登入：</span>
                      <span>{admin.lastLogin}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                      詳情
                    </button>
                    {admin.role !== 'owner' && (
                      <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex items-center justify-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        撤銷
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 角色與權限矩陣 */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            RBAC 權限矩陣：勾選的權限代表該角色具有的操作權限
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left px-3 py-2 font-semibold text-zinc-900">角色</th>
                  {PERMISSIONS.map((perm) => (
                    <th key={perm.id} className="text-center px-2 py-2 font-semibold text-zinc-900">
                      {perm.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 font-semibold text-zinc-900">{role.label}</td>
                    {PERMISSIONS.map((perm) => {
                      const hasPermission =
                        PERMISSION_MATRIX[role.id]?.includes(perm.id) || false
                      return (
                        <td
                          key={`${role.id}-${perm.id}`}
                          className="text-center px-2 py-2"
                        >
                          {hasPermission && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 權限說明 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-zinc-900">敏感權限操作要求額外驗證：</p>
            <ul className="text-xs text-muted space-y-1">
              <li>• 管理員邀請 & 角色變更：需 Owner 核准</li>
              <li>• 退款核准：需 Finance 與 Manager 二人確認</li>
              <li>• 影像觀看與匯出：需記錄在案，受存取控制</li>
              <li>• 門禁授權變更：需後端驗證與 Audit Log</li>
              <li>• 遠端開門：需雙重確認與現場安全檢查</li>
              <li>• 設備開關：需檢查預約狀態與衝突</li>
              <li>• 自動化規則發布：需測試與生效期限</li>
            </ul>
          </div>
        </div>
      )}

      {/* 邀請管理 */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">待處理邀請</h3>

          <div className="grid gap-3">
            {INVITATIONS.map((inv) => (
              <div
                key={inv.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{inv.email}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {ROLES.find((r) => r.id === inv.role)?.label}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                      inv.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {inv.status === 'pending' ? (
                      <>
                        <Clock className="w-2.5 h-2.5 mr-1" />
                        待接受
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                        已接受
                      </>
                    )}
                  </span>
                </div>

                <div className="text-xs text-muted py-2 border-t border-b border-zinc-100 space-y-1">
                  <div className="flex justify-between">
                    <span>發送時間：</span>
                    <span>{inv.sentAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>有效期至：</span>
                    <span>{inv.expiresAt}</span>
                  </div>
                </div>

                {inv.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                      重新發送
                    </button>
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors">
                      撤銷
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
