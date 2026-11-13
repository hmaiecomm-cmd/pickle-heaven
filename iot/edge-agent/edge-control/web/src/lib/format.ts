// Formatting + label helpers. All displayed times use Asia/Taipei.

export const TZ = 'Asia/Taipei';

const dtf = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return dtf.format(d);
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO instant -> value for <input type="datetime-local"> expressed in Asia/Taipei. */
export function isoToTaipeiLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** <input type="datetime-local"> value (interpreted as Asia/Taipei) -> ISO-8601 with +08:00. */
export function taipeiLocalToIso(local: string): string {
  let v = local.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += ':00';
  return `${v}+08:00`;
}

export function taipeiLocalToDate(local: string): Date {
  return new Date(taipeiLocalToIso(local));
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} 小時 ${m} 分`;
  if (m) return `${m} 分 ${sec} 秒`;
  return `${sec} 秒`;
}

export function fmtWatt(w: number | null | undefined): string {
  return w === null || w === undefined ? '待確認' : `${w.toLocaleString('en-US')} W`;
}

export function dash(v: unknown): string {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

// ---------------------------------------------------------------- label maps
export const COMMAND_STATUS_LABEL: Record<string, string> = {
  accepted: '已接受（排隊中）',
  running: '執行中',
  succeeded: '成功',
  failed: '失敗',
  expired: '已逾時',
  unknown: '結果未知',
};

export const VERIFICATION_LABEL: Record<string, string> = {
  confirmed: '硬體已確認',
  unverified: '未驗證',
  unknown: '未知',
};

export const VERIFICATION_TIP =
  '通訊成功不等於負載已確認：只有「硬體已確認」才表示有獨立回讀證實；「未驗證」代表命令送出成功但沒有回讀依據。';

export const CONTROL_MODE_LABEL: Record<string, string> = {
  reservation: '跟隨預約',
  business_hours: '營業時間',
  night_hours: '夜間',
  always_on_bypass: '24h常供電/Bypass',
  reserved: '預留',
};

export const WIRING_LABEL: Record<string, string> = {
  relay_switched: '繼電器切換',
  hardware_bypass: '硬體 Bypass',
  reserved: '預留',
  unconfirmed: '未確認',
};

export const MAPPING_STATUS_LABEL: Record<string, string> = {
  unbound: '未綁定',
  draft: '草稿',
  validated: '已驗證',
  active: '已啟用',
};

export const MAPPING_STATUS_TIP =
  '未綁定：尚無輸出綁定；草稿：已填寫但尚未通過驗證；validated：設定驗證通過，不表示硬體已測試；active：已套用並生效。';

export const INOPERABLE_LABEL: Record<string, string> = {
  circuit_always_on_protected: '24h 常供電／Bypass 迴路，軟體不會切換',
  circuit_reserved: '預留迴路，未啟用且不可綁定輸出',
  circuit_unbound: '尚未綁定控制器輸出',
  mapping_not_active: '位址映射尚未套用（狀態非 active）',
  critical_power_protected: '關鍵電源迴路，禁止關閉',
  controller_missing: '綁定的控制器不存在',
  simulation_mapping_in_real_mode: '模擬映射不可在真實模式驅動實體輸出',
  circuit_not_found: '找不到此迴路',
};

export const HVAC_MODE_LABEL: Record<string, string> = {
  cool: '冷氣',
  heat: '暖氣',
  fan: '送風',
  dry: '除濕',
  auto: '自動',
};

export const SESSION_PHASE_LABEL: Record<string, string> = {
  idle: '待機',
  creating: '建立工作階段…',
  preparing: '準備串流中…',
  connecting: 'WebRTC 連線中…',
  playing: '播放中',
  failed: '失敗',
  stopped: '已停止',
  expired: '已到期',
};

export const ROLE_LABEL: Record<string, string> = { viewer: '檢視者', operator: '操作員', admin: '管理員' };

/** requested/reported state values come back JSON-decoded: 'on'|'off'|boolean|object|null */
export function fmtState(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (v === 'on' || v === true) return '開';
  if (v === 'off' || v === false) return '關';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && typeof (v as { on?: unknown }).on === 'boolean') return (v as { on: boolean }).on ? '開' : '關';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function bytesOrJson(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const secFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Date -> ISO-8601 string in Asia/Taipei with explicit +08:00 offset (second precision). */
export function dateToTaipeiIso(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of secFmt.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
}
