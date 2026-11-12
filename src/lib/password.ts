/**
 * 密碼加密與驗證工具
 */

import bcryptjs from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * 加密密碼
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcryptjs.hash(password, SALT_ROUNDS)
  } catch (error) {
    console.error('Failed to hash password:', error)
    throw new Error('Password encryption failed')
  }
}

/**
 * 驗證密碼
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, hash)
  } catch (error) {
    console.error('Failed to verify password:', error)
    return false
  }
}
