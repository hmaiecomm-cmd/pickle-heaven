/**
 * TOTP (Time-based One-Time Password) 服務
 * 用於 2FA 雙因素認證
 */

export async function generateTOTPSecret(adminEmail: string) {
  // 模擬生成 TOTP secret
  const secret = Math.random().toString(36).substring(2, 34);
  const backupCodes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  return {
    secret,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Pickle Heaven (${adminEmail})`,
    backupCodes,
  };
}

export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  // 簡化實現：驗證 6 位數字
  return /^\d{6}$/.test(token);
}

export async function enableMFA(
  adminId: string,
  secret: string,
  backupCodes: string[]
): Promise<void> {
  // 實現：保存到數據庫
  console.log(`MFA enabled for admin ${adminId}`);
}

export async function verifyBackupCode(
  adminId: string,
  code: string
): Promise<boolean> {
  // 實現：檢查備用碼
  return code.length > 0;
}
