import 'server-only'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    '❌ OPENAI_API_KEY 未設置。請在 .env.local 中設置。\n' +
    '詳見: https://platform.openai.com/api-keys'
  )
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
export const MAX_TOKENS = Number(process.env.AI_CHAT_MAX_TOKENS) || 2000
export const INPUT_MAX_LENGTH = Number(process.env.AI_INPUT_MAX_LENGTH) || 2000
