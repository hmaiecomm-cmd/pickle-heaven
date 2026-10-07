import { Archivo } from 'next/font/google'

/** 英文標語與數字用的展示字型；中文仍使用系統字型，不額外下載大型中文字檔。 */
export const displayFont = Archivo({
  subsets: ['latin'],
  variable: '--font-hp-display',
  display: 'swap',
})
