/**
 * 官網首頁主題系統
 * 四款可選主題，每款主題有對應的色彩變數
 */

export type HomeTheme = 'purple' | 'green' | 'blue' | 'berry'

export interface ThemeColors {
  primary: string        // 主色（按鈕、標題強調色）
  primaryLight: string   // 主色淺版
  secondary: string      // 次色（輔助區塊背景）
  text: string          // 文字色
  textLight: string     // 淡文字色
  border: string        // 邊框色
  focus: string         // 焦點色
}

export const THEME_COLORS: Record<HomeTheme, ThemeColors> = {
  purple: {
    primary: '#7c5eb8',      // 原站紫
    primaryLight: '#e9e1f5',
    secondary: '#f5f0fa',
    text: '#1f2a22',
    textLight: '#666666',
    border: '#e6eadf',
    focus: '#7cb342',
  },
  green: {
    primary: '#1b5e20',      // 森林綠
    primaryLight: '#c8e6c9',
    secondary: '#e8f5e9',
    text: '#1f2a22',
    textLight: '#666666',
    border: '#e6eadf',
    focus: '#558b2f',
  },
  blue: {
    primary: '#01579b',      // 深海藍
    primaryLight: '#b3e5fc',
    secondary: '#e1f5fe',
    text: '#1f2a22',
    textLight: '#666666',
    border: '#e6eadf',
    focus: '#0277bd',
  },
  berry: {
    primary: '#6a1b9a',      // 莓果紫
    primaryLight: '#e1bee7',
    secondary: '#f3e5f5',
    text: '#1f2a22',
    textLight: '#666666',
    border: '#e6eadf',
    focus: '#7b1fa2',
  },
}

export const THEME_LABELS: Record<HomeTheme, string> = {
  purple: '原站紫（預設）',
  green: '森林綠',
  blue: '深海藍',
  berry: '莓果紫',
}

export const THEME_ORDER: HomeTheme[] = ['purple', 'green', 'blue', 'berry']
