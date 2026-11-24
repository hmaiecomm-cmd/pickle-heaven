import 'server-only'
import OpenAI from 'openai'

export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
export const MAX_TOKENS = Number(process.env.AI_CHAT_MAX_TOKENS) || 2000
export const INPUT_MAX_LENGTH = Number(process.env.AI_INPUT_MAX_LENGTH) || 2000
