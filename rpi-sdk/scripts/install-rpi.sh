#!/bin/bash

# Pickle Heaven Gateway SDK 一鍵安裝腳本
# 適用於 Raspberry Pi OS (Debian 11+)

set -e

# ═════════════════════════════════════════════════════════════
# 配置
# ═════════════════════════════════════════════════════════════

SITE_ID=${1:-"pickle-heaven-001"}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname $(dirname $SCRIPT_DIR))"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Pickle Heaven Gateway SDK — Raspberry Pi 安裝            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "場館 ID: $SITE_ID"
echo "項目位置: $PROJECT_DIR"
echo ""

# 檢查權限
if [[ $EUID -ne 0 ]]; then
   echo "❌ 此腳本需要 sudo 權限"
   exit 1
fi

# ═════════════════════════════════════════════════════════════
# 步驟 1: 系統更新
# ═════════════════════════════════════════════════════════════

echo "📦 步驟 1: 系統更新..."
apt-get update
apt-get upgrade -y

# ═════════════════════════════════════════════════════════════
# 步驟 2: 安裝系統依賴
# ═════════════════════════════════════════════════════════════

echo "📦 步驟 2: 安裝系統依賴..."
apt-get install -y \
  mosquitto mosquitto-clients \
  nodejs npm \
  git \
  sqlite3 \
  build-essential \
  python3-dev \
  openssl

# ═════════════════════════════════════════════════════════════
# 步驟 3: 部署 MQTT Broker
# ═════════════════════════════════════════════════════════════

echo "🔧 步驟 3: 部署 MQTT Broker..."

# 複製配置檔案
cp "$PROJECT_DIR/mosquitto/mosquitto.conf" /etc/mosquitto/mosquitto.conf
cp "$PROJECT_DIR/mosquitto/acl.conf" /etc/mosquitto/acl.conf

# 調整擁有者
chown mosquitto:mosquitto /etc/mosquitto/mosquitto.conf
chown mosquitto:mosquitto /etc/mosquitto/acl.conf
chmod 644 /etc/mosquitto/mosquitto.conf
chmod 644 /etc/mosquitto/acl.conf

# 設置用戶（本地 Agent 密碼隨機生成）
AGENT_PASSWORD=$(openssl rand -base64 32)
bash "$PROJECT_DIR/mosquitto/setup-users.sh" "$SITE_ID" "$AGENT_PASSWORD"

# 啟動 Mosquitto
systemctl enable mosquitto
systemctl restart mosquitto

sleep 2
if systemctl is-active --quiet mosquitto; then
  echo "✓ Mosquitto 已啟動"
else
  echo "❌ Mosquitto 啟動失敗"
  exit 1
fi

# ═════════════════════════════════════════════════════════════
# 步驟 4: 部署 Gateway Agent
# ═════════════════════════════════════════════════════════════

echo "🔧 步驟 4: 部署 Gateway Agent..."

# 建立安裝目錄
mkdir -p /opt/pickle-heaven-gateway
cp -r "$PROJECT_DIR/gateway-agent/"* /opt/pickle-heaven-gateway/

# 修改擁有者
chown -R pi:pi /opt/pickle-heaven-gateway

# 安裝依賴
cd /opt/pickle-heaven-gateway
sudo -u pi npm install --production 2>&1 | tail -10

# ═════════════════════════════════════════════════════════════
# 步驟 5: 配置
# ═════════════════════════════════════════════════════════════

echo "⚙️  步驟 5: 配置..."

# 建立 .env 檔案
cp "$PROJECT_DIR/gateway-agent/.env.example" /opt/pickle-heaven-gateway/.env
sed -i "s/SITE_ID=.*/SITE_ID=$SITE_ID/" /opt/pickle-heaven-gateway/.env
sed -i "s/MQTT_PASSWORD=.*/MQTT_PASSWORD=$AGENT_PASSWORD/" /opt/pickle-heaven-gateway/.env

# 複製設備映射範本
cp "$PROJECT_DIR/config/device-mapping.json.example" /opt/pickle-heaven-gateway/config/device-mapping.json

# 建立必要目錄
mkdir -p /opt/pickle-heaven-gateway/data
mkdir -p /opt/pickle-heaven-gateway/logs
mkdir -p /var/log/pickle-heaven
chown pi:pi /opt/pickle-heaven-gateway/data
chown pi:pi /opt/pickle-heaven-gateway/logs

# 保存密碼到安全位置
mkdir -p /etc/pickle-heaven
chown root:root /etc/pickle-heaven
chmod 700 /etc/pickle-heaven

cat > /etc/pickle-heaven/gateway.env << EOF
SITE_ID=$SITE_ID
MQTT_PASSWORD=$AGENT_PASSWORD
EOF
chmod 600 /etc/pickle-heaven/gateway.env

echo "⚠ 配置已保存到 /etc/pickle-heaven/gateway.env"

# ═════════════════════════════════════════════════════════════
# 步驟 6: 編譯
# ═════════════════════════════════════════════════════════════

echo "🔨 步驟 6: 編譯..."
cd /opt/pickle-heaven-gateway
sudo -u pi npm run build 2>&1 | tail -5

# ═════════════════════════════════════════════════════════════
# 步驟 7: 安裝 Systemd 服務
# ═════════════════════════════════════════════════════════════

echo "📋 步驟 7: 安裝 Systemd 服務..."
cp "$PROJECT_DIR/systemd/pickle-heaven-gateway.service" \
  /etc/systemd/system/pickle-heaven-gateway.service

systemctl daemon-reload
systemctl enable pickle-heaven-gateway

# ═════════════════════════════════════════════════════════════
# 步驟 8: 啟動服務
# ═════════════════════════════════════════════════════════════

echo "🚀 步驟 8: 啟動 Gateway Agent..."
systemctl start pickle-heaven-gateway
sleep 3

# ═════════════════════════════════════════════════════════════
# 步驟 9: 驗證
# ═════════════════════════════════════════════════════════════

echo ""
echo "✅ 步驟 9: 驗證..."
echo ""

if systemctl is-active --quiet pickle-heaven-gateway; then
  echo "✓ Gateway Agent 已啟動"
  systemctl status pickle-heaven-gateway --no-pager
else
  echo "❌ Gateway Agent 啟動失敗（查看日誌）"
  journalctl -u pickle-heaven-gateway -n 20 --no-pager
  exit 1
fi

# ═════════════════════════════════════════════════════════════
# 完成
# ═════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✓ 安裝完成                                               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📝 下一步："
echo ""
echo "1. 編輯設備映射"
echo "   sudo nano /opt/pickle-heaven-gateway/config/device-mapping.json"
echo ""
echo "2. 查看日誌"
echo "   journalctl -u pickle-heaven-gateway -f"
echo ""
echo "3. 測試連線"
echo "   cd /opt/pickle-heaven-gateway"
echo "   npm run test:integration"
echo ""
echo "4. 檢查 MQTT 訂閱"
echo "   mosquitto_sub -u cloud_gateway -P 'cloud_secure_password' -t '$SITE_ID/control/+/data'"
echo ""
echo "⚠ 重要提醒："
echo "  - 編輯 device-mapping.json 設置正確的 Relay 設備地址"
echo "  - 根據實際 Relay 型號配置 RS-485 協議"
echo "  - 更新雲端配置指向此 Raspberry Pi 的 IP 地址"
echo ""
