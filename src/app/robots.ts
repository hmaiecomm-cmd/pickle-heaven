import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/config/site'

/** 後台與 API 不進搜尋引擎；這只是避免被索引，登入與權限仍由後端驗證 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    host: SITE_URL,
  }
}
