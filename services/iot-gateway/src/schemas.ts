import { LOG_UPLOAD_MAX_BYTES } from '@gh/iot-contract'
import { z } from 'zod'

/** 對外輸入一律驗證（地端與平台送來的 JSON） */

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), '必須是 ISO 8601 時間')
const circuitNo = z.string().regex(/^(0[1-9]|1[0-6])$/, '迴路編號為 01–16')
const onOff = z.enum(['ON', 'OFF'])
const circuitStates = z.record(circuitNo, onOff)

const logFile = z.enum(['edge', 'audit', 'modbus'])
const logLevel = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR'])

export const hold = z.object({ mode: z.enum(['NEXT_CHANGE', 'MINUTES', 'INDEFINITE']), until: isoDate.optional() })

export const edgeCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circuit.set'), circuit: circuitNo, state: onOff, hold, reason: z.string().max(200).optional() }),
  z.object({ type: z.literal('circuit.release'), circuit: circuitNo }),
  z.object({ type: z.literal('door.unlock'), door: z.string().min(1).max(40), seconds: z.number().int().min(1).max(60), reason: z.string().max(200).optional() }),
  z.object({ type: z.literal('status.report') }),
  z.object({ type: z.literal('plan.refresh') }),
  z.object({ type: z.literal('audio.play'), file: z.string().regex(/^[\w.-]{1,80}$/) }),
  // from < to 在 enqueue 時另外檢查（discriminatedUnion 不接受 refine）
  z.object({
    type: z.literal('log.upload'),
    files: z.array(logFile).min(1).max(3),
    from: isoDate,
    to: isoDate,
    minLevel: logLevel.optional(),
    maxBytes: z.number().int().min(1024).max(LOG_UPLOAD_MAX_BYTES).optional(),
  }),
])

export const heartbeat = z.object({
  agentVersion: z.string().min(1).max(40),
  localTime: isoDate,
  uptimeSec: z.number().nonnegative(),
  planRev: z.number().int().nullable(),
  pendingEvents: z.number().int().nonnegative().optional(),
})

export const ack = z.object({
  result: z.enum(['OK', 'FAILED', 'EXPIRED', 'REJECTED']),
  at: isoDate,
  error: z.string().max(500).optional(),
  circuits: circuitStates.optional(),
})

export const status = z.object({
  at: isoDate,
  planRev: z.number().int().nullable(),
  circuits: circuitStates,
  door: z.object({ locked: z.boolean(), contactOpen: z.boolean().optional() }).optional(),
  hardware: z
    .object({ modbus: z.enum(['OK', 'ERROR']), doorController: z.enum(['OK', 'ERROR']), speaker: z.enum(['OK', 'ERROR']).optional() })
    .optional(),
})

export const events = z.object({
  events: z
    .array(
      z.object({
        eventId: z.string().min(8).max(80),
        type: z.enum([
          'agent.started',
          'agent.recovered',
          'door.code_ok',
          'door.code_denied',
          'door.unlocked',
          'circuit.changed',
          'circuit.forced_off',
          'motion.unbooked',
          'audio.played',
          'hardware.error',
        ]),
        at: isoDate,
        data: z.record(z.unknown()).optional(),
      }),
    )
    .max(200),
})

export const upsertSite = z.object({ name: z.string().min(1).max(80), venueId: z.string().max(80).optional() })

export const enqueueCommand = z.object({
  id: z.string().min(8).max(80),
  command: edgeCommand,
  ttlSec: z.number().int().min(5).max(3600).optional(),
  requestedBy: z.string().max(80).optional(),
})

const circuitDef = z.object({
  no: circuitNo,
  name: z.string().max(80),
  kind: z.enum(['COURT', 'BUSINESS', 'NIGHT', 'ALWAYS_ON', 'RESERVED']),
  channel: z.number().int().min(1).max(16),
  court: z.string().max(20).optional(),
  remote: z.boolean(),
  schedule: z.boolean(),
  maxOnMinutes: z.number().int().positive().optional(),
})

export const sitePlan = z.object({
  contract: z.literal('gh-iot/1'),
  siteId: z.string(),
  generatedAt: isoDate,
  timezone: z.string().max(60),
  window: z.object({ from: isoDate, to: isoDate }),
  circuits: z.array(circuitDef).max(16),
  timeline: z
    .array(
      z.object({
        circuit: circuitNo,
        start: isoDate,
        end: isoDate,
        reason: z.enum(['BOOKING', 'EVENT', 'BLOCKED', 'BUSINESS_HOURS', 'NIGHT', 'CUSTOM']),
        ref: z.string().max(80).optional(),
      }),
    )
    .max(5000),
  overrides: z
    .array(z.object({ circuit: circuitNo, state: onOff, hold, baseline: onOff.optional(), by: z.string().max(80).optional() }))
    .max(16),
  doorCodes: z
    .array(
      z.object({
        id: z.string().max(80),
        code: z.string().regex(/^\d{4,10}$/),
        validFrom: isoDate,
        validTo: isoDate,
        slotType: z.string().max(60),
        doors: z.array(z.string().max(40)).min(1),
      }),
    )
    .max(2000),
  business: z.object({ openMinute: z.number().int(), closeMinute: z.number().int() }),
  audio: z.record(z.string()).optional(),
})

export const logUpload = z.object({
  from: isoDate,
  to: isoDate,
  files: z
    .array(z.object({ name: logFile, content: z.string(), lines: z.number().int().nonnegative(), truncated: z.boolean() }))
    .min(1)
    .max(3),
})
