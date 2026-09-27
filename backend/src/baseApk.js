import { loadConfig } from './config.js'
import { getDownloadPageConfig, resolveDownloadApkPath } from './downloadPage.js'
import { parseApkMeta } from './apkMeta.js'

/** 公开底包信息：来自「下载页面」当前选用包（不是 App 发版） */
export async function getBaseApkPublic(config = loadConfig()) {
  const page = getDownloadPageConfig(config)
  const apkPath = page.apkFilename ? resolveDownloadApkPath(page.apkFilename) : null
  const base = {
    ready: false,
    versionName: page.versionName || '',
    versionCode: page.versionCode || 0,
    packageName: '',
    source: 'download-page'
  }
  if (!page.enabled || !apkPath) return base
  let packageName = ''
  try {
    const meta = await parseApkMeta(apkPath)
    packageName = meta.packageName || ''
  } catch {
    packageName = ''
  }
  return {
    ready: true,
    versionName: page.versionName,
    versionCode: page.versionCode,
    packageName,
    source: 'download-page',
    ticketPath: '/api/download-page/ticket'
  }
}
