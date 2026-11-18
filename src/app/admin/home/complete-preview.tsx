'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { images, brand, contact, SHOW_PENDING } from '@/config/site'
import { ntd } from '@/lib/utils'
import type { EditorState } from './editor-types'

/**
 * 完整官網預覽 - 所有區塊真實樣式
 * 一模一樣的排版和樣式，支持即時編輯預覽
 */
export function CompletePreview({ state, heroImageUrl, storyImageUrl }: {
  state: EditorState
  heroImageUrl?: string
  storyImageUrl?: string
}) {
  // Mock 資料（實際應從 state 或 API 讀取）
  const mockSessions = [
    { id: '1', dateLabel: '1/18', timeLabel: '14:00-16:00', title: '新手體驗賽', price: 500, statusLabel: '開放報名中' },
    { id: '2', dateLabel: '1/25', timeLabel: '09:00-17:00', title: '森林匹克球交流賽', price: 800, statusLabel: '開放報名中' },
  ]

  const mockCoaches = [
    {
      id: '1',
      name: '王教練',
      specialties: ['基礎訓練', '雙打策略'],
      bio: '10年教學經驗，擅長幫助初學者建立正確基礎',
      hourlyRate: 1500
    },
    {
      id: '2',
      name: '李教練',
      specialties: ['進階技巧', '比賽戰術'],
      bio: '曾任職業選手，現專攻競賽級訓練',
      hourlyRate: 2000
    },
  ]

  const mockPrices = [
    { label: '平日（一-五）', timeLabel: '09:00-17:00', price: 600 },
    { label: '平日（一-五）', timeLabel: '17:00-22:00', price: 800 },
    { label: '假日（六-日）', timeLabel: '09:00-17:00', price: 800 },
  ]

  return (
    <div className="bg-white min-h-screen">
      {/* ===== 主視覺區 ===== */}
      <section className="relative isolate overflow-hidden bg-[#2f2f4a] text-white">
        <div className="lg:grid lg:min-h-[min(100svh,60rem)] lg:grid-cols-12">
          <div className="relative h-[44svh] min-h-[17rem] overflow-hidden lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:h-auto">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${heroImageUrl || images.hero.src}')`,
                backgroundPosition: '50% 30%',
              }}
            />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#2f2f4a]/75 to-transparent" />
            <div className="absolute inset-y-0 left-0 hidden w-48 bg-gradient-to-r from-[#2f2f4a] to-transparent lg:block" />
          </div>

          <div className="relative z-10 px-6 pb-14 pt-1 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-end lg:pb-24 lg:pt-36 md:px-8">
            <div className="max-w-[40rem]">
              <p className="text-xs uppercase tracking-[0.2em] text-white/75 font-medium">{brand.englishName}</p>
              <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight text-white whitespace-pre-line">
                {state.hero.title}
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg text-white/85">{state.hero.subtitle}</p>
              <p className="mt-4 max-w-[34rem] text-base text-white/75">{state.hero.description}</p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/booking" className="px-6 py-3 rounded-lg font-semibold text-white transition-all bg-[#7c5eb8] hover:bg-[#6b4fa3]">
                  {state.hero.buttonText}
                </Link>
                <Link href="#coaching" className="px-6 py-3 rounded-lg font-semibold text-white transition-all border border-white/30 hover:bg-white/10">
                  探索課程
                </Link>
              </div>

              <dl className="mt-12 grid max-w-[30rem] grid-cols-3 gap-4 border-t border-white/15 pt-6">
                <div>
                  <dt className="text-xs text-white/60">線上可預約</dt>
                  <dd className="mt-1 font-semibold text-base">每日開放</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/60">每個時段</dt>
                  <dd className="mt-1 font-semibold text-base">60 分鐘</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/60">場地費</dt>
                  <dd className="mt-1 font-semibold text-base">$600 起</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ===== OPEN PLAY 和訂場區 ===== */}
      {state.sections.plans.visible && (
        <section className="bg-[#f5f1e8] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="mb-12">
              <p className="text-sm uppercase tracking-[0.2em] text-[#7c5eb8] font-semibold">PLAY</p>
              <h2 className="mt-4 text-4xl md:text-5xl font-bold text-[#2f2f4a]">{state.sections.plans.title}</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* OPEN PLAY */}
              <div className="bg-[#7c5eb8] text-white p-8 rounded-2xl">
                <p className="text-sm font-semibold tracking-[0.2em]">OPEN PLAY</p>
                <h3 className="mt-3 text-3xl font-bold">球友集合</h3>
                <p className="mt-4 text-white/85">不用自己湊齊人數。報名一個場次，就能和不同的球友輪流上場。</p>
                <div className="mt-8">
                  <p className="text-sm font-semibold text-white/70">近期場次</p>
                  <ul className="mt-3 divide-y divide-white/15 border-y border-white/15">
                    {mockSessions.map((s) => (
                      <li key={s.id} className="py-4 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                        <span className="font-bold text-lg">{s.dateLabel}</span>
                        <span className="text-white/90">{s.timeLabel}</span>
                        <span className="text-right font-semibold">{ntd(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 訂場 */}
              <div className="border-2 border-[#2f2f4a]/85 p-8 rounded-2xl bg-white">
                <p className="text-sm font-semibold tracking-[0.2em] text-[#7c5eb8]">COURT BOOKING</p>
                <h3 className="mt-3 text-3xl font-bold text-[#2f2f4a]">你的主場</h3>
                <p className="mt-4 text-[#2f2f4a]/75">自己揪好球友，選日期、挑時段，線上完成場地預約與付款。</p>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#7c5eb8]">{ntd(600)}</span>
                  <span className="text-sm text-[#2f2f4a]/70">起／每時段 60 分鐘</span>
                </p>
                <table className="mt-6 w-full text-sm">
                  <tbody className="divide-y divide-[#2f2f4a]/10">
                    {mockPrices.map((p) => (
                      <tr key={p.label + p.timeLabel}>
                        <td className="py-2 font-semibold">{p.label}</td>
                        <td className="py-2 text-[#2f2f4a]/70">{p.timeLabel}</td>
                        <td className="py-2 text-right font-bold text-[#7c5eb8]">{ntd(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== 教練區 ===== */}
      {state.sections.coaching.visible && (
        <section className="bg-[#e8dff5] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="mb-12">
              <p className="text-sm uppercase tracking-[0.2em] text-[#7c5eb8] font-semibold">COACHING</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#2f2f4a]">{state.sections.coaching.title}</h2>
              <p className="mt-6 text-lg text-[#2f2f4a]/75">{state.sections.coaching.description}</p>
            </div>

            {mockCoaches.length > 0 ? (
              <div className="grid gap-6">
                {mockCoaches.map((coach) => (
                  <div key={coach.id} className="grid md:grid-cols-[200px_1fr] gap-6 bg-white rounded-2xl overflow-hidden">
                    <div className="bg-[#2f2f4a] text-white flex items-center justify-center min-h-[150px]">
                      <span className="text-6xl font-bold">{coach.name.slice(0, 1)}</span>
                    </div>
                    <div className="p-6 md:p-8">
                      <h3 className="text-2xl font-bold text-[#2f2f4a]">{coach.name}</h3>
                      {coach.specialties.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {coach.specialties.map((s) => (
                            <span key={s} className="rounded-full bg-[#e8dff5] px-3 py-1 text-sm font-semibold text-[#2f2f4a]">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {coach.bio && <p className="mt-4 text-[#2f2f4a]/75">{coach.bio}</p>}
                      <div className="mt-5 text-sm">
                        <p className="text-[#2f2f4a]/60">課程費用</p>
                        <p className="mt-1 font-bold text-[#7c5eb8]">{ntd(coach.hourlyRate)}／小時</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-[#2f2f4a]/75">教練課程正在規劃中...</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== 場館故事區 ===== */}
      {state.sections.story.visible && (
        <section className="bg-[#f5f1e8] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
              {storyImageUrl && (
                <img src={storyImageUrl} alt="場館故事" className="w-full h-64 md:h-96 object-cover rounded-2xl" />
              )}
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[#7c5eb8] font-semibold">OUR STORY</p>
                <h2 className="mt-4 text-4xl md:text-5xl font-bold text-[#2f2f4a]">{state.sections.story.title}</h2>
                <p className="mt-6 text-lg text-[#2f2f4a]/75">{state.sections.story.description}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== 訪問資訊區 ===== */}
      {state.sections.visit.visible && (
        <section className="bg-[#e8dff5] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="mb-12">
              <p className="text-sm uppercase tracking-[0.2em] text-[#7c5eb8] font-semibold">VISIT</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#2f2f4a]">{state.sections.visit.title}</h2>
              <p className="mt-6 text-lg text-[#2f2f4a]/75">{state.sections.visit.description}</p>
            </div>

            <div className="bg-white rounded-2xl p-8">
              <dl className="space-y-4 border-t pt-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-[#2f2f4a]/60">場館名稱</dt>
                    <dd className="mt-1 font-semibold">{brand.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-[#2f2f4a]/60">電話</dt>
                    <dd className="mt-1 font-semibold">待補</dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </section>
      )}

      {/* ===== 邀請區 ===== */}
      {state.sections.invite.visible && (
        <section className="relative isolate overflow-hidden bg-[#2f2f4a] text-white py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="max-w-[40rem]">
              <h2 className="text-5xl md:text-6xl font-bold">{state.sections.invite.title}</h2>
              <p className="mt-6 text-lg text-white/85">{state.sections.invite.description}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/booking" className="px-6 py-3 rounded-lg font-semibold text-white bg-[#7c5eb8] hover:bg-[#6b4fa3]">
                  預約開打
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
