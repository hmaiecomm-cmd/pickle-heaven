# 步驟 2：功能擴展實施狀態報告

**日期：** 2026-11-12  
**進度：** 準備中

## 📋 2FA 雙因素認證實施清單

### Phase 1：基礎設置
- [ ] 安裝 speakeasy 和 qrcode
  ```bash
  npm install speakeasy qrcode
  ```

- [ ] 更新 Prisma Schema
  ```bash
  # 添加 AdminMFA 模型
  npx prisma migrate dev --name add_mfa
  ```

### Phase 2：後端實現
- [ ] 創建 TOTP 服務（src/lib/totp-service.ts）
  - generateTOTPSecret()
  - verifyTOTP()
  - enableMFA()
  - verifyBackupCode()

- [ ] 創建 MFA API（src/app/api/admin/mfa/）
  - GET /setup - 生成 QR 碼
  - POST /verify - 驗證 TOTP
  - POST /disable - 禁用 MFA

### Phase 3：前端實現
- [ ] 創建 MFA 設置組件
  - QR 碼顯示
  - 驗證碼輸入
  - 備用碼顯示

### Phase 4：測試驗證
- [ ] 單元測試
- [ ] 整合測試
- [ ] E2E 測試

## ✅ 完成標準

- 用戶可成功設置 2FA
- QR 碼可被 Google Authenticator 掃描
- 備用碼可用於登入
- 系統正常記錄審計日誌

## 🎯 預計時間：2 小時
