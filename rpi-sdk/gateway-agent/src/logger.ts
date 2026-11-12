/**
 * 結構化日誌系統 — Winston
 */

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logsDir = path.join(__dirname, '../logs')

/**
 * 日誌等級
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * 結構化日誌標籤
 */
export interface LogContext {
  module?: string
  circuitId?: string
  commandId?: string
  deviceId?: string
  [key: string]: any
}

class Logger {
  private winstonLogger: winston.Logger

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production'
    const isDevelopment = process.env.NODE_ENV === 'development'

    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    )

    const transports: winston.transport[] = [
      // 控制臺輸出
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            return `${timestamp} [${level}] ${message} ${metaStr}`
          })
        ),
        level: isDevelopment ? 'debug' : 'info',
      }),

      // 所有日誌檔案（日輪轉）
      new DailyRotateFile({
        filename: path.join(logsDir, 'gateway-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxDays: '30',
        format,
      }),

      // 錯誤日誌單獨檔案
      new DailyRotateFile({
        filename: path.join(logsDir, 'errors-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxDays: '30',
        level: 'error',
        format,
      }),
    ]

    this.winstonLogger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      format,
      transports,
      exceptionHandlers: [
        new DailyRotateFile({
          filename: path.join(logsDir, 'exceptions-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxDays: '30',
        }),
      ],
    })
  }

  /**
   * 記錄一般信息
   */
  info(message: string, context?: LogContext): void {
    this.winstonLogger.info(message, context || {})
  }

  /**
   * 記錄警告
   */
  warn(message: string, context?: LogContext): void {
    this.winstonLogger.warn(message, context || {})
  }

  /**
   * 記錄錯誤
   */
  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.winstonLogger.error(message, { error: error.message, stack: error.stack, ...context })
    } else {
      this.winstonLogger.error(message, error || context || {})
    }
  }

  /**
   * 記錄調試信息
   */
  debug(message: string, context?: LogContext): void {
    this.winstonLogger.debug(message, context || {})
  }

  /**
   * 記錄命令執行
   */
  logCommand(commandId: string, circuitId: string, action: string, details?: any): void {
    this.info(`命令執行：${action}`, {
      module: 'CommandProcessor',
      commandId,
      circuitId,
      ...details,
    })
  }

  /**
   * 記錄設備回報
   */
  logDeviceResponse(circuitId: string, state: string, details?: any): void {
    this.info(`設備回報：${circuitId} → ${state}`, {
      module: 'RS485Adapter',
      circuitId,
      state,
      ...details,
    })
  }

  /**
   * 記錄健康檢查
   */
  logHealthCheck(status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR', details?: any): void {
    const level = status === 'HEALTHY' ? 'info' : status === 'DEGRADED' ? 'warn' : 'error'
    this.winstonLogger[level](`健康檢查：${status}`, {
      module: 'Watchdog',
      status,
      ...details,
    })
  }
}

export const logger = new Logger()
