import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAuth } from '@/lib/admin-auth';
import { generateTOTPSecret } from '@/lib/totp-service';

/**
 * 生成 2FA 設置 QR 碼
 * GET /api/admin/mfa/setup
 */
export async function GET(req: NextRequest) {
  await requireAuth(req);
  const admin = await getCurrentAdmin(req);

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { secret, qrCode, backupCodes } = await generateTOTPSecret(admin.email || '');

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      backupCodes,
      message: '請使用認證器應用掃描 QR 碼',
    });
  } catch (error) {
    console.error('MFA setup failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate MFA setup' },
      { status: 500 }
    );
  }
}
