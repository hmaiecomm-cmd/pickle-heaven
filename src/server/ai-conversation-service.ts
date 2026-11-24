import 'server-only'
import { prisma } from '@/lib/db'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 為用戶建立或取得現有對話
 */
export async function getOrCreateConversation(userId: string) {
  // 嘗試取得最近的對話（24 小時內）
  const recentConversation = await prisma.aIConversation.findFirst({
    where: {
      userId,
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  if (recentConversation) {
    return recentConversation.id
  }

  // 建立新對話
  const conversation = await prisma.aIConversation.create({
    data: { userId }
  })

  return conversation.id
}

/**
 * 取得對話歷史
 */
export async function getConversationHistory(conversationId: string, userId: string) {
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!conversation || conversation.userId !== userId) {
    throw new Error('Conversation not found or unauthorized')
  }

  return conversation.messages.map((msg: any) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))
}

/**
 * 添加訊息到對話
 */
export async function addMessageToConversation(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId }
  })

  if (!conversation || conversation.userId !== userId) {
    throw new Error('Conversation not found or unauthorized')
  }

  const message = await prisma.aIMessage.create({
    data: {
      conversationId,
      role,
      content
    }
  })

  // 更新對話最後更新時間
  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  })

  return message
}

/**
 * 清除對話
 */
export async function deleteConversation(conversationId: string, userId: string) {
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId }
  })

  if (!conversation || conversation.userId !== userId) {
    throw new Error('Conversation not found or unauthorized')
  }

  await prisma.aIConversation.delete({
    where: { id: conversationId }
  })
}

/**
 * 列出用戶的所有對話
 */
export async function listUserConversations(userId: string) {
  return await prisma.aIConversation.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: { content: true },
        orderBy: { createdAt: 'asc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  })
}
