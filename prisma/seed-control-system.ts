/**
 * 種子腳本：初始化電力控制系統
 *
 * 執行: npm run db:seed
 * 或單獨執行: tsx prisma/seed-control-system.ts
 */

import { PrismaClient } from '@prisma/client'
import { CIRCUIT_DEFINITIONS } from '../src/lib/control-types'
import { SIMULATION_DEVICE_CONFIG, SIMULATION_CIRCUIT_TO_RELAY_MAPPING } from '../src/lib/device-config'

const prisma = new PrismaClient()

async function seedControlSystem() {
  console.log('🌱 開始初始化電力控制系統...\n')

  // 取得或建立預設場館
  let venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
  })

  if (!venue) {
    console.log('⚠️  找不到場館，請先建立場館後再執行本腳本')
    return
  }

  console.log(`✓ 使用場館: ${venue.name}`)

  // 初始化 18 路回路
  console.log('\n📍 初始化 18 路回路...')
  for (const [circuitNum, def] of Object.entries(CIRCUIT_DEFINITIONS)) {
    const existing = await prisma.circuit.findUnique({
      where: { circuitNumber: circuitNum },
    })

    if (existing) {
      console.log(`  ✓ 迴路 ${circuitNum}: 已存在`)
      continue
    }

    const mapping = SIMULATION_CIRCUIT_TO_RELAY_MAPPING[circuitNum]

    const circuit = await prisma.circuit.create({
      data: {
        venueId: venue.id,
        circuitNumber: circuitNum as any,
        name: def.name,
        description: def.description,
        category: def.category as any,
        enabled: def.defaultEnabled,
        remoteControlEnabled: def.remoteControlEnabled,
        scheduleControlEnabled: def.scheduleControlEnabled,
        deviceMapping: mapping
          ? {
              deviceMacId: mapping.macId,
              channel: mapping.channel,
              onValue: mapping.onValue,
              offValue: mapping.offValue,
            }
          : null,
        expectedState: null,
        actualState: null,
      },
    })

    console.log(
      `  ✓ 迴路 ${circuitNum}: ${def.name} (${def.category})`,
      def.defaultEnabled ? '' : '【停用】',
    )
  }

  // 初始化營業時間與夜間排程
  console.log('\n⏰ 初始化營業時間與夜間排程...')
  const existingHours = await prisma.operatingHours.findUnique({
    where: { venueId: venue.id },
  })

  if (existingHours) {
    console.log('  ✓ 營業時間: 已存在')
  } else {
    await prisma.operatingHours.create({
      data: {
        venueId: venue.id,
        businessStartMinute: 480, // 08:00
        businessEndMinute: 1320, // 22:00
        nightStartMinute: 1080, // 18:00
        nightEndMinute: 1320, // 22:00
        disabledDates: '',
        applicableWeekdays: '0,1,2,3,4,5,6',
      },
    })
    console.log('  ✓ 營業時間: 08:00-22:00')
    console.log('  ✓ 夜間時段: 18:00-22:00')
  }

  // 初始化模擬設備適配器
  console.log('\n🔧 初始化設備適配器...')
  const existingAdapter = await prisma.deviceAdapter.findFirst({
    where: { venueId: venue.id },
  })

  if (existingAdapter) {
    console.log(`  ✓ 設備適配器: 已存在 (${existingAdapter.name})`)
  } else {
    const adapter = await prisma.deviceAdapter.create({
      data: {
        venueId: venue.id,
        name: SIMULATION_DEVICE_CONFIG.name,
        deviceType: SIMULATION_DEVICE_CONFIG.deviceType,
        macId: SIMULATION_DEVICE_CONFIG.macId,
        mqttBrokerUrl: SIMULATION_DEVICE_CONFIG.mqtt.brokerUrl,
        mqttPort: SIMULATION_DEVICE_CONFIG.mqtt.port,
        mqttUseTls: SIMULATION_DEVICE_CONFIG.mqtt.useTls,
        mqttUsername: SIMULATION_DEVICE_CONFIG.mqtt.username,
        mqttPassword: SIMULATION_DEVICE_CONFIG.mqtt.password,
        mqttTopicPrefix: SIMULATION_DEVICE_CONFIG.mqttTopicPrefix,
        totalChannels: SIMULATION_DEVICE_CONFIG.totalChannels,
        mqttControlTopic: SIMULATION_DEVICE_CONFIG.controlTopicTemplate,
        mqttStatusTopic: SIMULATION_DEVICE_CONFIG.statusTopic,
        deviceStateMapping: SIMULATION_DEVICE_CONFIG.stateMapping,
        enabled: true,
        connectionStatus: 'UNKNOWN',
      },
    })

    console.log(`  ✓ 設備適配器: ${adapter.name}`)
    console.log(`    - MAC ID: ${adapter.macId}`)
    console.log(`    - 通道數: ${adapter.totalChannels}`)
    console.log(`    - Topic 前綴: ${adapter.mqttTopicPrefix}`)
  }

  console.log('\n✨ 電力控制系統初始化完成！\n')
  console.log('📋 後續步驟:')
  console.log('  1. 驗證 18 路迴路是否正確建立')
  console.log('  2. 在 /admin/control 頁面檢視迴路狀態')
  console.log('  3. 根據實際設備參數更新 DeviceAdapter 配置')
  console.log('  4. 在無人化控制頁面測試命令下發\n')
}

seedControlSystem()
  .catch((e) => {
    console.error('❌ 初始化失敗:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
