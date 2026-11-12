#!/bin/bash

# Mosquitto 用戶與密碼設置腳本
# 用法: ./setup-users.sh <site_id> [agent_password]

set -e

SITE_ID=${1:-"pickle-heaven-001"}
AGENT_PASSWORD=${2:-$(openssl rand -base64 32)}

echo "═══════════════════════════════════════════════════════════"
echo "Mosquitto 用戶設置 — $SITE_ID"
echo "═══════════════════════════════════════════════════════════"

# 1. 建立密碼檔案
echo ""
echo "1. 建立密碼檔案..."
sudo bash -c "mosquitto_passwd -c -b /etc/mosquitto/passwd cloud_gateway 'cloud_secure_password' > /dev/null"

# 2. 新增本地 Agent 用戶
echo "2. 新增本地 Agent 用戶..."
sudo bash -c "mosquitto_passwd -b /etc/mosquitto/passwd local_agent '$AGENT_PASSWORD' > /dev/null"

# 3. 新增監控用戶
echo "3. 新增監控用戶..."
MONITOR_PASSWORD=$(openssl rand -base64 32)
sudo bash -c "mosquitto_passwd -b /etc/mosquitto/passwd admin_monitor '$MONITOR_PASSWORD' > /dev/null"

# 4. 新增橋接用戶
echo "4. 新增橋接用戶..."
BRIDGE_PASSWORD=$(openssl rand -base64 32)
sudo bash -c "mosquitto_passwd -b /etc/mosquitto/passwd bridge_user '$BRIDGE_PASSWORD' > /dev/null"

# 5. 設置權限
echo "5. 設置檔案權限..."
sudo chown mosquitto:mosquitto /etc/mosquitto/passwd
sudo chmod 600 /etc/mosquitto/passwd

# 6. 重啟 Mosquitto
echo ""
echo "6. 重啟 Mosquitto..."
sudo systemctl restart mosquitto

sleep 2

# 7. 驗證
echo ""
echo "7. 驗證設置..."
sudo systemctl status mosquitto --no-pager

# 8. 輸出密碼（臨時保存，待安全存儲）
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✓ 用戶設置完成"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⚠ 重要：請妥善保管以下密碼，並將其存儲在安全的環境變數中"
echo ""
echo "  cloud_gateway 密碼（雲端用）:"
echo "    cloud_secure_password"
echo ""
echo "  local_agent 密碼（樹莓派 Agent 用）:"
echo "    $AGENT_PASSWORD"
echo ""
echo "  admin_monitor 密碼（監控用）:"
echo "    $MONITOR_PASSWORD"
echo ""
echo "  bridge_user 密碼（橋接用）:"
echo "    $BRIDGE_PASSWORD"
echo ""
echo "建議保存位置: /etc/pickle-heaven/secrets.env"
echo "═══════════════════════════════════════════════════════════"
