/**
 * OpenAI Realtime API 連接管理 — Phase 5
 * 
 * 管理與 OpenAI Realtime API 的 WebSocket 連接
 * 支持實時音頻流式對話
 */

export interface RealtimeMessage {
  type: string
  [key: string]: unknown
}

export interface ConnectionConfig {
  apiKey: string
  model?: string
  modalities?: string[]
}

export class RealtimeConnection {
  private ws: WebSocket | null = null
  private config: ConnectionConfig
  private messageHandlers: Map<string, (msg: RealtimeMessage) => void> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(config: ConnectionConfig) {
    this.config = config
  }

  /**
   * 連接到 Realtime API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 注意：實際 URL 和認證需要根據 OpenAI 文檔調整
        const url = 'wss://api.openai.com/v1/realtime'
        
        this.ws = new WebSocket(url, ['realtime'])

        this.ws.onopen = () => {
          console.log('[Realtime] Connected to OpenAI API')
          this.reconnectAttempts = 0
          
          // 發送初始化消息
          this.send({
            type: 'session.update',
            session: {
              model: this.config.model || 'gpt-4-realtime-preview-2024-12-26',
              modalities: this.config.modalities || ['text', 'audio'],
              instructions: '你是場館營運 AI 助理。使用繁體中文回答。',
              temperature: 0.7,
            }
          })
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as RealtimeMessage
            this.handleMessage(message)
          } catch (err) {
            console.error('[Realtime] Failed to parse message:', err)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[Realtime] WebSocket error:', error)
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = () => {
          console.log('[Realtime] Connection closed')
          this.ws = null
          this.attemptReconnect()
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * 斷開連接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * 發送消息
   */
  send(message: RealtimeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Realtime] WebSocket not connected')
      return
    }
    this.ws.send(JSON.stringify(message))
  }

  /**
   * 註冊消息處理器
   */
  on(type: string, handler: (msg: RealtimeMessage) => void): void {
    this.messageHandlers.set(type, handler)
  }

  /**
   * 移除消息處理器
   */
  off(type: string): void {
    this.messageHandlers.delete(type)
  }

  /**
   * 處理接收到的消息
   */
  private handleMessage(message: RealtimeMessage): void {
    const handler = this.messageHandlers.get(message.type)
    if (handler) {
      handler(message)
    }

    // 一般日誌
    console.log(`[Realtime] Received: ${message.type}`)
  }

  /**
   * 嘗試重新連接
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.connect().catch((err) => {
        console.error('[Realtime] Reconnection failed:', err)
      })
    }, delay)
  }

  /**
   * 獲取連接狀態
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
