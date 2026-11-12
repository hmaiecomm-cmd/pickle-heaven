import { NextRequest, NextResponse } from 'next/server'
import { requireApiPermission, logAuditEvent } from '@/lib/admin-auth'
import { createInvitation, revokeInvitation } from '@/server/admin-invitation-service'
import { sendInvitationEmail } from '@/lib/email-service'

/**
 * POST /api/admin/invitations - 建立新邀請
 * 需要 OWNER 角色
 */
export async function POST(req: NextRequest) {
  try {
    const result = await requireApiPermission(req, 'manage_admins')
    if ('error' in result) return result.error

    const { email, role, expirationDays = 7 } = await req.json()

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 建立邀請
    const invitation = await createInvitation({
      email: email.toLowerCase(),
      role: role as any,
      createdByAdminId: result.admin.adminId,
      expirationDays,
    })

    // 發送邀請郵件
    await sendInvitationEmail(email, invitation.token, invitation.expiresAt, role)

    // 記錄到 audit log
    await logAuditEvent(
      result.admin.adminId,
      'create_invitation',
      'admin_invitation',
      invitation.id,
      { email, role }
    )

    return NextResponse.json({
      success: true,
      invitationId: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error('Failed to create invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/invitations/:id - 撤銷邀請
 * 需要 OWNER 角色
 */
export async function DELETE(req: NextRequest) {
  try {
    const result = await requireApiPermission(req, 'manage_admins')
    if ('error' in result) return result.error

    const url = new URL(req.url)
    const invitationId = url.pathname.split('/').pop()

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing invitation ID' },
        { status: 400 }
      )
    }

    // 撤銷邀請
    await revokeInvitation(invitationId, result.admin.adminId)

    // 記錄到 audit log
    await logAuditEvent(
      result.admin.adminId,
      'revoke_invitation',
      'admin_invitation',
      invitationId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to revoke invitation:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    )
  }
}
