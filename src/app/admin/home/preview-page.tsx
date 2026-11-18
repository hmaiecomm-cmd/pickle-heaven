'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { images, brand } from '@/config/site'
import { ntd } from '@/lib/utils'
import type { EditorState } from './editor-types'

/**
 * 編輯器預覽頁面 - 使用真實首頁組件顯示樣式
 */
export function PreviewPage({ state, imagePreviewUrl }: { state: EditorState; imagePreviewUrl?: string }) {
  const heroDisplayImage = imagePreviewUrl || images.hero.src

  return (
    <div className="min-h-screen bg-white">
      {/* 主視覺 - 使用真實的 HeroSection 樣式 */}
      <section className="relative isolate overflow-hidden bg-[#2f2f4a] text-white">
        <div className="lg:grid lg:min-h-[min(100svh,60rem)] lg:grid-cols-12">
          {/* 右側大照片 */}
          <div className="relative h-[44svh] min-h-[17rem] overflow-hidden lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:h-auto">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${heroDisplayImage}')`,
                backgroundPosition: '50% 30%',
              }}
            />
            {/* 漸層遮罩 */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#2f2f4a]/75 to-transparent" />
            <div className="absolute inset-y-0 left-0 hidden w-48 bg-gradient-to-r from-[#2f2f4a] to-transparent lg:block" />
          </div>

          {/* 左側文字 */}
          <div className="relative z-10 px-6 pb-14 pt-1 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-end lg:pb-24 lg:pt-36 md:px-8">
            <div className="max-w-[40rem]">
              <p className="text-xs uppercase tracking-[0.2em] text-white/75 font-medium">{brand.englishName}</p>
              <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight text-white whitespace-pre-line">
                {state.hero.title}
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg text-white/85">{state.hero.subtitle}</p>
              <p className="mt-4 max-w-[34rem] text-base text-white/75">{state.hero.description}</p>

              {/* 按鈕 */}
              <div className="mt-9 flex flex-wrap gap-3">
                <button
                  className="px-6 py-3 rounded-lg font-semibold text-white transition-all"
                  style={{ backgroundColor: '#7c5eb8' }}
                >
                  {state.hero.buttonText}
                </button>
              </div>

              {/* 統計資訊 */}
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

      {/* 區塊預覽 */}
      {Object.entries(state.sections).map(([key, section]) => {
        if (!section.visible) return null
        return (
          <section key={key} className="py-16 px-6 md:px-8 lg:py-24 bg-white border-t">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#2f2f4a]">{section.title}</h2>
              <p className="text-lg text-gray-600 max-w-2xl">{section.description}</p>
            </div>
          </section>
        )
      })}
    </div>
  )
}
