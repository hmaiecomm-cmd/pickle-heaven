/**
 * DUPR Token 加密 & 解密工具
 *
 * 安全存儲 OAuth Token（AES-256-GCM）
 */

import crypto from 'crypto'

/**
 * 加密密鑰必須設置在環境變數
 * 應為 32 字節的 hex 字符串（256 位）
 *
 * 生成方式：
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
const ENCRYPTION_KEY = process.env.DUPR_ENCRYPTION_KEY || ''

if (!ENCRYPTION_KEY) {
  console.warn(
    '[DUPR] 警告：DUPR_ENCRYPTION_KEY 未設置。Token 加密可能無法正常工作。'
  )
}

/**
 * 將 hex 字符串轉換為 Buffer（密鑰）
 */
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      'DUPR_ENCRYPTION_KEY 環境變數未設置。無法加密/解密 Token。'
    )
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex')
}

/**
 * 加密令牌（使用 AES-256-GCM）
 *
 * @param token 明文令牌
 * @returns 加密後的令牌（格式：encrypted:<base64>）
 */
export function encryptToken(token: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(12) // GCM 推薦使用 96 位 IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted = encrypted + cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // 組合 IV + authTag + encryptedData，一起編碼為 base64
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')])
    const encoded = combined.toString('base64')

    return `encrypted:${encoded}`
  } catch (error) {
    console.error('[DUPR] Token 加密失敗:', error)
    throw new Error('無法加密 Token')
  }
}

/**
 * 解密令牌（使用 AES-256-GCM）
 *
 * @param encryptedToken 加密的令牌（格式：encrypted:<base64>）
 * @returns 解密後的明文令牌
 */
export function decryptToken(encryptedToken: string): string {
  try {
    // 檢查格式
    if (!encryptedToken.startsWith('encrypted:')) {
      throw new Error('Token 格式無效（應以 "encrypted:" 開頭）')
    }

    const key = getEncryptionKey()
    const encoded = encryptedToken.slice(10) // 移除 "encrypted:" 前綴
    const combined = Buffer.from(encoded, 'base64')

    // 分解 IV + authTag + encryptedData
    const iv = combined.slice(0, 12) // 96 位 IV
    const authTag = combined.slice(12, 28) // 128 位 authTag
    const encryptedData = combined.slice(28) // 剩餘為加密數據

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData)
    decrypted += decipher.final()

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('[DUPR] Token 解密失敗:', error)
    throw new Error('無法解密 Token（可能已損壞或密鑰不匹配）')
  }
}

/**
 * 檢查 Token 是否已加密
 *
 * @param token Token 字符串
 * @returns 是否已加密
 */
export function isEncryptedToken(token: string): boolean {
  return token.startsWith('encrypted:')
}

/**
 * 安全地儲存 Token（自動加密）
 * 如果已加密則返回原值
 *
 * @param token Token 字符串
 * @returns 加密的 Token
 */
export function secureToken(token: string): string {
  if (isEncryptedToken(token)) {
    return token // 已加密，直接返回
  }
  return encryptToken(token)
}

/**
 * 安全地取得 Token（自動解密）
 * 如果未加密則返回原值（向後相容）
 *
 * @param token Token 字符串
 * @returns 明文 Token
 */
export function getToken(token: string): string {
  if (!isEncryptedToken(token)) {
    console.warn('[DUPR] 警告：Token 未加密。建議檢查數據庫中的舊記錄。')
    return token
  }
  return decryptToken(token)
}

/**
 * 生成加密密鑰（用於初始化）
 *
 * 使用方式：
 * const key = generateEncryptionKey()
 * // 設置環境變數 DUPR_ENCRYPTION_KEY=<key>
 *
 * @returns 32 字節的 hex 密鑰
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
