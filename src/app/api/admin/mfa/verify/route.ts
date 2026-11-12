import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAuth, logAuditEvent } from '@/lib/admin-auth';
import { verifyTOTP, enableMFA } from '@/lib/totp-service';

/**
 * 驗證並啟用 2FA
 * POST /api/admin/mfa/verify
 */
export async function POST(req: NextRequest) {
  await requireAuth(req);
  const admin = await getCurrentAdmin(req);

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { secret, token, backupCodes } = await req.json();

    // 驗證 TOTP token
    if (!await verifyTOTP(secret, token)) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // 啟用 MFA
    await enableMFA(admin.adminId, secret, backupCodes);

    // 審計日誌
    await logAuditEvent(admin.username, 'mfa_enabled', 'admin_mfa', admin.adminId, { method: 'totp' });

    return NextResponse.json({
      success: true,
      message: '2FA 已成功啟用',
      backupCodes,
    });
  } catch (error) {
    console.error('MFA verification failed:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA' },
      { status: 500 }
    );
  }
}
