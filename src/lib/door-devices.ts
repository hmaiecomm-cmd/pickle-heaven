/** 可遠端開啟的門禁設備。控制器型號、通道與脈衝時間需依實際門禁控制器規格調整。 */
export const MAIN_DOOR = {
  id: 'main-entrance',
  name: '球場主要入口',
  location: '出入口（建築右側）',
  /** 瞬間開門脈衝秒數（建議值；接上控制器後依規格設定） */
  pulseSeconds: 3,
} as const

/** 同一扇門兩次開門指令的最短間隔 */
export const DOOR_COOLDOWN_SECONDS = 10

/** 等待設備確認的上限，超過視為逾時 */
export const DOOR_ACK_TIMEOUT_SECONDS = 10
