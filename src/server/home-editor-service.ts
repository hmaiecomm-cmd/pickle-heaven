import { prisma } from '@/lib/db'
import { HomePageTheme } from '@prisma/client'

export type HomePageThemeType = 'purple' | 'green' | 'blue' | 'berry'

export interface HeroSection {
  title: string
  subtitle: string
  description: string
  imageId?: string
  buttonText: string
  buttonLink: string
}

export interface VisibilityFlags {
  plans: boolean
  coaching: boolean
  story: boolean
  visit: boolean
  invite: boolean
}

export interface HomePageConfigData {
  theme: HomePageThemeType
  hero: HeroSection
  selectedActivityIds: string[]
  visibility: VisibilityFlags
  [key: string]: unknown
}

export interface HomeEditorResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface HomePageConfigResult extends HomeEditorResult<HomePageConfigData> {}

export interface VersionHistoryItem {
  id: string
  theme: HomePageTheme
  config: HomePageConfigData
  versionType: 'DRAFT' | 'PUBLISHED'
  operatedBy: string
  createdAt: Date
  changeNote?: string
}

export interface VersionHistoryResult extends HomeEditorResult<VersionHistoryItem[]> {}

export async function getOrCreateHomePageConfig(): Promise<HomePageConfigResult> {
  try {
    let config = await prisma.homePageConfig.findFirst({
      include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!config) {
      const defaultConfig: HomePageConfigData = {
        theme: 'purple',
        hero: {
          title: '歡迎來到我們的球館',
          subtitle: '享受最佳的羽毛球體驗',
          description: '我們提供專業的場地和設備，歡迎各級球友來體驗。',
          buttonText: '立即預約',
          buttonLink: '/booking',
        },
        selectedActivityIds: [],
        visibility: {
          plans: true,
          coaching: true,
          story: true,
          visit: true,
          invite: true,
        },
      }

      config = await prisma.homePageConfig.create({
        data: {
          draftConfig: JSON.stringify(defaultConfig),
          publishedConfig: null,
          theme: 'PURPLE' as HomePageTheme,
        },
        include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      })
    }

    const draftConfig = JSON.parse(config.draftConfig) as HomePageConfigData

    return {
      success: true,
      data: draftConfig,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '取得首頁配置失敗',
    }
  }
}

export async function saveHomeDraft(configData: HomePageConfigData): Promise<HomePageConfigResult> {
  try {
    const config = await prisma.homePageConfig.findFirst({})

    if (!config) {
      return {
        success: false,
        error: '首頁配置不存在',
      }
    }

    const themeMapping: Record<HomePageThemeType, HomePageTheme> = {
      purple: 'PURPLE',
      green: 'GREEN',
      blue: 'BLUE',
      berry: 'BERRY',
    }

    const updated = await prisma.homePageConfig.update({
      where: { id: config.id },
      data: {
        draftConfig: JSON.stringify(configData),
        theme: themeMapping[configData.theme],
        draftUpdatedAt: new Date(),
      },
    })

    // 保存草稿版本快照
    await prisma.homePageVersion.create({
      data: {
        homePageConfigId: updated.id,
        config: JSON.stringify(configData),
        theme: themeMapping[configData.theme],
        versionType: 'DRAFT',
        operatedBy: 'system',
      },
    })

    return {
      success: true,
      data: configData,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存草稿失敗',
    }
  }
}

export async function publishHomeConfig(publishedBy: string = 'system'): Promise<HomePageConfigResult> {
  try {
    const config = await prisma.homePageConfig.findFirst({})

    if (!config) {
      return {
        success: false,
        error: '首頁配置不存在',
      }
    }

    const draftConfig = JSON.parse(config.draftConfig) as HomePageConfigData
    const themeMapping: Record<HomePageThemeType, HomePageTheme> = {
      purple: 'PURPLE',
      green: 'GREEN',
      blue: 'BLUE',
      berry: 'BERRY',
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 發布配置
      const result = await tx.homePageConfig.update({
        where: { id: config.id },
        data: {
          publishedConfig: config.draftConfig,
          publishedAt: new Date(),
          publishedBy,
          theme: themeMapping[draftConfig.theme],
        },
      })

      // 保存發布版本快照
      await tx.homePageVersion.create({
        data: {
          homePageConfigId: result.id,
          config: config.draftConfig,
          theme: themeMapping[draftConfig.theme],
          versionType: 'PUBLISHED',
          operatedBy: publishedBy,
        },
      })

      return result
    })

    return {
      success: true,
      data: draftConfig,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '發布首頁配置失敗',
    }
  }
}

export async function getPublishedConfig(): Promise<HomePageConfigResult> {
  try {
    const config = await prisma.homePageConfig.findFirst({})

    if (!config) {
      return {
        success: false,
        error: '首頁配置不存在',
      }
    }

    if (!config.publishedConfig) {
      return {
        success: false,
        error: '尚未發布任何版本',
      }
    }

    const publishedData = JSON.parse(config.publishedConfig) as HomePageConfigData

    return {
      success: true,
      data: publishedData,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '取得發布版本失敗',
    }
  }
}

export async function getDraftConfig(): Promise<HomePageConfigResult> {
  try {
    const config = await prisma.homePageConfig.findFirst({})

    if (!config) {
      return {
        success: false,
        error: '首頁配置不存在',
      }
    }

    const draftData = JSON.parse(config.draftConfig) as HomePageConfigData

    return {
      success: true,
      data: draftData,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '取得草稿版本失敗',
    }
  }
}

export async function getVersionHistory(): Promise<VersionHistoryResult> {
  try {
    const config = await prisma.homePageConfig.findFirst({})

    if (!config) {
      return {
        success: false,
        error: '首頁配置不存在',
      }
    }

    // 合併草稿和已發布版本，按時間倒序排列，最多 10 筆
    const versions = await prisma.homePageVersion.findMany({
      where: { homePageConfigId: config.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const historyItems: VersionHistoryItem[] = versions.map((v) => ({
      id: v.id,
      theme: v.theme,
      config: JSON.parse(v.config) as HomePageConfigData,
      versionType: v.versionType as 'DRAFT' | 'PUBLISHED',
      operatedBy: v.operatedBy,
      createdAt: v.createdAt,
      changeNote: v.changeNote || undefined,
    }))

    return {
      success: true,
      data: historyItems,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '取得版本歷史失敗',
    }
  }
}

export async function restoreVersion(versionId: string): Promise<HomePageConfigResult> {
  try {
    const version = await prisma.homePageVersion.findUnique({
      where: { id: versionId },
      include: { homePageConfig: true },
    })

    if (!version) {
      return {
        success: false,
        error: '版本不存在',
      }
    }

    const configData = JSON.parse(version.config) as HomePageConfigData
    const themeMapping: Record<HomePageThemeType, HomePageTheme> = {
      purple: 'PURPLE',
      green: 'GREEN',
      blue: 'BLUE',
      berry: 'BERRY',
    }

    // 恢復配置到草稿版本（發布版本不在恢復範圍內）
    const restored = await prisma.$transaction(async (tx) => {
      const updatedConfig = await tx.homePageConfig.update({
        where: { id: version.homePageConfigId },
        data: {
          draftConfig: version.config,
          theme: themeMapping[configData.theme],
          draftUpdatedAt: new Date(),
        },
      })

      // 保存恢復記錄為新的草稿版本快照
      await tx.homePageVersion.create({
        data: {
          homePageConfigId: updatedConfig.id,
          config: version.config,
          theme: themeMapping[configData.theme],
          versionType: 'DRAFT',
          operatedBy: 'system',
          changeNote: `恢復自版本 ${versionId}`,
        },
      })

      return updatedConfig
    })

    return {
      success: true,
      data: configData,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '恢復版本失敗',
    }
  }
}
