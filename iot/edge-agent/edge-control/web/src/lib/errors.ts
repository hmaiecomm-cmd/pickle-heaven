import { ApiError } from '../api/client';

/** Chinese explanations for stable error codes. The raw `code` and server message are always shown as well. */
export const ERROR_HINTS: Record<string, string> = {
  // auth
  invalid_token: 'Token 不正確。',
  unauthorized: '尚未登入或登入已過期。',
  csrf_required: '缺少 CSRF 標頭（請重新整理頁面）。',
  insufficient_role: '目前角色沒有此操作的權限。',
  site_mismatch: 'site／edge 身分與此 Edge 不符。',
  // control
  policy_denied: '政策引擎拒絕此操作。',
  circuit_always_on_protected: '24h 常供電／Bypass 迴路，軟體不會切換。',
  circuit_reserved: '預留迴路不可操作。',
  circuit_unbound: '此迴路尚未綁定控制器輸出。',
  mapping_not_active: '位址映射尚未套用為 active。',
  critical_power_protected: '關鍵電源迴路禁止關閉。',
  unsupported_feature: '此設備不支援該功能。',
  rate_limited: '操作過於頻繁，請稍後再試。',
  // mapping
  revision_conflict: '有其他人已修改過資料（版本衝突）。請重新載入後再編輯，避免覆蓋他人修改。',
  mapping_busy_bus: '匯流排上仍有執行中的命令，請待閒置後再套用。',
  mapping_active_sessions: '受影響的攝影機仍有影像工作階段，請先停止它們再套用。',
  validation_failed: '草稿未通過驗證，請先修正錯誤。',
  no_draft: '目前沒有草稿可套用。',
  invalid_deployment: '部署資料格式不正確。',
  bad_address: '位址格式不正確。',
  maintenance_mode_required: '維護模式未開啟（policies.yaml 的 maintenance_mode），不可進行輸出測試。',
  confirmation_mismatch: '確認的迴路編號不一致。',
  revision_not_found: '找不到該版本。',
  // media
  no_recording: '此時段沒有錄影。',
  camera_unbound: '攝影機尚未綁定 NVR 通道。',
  camera_capability_unavailable: '此攝影機未啟用該能力（即時／搜尋／回放需分別確認）。',
  resource_limit: '伺服器資源已達上限（同時串流數），請先停止其他影像。',
  session_limit_per_actor: '你的同時串流數已達上限，請先停止其他影像。',
  prepare_timeout: '準備串流逾時，來源可能無回應。',
  source_unavailable: '影像來源（NVR／攝影機）無法連線。',
  media_tool_missing: '伺服器缺少 ffmpeg 等媒體工具。',
  media_gateway_unavailable: '媒體閘道（MediaMTX）無法連線。',
  delivery_target_not_configured: '此傳送目標尚未設定。',
  invalid_time: '時間格式不正確（需 ISO-8601 並含時區）。',
  invalid_range: '結束時間必須晚於開始時間。',
  range_too_large: '單次查詢區間最多 15 天。',
  network_error: '無法連線到 Edge 服務。',
};

export function hintFor(code: string): string | undefined {
  return ERROR_HINTS[code];
}

export function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Error) return new ApiError(0, 'client_error', e.message);
  return new ApiError(0, 'client_error', String(e));
}
