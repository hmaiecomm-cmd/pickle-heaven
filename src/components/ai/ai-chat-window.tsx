'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function AIChatWindow() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 自動滾動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 清理 EventSource
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setError(null)
    const userMessage = input.trim()
    setInput('')

    // 新增用戶訊息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage
    }
    setMessages(prev => [...prev, userMsg])

    // 新增 AI 回應佔位符
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: ''
    }])

    setIsLoading(true)

    try {
      // 關閉前一個 EventSource
      eventSourceRef.current?.close()

      // 建立 SSE 連接
      const eventSource = new EventSource(
        `/api/ai/chat?${new URLSearchParams({
          message: userMessage,
          pageName: document.title || 'Unknown'
        })}`
      )

      let buffer = ''

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.done) {
            eventSource.close()
            setIsLoading(false)
            return
          }

          if (data.error) {
            setError(data.error)
            eventSource.close()
            setIsLoading(false)
            return
          }

          if (data.content) {
            buffer += data.content
            // 更新 AI 回應
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: buffer } : msg
            ))
          }
        } catch (e) {
          console.error('Parse error:', e)
        }
      })

      eventSource.addEventListener('error', () => {
        eventSource.close()
        setIsLoading(false)
        if (buffer === '') {
          setError('連接失敗，請重試')
        }
      })

      eventSourceRef.current = eventSource
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤')
      setIsLoading(false)
    }
  }

  const clearMessages = () => {
    setMessages([])
    setError(null)
  }

  return (
    <>
      {/* AI 按鈕 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 hover:scale-110"
          aria-label="詢問小 P"
          title="詢問小 P"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* AI 視窗 */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 md:w-80 sm:fixed sm:bottom-0 sm:right-0 sm:left-0 sm:max-h-[70vh] sm:w-full sm:rounded-t-lg">
          {/* 標題欄 */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <h3 className="font-semibold">顧好 AI 助理</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-700 p-1 rounded"
              aria-label="關閉"
            >
              <X size={20} />
            </button>
          </div>

          {/* 訊息區域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">您好，我可以協助您查詢場館營運、預約、門禁與報表。</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 輸入區域 */}
          <div className="border-t p-3 bg-white rounded-b-lg">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="輸入您的問題..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition"
              >
                <Send size={18} />
              </button>
            </form>
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="mt-2 w-full text-sm text-gray-500 hover:text-gray-700"
              >
                清除對話
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
