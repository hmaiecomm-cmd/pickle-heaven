# Pickle Heaven V8-BC｜即時監控六路攝影機配置修正

**開始日期**：2026-11-16  
**預期完成日期**：待確認  
**狀態**：Phase 0 盤點完成 ⏳

---

## 階段進度

### Phase 0：現況盤點 ✅ 完成

#### 系統架構確認

| 項目 | 位置 | 狀態 |
|-----|------|------|
| 預設攝影機配置 | `src/lib/camera-layout.ts` | 需要更新 |
| 資料庫 schema | `prisma/schema.prisma` (MonitorCamera 表) | 已存在 |
| 服務層 | `src/server/camera-service.ts` | 無需改動 |
| 監控主頁面 | `src/app/admin/monitor/page.tsx` | 無需改動 |
| 即時影像 | `src/app/admin/monitor/live-view.tsx` | 無需改動 |
| 歷史回放 | `src/app/admin/monitor/playback-view.tsx` | 無需改動 |
| 事件紀錄 | `src/app/admin/monitor/events-view.tsx` | 無需改動 |
| 攝影機管理 | `src/app/admin/monitor/cameras-manager.tsx` | 無需改動 |

#### 攝影機配置差異表

| 編號 | 當前配置 | 需求配置（圖2） | 區域 | 座標 | 優先級 |
|-----|--------|--------|------|------|--------|
| 01 | 球場 A－中央 | QR 密碼鎖（門外） | courtA → entrance | 需更新 | 🔴 高 |
| 02 | 球場 A－側邊 | 門內監看（入口內側） | courtA → entrance | 需更新 | 🔴 高 |
| 03 | 室內休息區 | 休息區監看 | dining | 檢查位置 | 🟡 中 |
| 04 | 門口休息區 | 球場 A－中央 | deck → courtA | 需更新 | 🔴 高 |
| 05 | 球場 B－中央 | Pro Shop 內部 | courtB → proshop | 需更新 | 🔴 高 |
| 06 | 出入口／大門 | 球場 B－中央 | entrance → courtB | 需更新 | 🔴 高 |

#### 當前 DEFAULT_CAMERAS 原始碼
```typescript
// src/lib/camera-layout.ts 第 23-30 行
export const DEFAULT_CAMERAS: CameraDefaults[] = [
  { id: '01', name: '球場 A－中央', zone: 'courtA', x: 88, y: 44.2, facing: 90, coverage: '球場 A 全場（由中央上方俯拍）' },
  { id: '02', name: '球場 A－側邊', zone: 'courtA', x: 111.5, y: 53.5, facing: 180, coverage: '球場 A 側邊與邊線' },
  { id: '03', name: '室內休息區', zone: 'dining', x: 99, y: 19.5, facing: 165, coverage: '室內休息區座位、飲料販賣機' },
  { id: '04', name: '門口休息區', zone: 'deck', x: 110.5, y: 33.6, facing: 180, coverage: '門口旁戶外座位區與門口動線' },
  { id: '05', name: '球場 B－中央', zone: 'courtB', x: 35, y: 44.2, facing: 90, coverage: '球場 B 全場（由中央上方俯拍）' },
  { id: '06', name: '出入口／大門', zone: 'entrance', x: 111, y: 10, facing: 200, coverage: '大門與進出人員' },
]
```

#### Demo 影像狀態

| Camera | 檔案名稱 | 存放位置 | 狀態 | 備註 |
|--------|--------|--------|------|------|
| 01 | — | — | ❌ 待提供 | QR 密碼鎖參考圖已有 |
| 02 | — | — | ❌ 待提供 | 入口內側照片待確認 |
| 03 | cam03-indoor-lounge.jpg | public/monitor-demo/ | ✅ 有 | 室內休息區 |
| 04 | cam04-entrance-full.jpg | public/monitor-demo/ | ✅ 有 | 需重新對應為球場 A |
| 05 | — | — | ❌ 待提供 | Pro Shop 照片待確認 |
| 06 | — | — | ❌ 待提供 | 球場 B 照片待確認 |

**DEMO_MEDIA 原始碼** (src/lib/camera-layout.ts 49-52 行)：
```typescript
export const DEMO_MEDIA: Partial<Record<CameraId, { main: string; mainPosition: string; thumb: string; thumbPosition: string }>> = {
  '03': { main: '/monitor-demo/cam03-indoor-lounge.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam03-indoor-lounge.jpg', thumbPosition: '50% 55%' },
  '04': { main: '/monitor-demo/cam04-entrance-full.jpg', mainPosition: '50% 70%', thumb: '/monitor-demo/cam04-entrance-lounge.jpg', thumbPosition: '45% 60%' },
}
```

#### 參考圖片位置

| 圖編號 | 檔名 | 用途 | 狀態 |
|------|-----|------|------|
| 圖 1 | — | 當前球館平面圖 | ✅ 已確認 |
| 圖 2 | — | 監控配置參考圖（六路） | ✅ 已確認 |
| 圖 3 | — | 球場照片 A | ✅ 已確認 |
| 圖 4 | — | 球場照片 B（實為 DXD 外觀） | ✅ 已確認 |
| 圖 5 | — | 建築外觀 | ✅ 已確認 |
| 圖 6 | — | 大門（木門） | ✅ 已確認 |
| 圖 7 | — | 販賣機 | ✅ 已確認 |

#### Git 狀態

```
分支：main
遠端同步：✅ up to date
未提交檔案：4 個
  .backup-r0/ (備份目錄)
  docs/brand-source/29654.jpg (品牌圖片)
  docs/rebuild/ (重建文件)
  production-deployment-guide.html (部署指南)
最近 commit：b518bec (docs(dupr): DUPR 官方聯繫完整指南)
```

#### 平面圖座標參考
```
viewBox: 136 × 66
courtA: x=63–113, y=43–64 （球場 A）
courtB: x=8–62, y=43–64 （球場 B）
entrance: x=101–113, y=8–30 （出入口）
proshop: x=33–70, y=17–30 （Pro Shop）
dining: x=70–101, y=17–30 （桌區）
```

#### 資料庫連線狀態
- MonitorCamera 表：✅ 已存在（prisma/schema.prisma 第 2235 行）
- 資料庫儲存狀態：✅ ready（可讀寫）
- 當前行數：待確認（資料表可能為空或有舊資料）

---

### Phase 1：建立六路攝影機共用資料對照 ✅ 完成

**執行時間**：2026-11-16

#### 完成事項

✅ **DEFAULT_CAMERAS 配置更新**
```typescript
// src/lib/camera-layout.ts 第 23-30 行
01: 'QR 密碼鎖（門外）', entrance, (107, 8)
02: '門內監看（入口內側）', entrance, (107, 22)
03: '休息區監看', dining, (85, 23)
04: '球場 A－中央', courtA, (88, 53)
05: 'Pro Shop 內部', proshop, (51, 23)
06: '球場 B－中央', courtB, (35, 53)
```

✅ **DEMO_MEDIA 配置更新**  
已為六路攝影機定義 Demo 圖片路徑（實際圖片檔案待於 Phase 3–4 上傳）

✅ **修改檔案**
- `src/lib/camera-layout.ts` (13 insertions, 9 deletions)

✅ **Git Commit**
- 2f09cea: refactor(monitor): 六路攝影機配置修正 — Phase 1

✅ **驗證**
- 無 TypeScript 語法錯誤（既有的 EPERM 與 dupr-encryption 錯誤不由本次修改引起）
- Git Diff 已確認
- 修改限於攝影機配置，不涉及服務層

#### 後續工作

- Phase 2：修正球館平面圖攝影機標記與位置
- Phase 3：更新球場 A、B 的 Demo 影像
- Phase 4：更新入口、休息區及 Pro Shop 影像
- Phase 5：同步四個監控子頁面
- Phase 6：完整驗收
### Phase 2：修正球館平面圖攝影機標記與位置 ⏸️ 待執行
### Phase 3：更新球場 A、B 的 Demo 影像 ⏸️ 待執行
### Phase 4：更新入口、休息區及 Pro Shop 影像 ⏸️ 待執行
### Phase 5：同步即時影像、歷史回放、事件紀錄及攝影機管理 ⏸️ 待執行
### Phase 6：執行完整驗收 ⏸️ 待執行

---

## 尚需確認事項

1. **攝影機 01、02 的位置座標**  
   圖 2 中 01 標示於門外（QR 密碼鎖），02 於入口內側。需確認平面圖上的確切座標。

2. **攝影機 05 的拍攝位置**  
   目前標示為 Pro Shop 內部，需確認拍攝角度與座標。

3. **攝影機 03、04 的命名與拍攝範圍**  
   是否需要微調座標或拍攝角度？

4. **Demo 圖片來源**  
   - Camera 01（QR 密碼鎖）：提供的圖 6 是否可用？
   - Camera 02（入口內側）：是否有對應照片？
   - Camera 04、05、06：是否使用圖 3、4 或其他照片？

5. **舊攝影機資料清理**  
   MonitorCamera 表中是否有舊資料需要清理或保留？

---

## 回復方法

若需回到 Phase 0 前狀態：
```bash
git checkout HEAD -- src/lib/camera-layout.ts
git checkout HEAD -- src/lib/venue-layout.ts
# 其他檔案未修改
```

---

## 下一步

等待確認 Phase 0 盤點內容無誤後，執行 **Phase 1**。
