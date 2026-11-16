'use client'

import * as React from 'react'
import type { DeviceAnomaly } from './useDeviceAnomalies'

export interface AnomalyUpdateEvent {
  type: 'created' | 'acknowledged' | 'resolved' | 'updated'
  anomaly: DeviceAnomaly
  circuitId: string
  timestamp: string
}

export interface UseAnomalyWebSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  error: Error | null
  lastUpdate: AnomalyUpdateEvent | null
  connect: () => void
  disconnect: () => void
}

/**
 * Hook：WebSocket / SSE 实时异常推送
 * 使用 Server-Sent Events (SSE) 作为主要方案，兼容无服务器环境
 *
 * @param enabled - 是否启用实时推送
 * @param onUpdate - 接收异常更新的回调
 */
export function useAnomalyWebSocket(
  enabled: boolean = true,
  onUpdate?: (event: AnomalyUpdateEvent) => void
): UseAnomalyWebSocketReturn {
  const [isConnected, setIsConnected] = React.useState(false)
  const [isConnecting, setIsConnecting] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<AnomalyUpdateEvent | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)

  const connect = React.useCallback(() => {
    if (!enabled || isConnecting || isConnected) return

    try {
      setIsConnecting(true)
      setError(null)

      // 使用 Server-Sent Events (SSE)
      const eventSource = new EventSource('/api/ws/anomalies')

      eventSource.addEventListener('open', () => {
        console.log('[Anomaly WebSocket] SSE 连接已建立')
        setIsConnected(true)
        setIsConnecting(false)
      })

      eventSource.addEventListener('anomaly-update', (event: Event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as AnomalyUpdateEvent
          setLastUpdate(data)
          onUpdate?.(data)
          console.log('[Anomaly WebSocket] 收到更新:', data)
        } catch (err) {
          console.error('[Anomaly WebSocket] 解析消息失败:', err)
        }
      })

      eventSource.addEventListener('error', () => {
        console.error('[Anomaly WebSocket] SSE 连接错误')
        setIsConnected(false)
        setIsConnecting(false)
        setError(new Error('SSE 连接失败'))
        eventSource.close()
        eventSourceRef.current = null
      })

      eventSourceRef.current = eventSource
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知错误'))
      setIsConnecting(false)
    }
  }, [enabled, isConnecting, isConnected, onUpdate])

  const disconnect = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
    setError(null)
  }, [])

  // 自动连接和清理
  React.useEffect(() => {
    if (!enabled) {
      disconnect()
      return
    }

    // 延迟连接，避免在组件挂载时立即连接
    const timer = setTimeout(() => {
      connect()
    }, 500)

    return () => {
      clearTimeout(timer)
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected,
    isConnecting,
    error,
    lastUpdate,
    connect,
    disconnect,
  }
}
