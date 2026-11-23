import type { OnOff } from '../../../packages/iot-contract/src/index'

/**
 * 模擬現場硬體：M-7045（16 路 DO）、Soyal 門鎖、IP 廣播器。
 * 故障旗標可在情境中隨時切換。
 */
export interface HardwareFaults {
  /** 整個 Modbus 匯流排不通（RS-485 斷線） */
  modbusDown?: boolean
  /** 指定通道的繼電器卡住，寫入不會改變狀態 */
  stuckChannels?: number[]
  /** 寫入失敗機率 0–1 */
  writeFailRate?: number
  doorControllerDown?: boolean
}

export class FakeHardware {
  readonly relays: OnOff[] = Array.from({ length: 17 }, () => 'OFF') // index 1–16
  doorLocked = true
  readonly played: { file: string; at: number }[] = []
  readonly unlocks: { door: string; seconds: number; at: number }[] = []
  faults: HardwareFaults = {}

  /** 寫入 DO；成功回傳 true */
  writeRelay(channel: number, state: OnOff): boolean {
    if (this.faults.modbusDown) return false
    if (this.faults.writeFailRate && Math.random() < this.faults.writeFailRate) return false
    if (this.faults.stuckChannels?.includes(channel)) return true // 回報成功但實際沒動：要靠讀回比對發現
    this.relays[channel] = state
    return true
  }

  readRelay(channel: number): OnOff | null {
    if (this.faults.modbusDown) return null
    return this.relays[channel]
  }

  unlock(door: string, seconds: number, at: number): boolean {
    if (this.faults.doorControllerDown) return false
    this.doorLocked = false
    this.unlocks.push({ door, seconds, at })
    setTimeout(() => (this.doorLocked = true), Math.min(seconds, 5) * 1000).unref?.()
    return true
  }

  play(file: string, at: number) {
    this.played.push({ file, at })
  }
}
