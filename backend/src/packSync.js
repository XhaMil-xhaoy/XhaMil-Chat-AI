import fs from 'fs'
import path from 'path'
import {
  loadConfig,
  PACK_BASE_DIR,
  getPublicSiteUrl
} from './config.js'
import { getDownloadPageConfig, resolveDownloadApkPath } from './downloadPage.js'
import { parseApkMeta } from './apkMeta.js'

const BASE_APK = path.join(PACK_BASE_DIR, 'app.apk')
const VERSION_JSON = path.join(PACK_BASE_DIR, 'version.json')

function normalizeOfficialBaseUrl(value) {
  const raw = String(value ?? '').trim().replace(/\/+$/, '')
  return raw || 'https://ask.xhamil.com'
}

function readLocalVersion() {
  try {
    if (!fs.existsSync(VERSION_JSON)) return null
    return JSON.parse(fs.readFileSync(VERSION_JSON, 'utf8'))
  } catch {
    return null
  }
}

function writeLocalVersion(info) {
  fs.mkdirSync(PACK_BASE_DIR, { recursive: true })
  fs.writeFileSync(
    VERSION_JSON,
    JSON.stringify(
      {
        versionName: info.versionName || '',
        versionCode: Number(info.versionCode) || 0,
        packageName: info.packageName || '',
        syncedAt: new Date().toISOString(),
        source: info.source || 'download-page'
      },
      null,
      2
    )
  )
}

function isSelfOfficial(officialBase) {
  const site = getPublicSiteUrl(loadConfig()).replace(/\/+$/, '')
  const off = normalizeOfficialBaseUrl(officialBase)
  if (!site || !off) return false
  try {
    const a = new URL(site)
    const b = new URL(off.startsWith('http') ? off : `https://${off}`)
    return a.hostname === b.hostname
  } catch {
    return site === off
  }
}

/** 本机官方：复制「下载页面」当前选用包（不是 App 发版） */
async function copyFromLocalDownloadPage() {
  const page = getDownloadPageConfig()
  const src = page.apkFilename ? resolveDownloadApkPath(page.apkFilename) : null
  if (!src) throw new Error('本机下载页尚无安装包，请先在「下载页面」上传并选用')
  const meta = await parseApkMeta(src)
  fs.mkdirSync(PACK_BASE_DIR, { recursive: true })
  fs.copyFileSync(src, BASE_APK)
  writeLocalVersion({
    versionName: meta.versionName || page.versionName,
    versionCode: meta.versionCode || page.versionCode,
    packageName: meta.packageName || '',
    source: `download-page:${path.basename(src)}`
  })
  return readLocalVersion()
}

async function fetchOfficialBaseInfo(officialBase) {
  const url = `${normalizeOfficialBaseUrl(officialBase)}/api/config/base-apk`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const body = await res.json().catch(() => ({}))
  const data = body?.data ?? body
  if (!res.ok) {
    throw new Error(data?.message || body?.message || `读取官方底包信息失败 (${res.status})`)
  }
  if (!data?.ready) {
    throw new Error('官方下载页暂无可用底包')
  }
  return data
}

async function downloadOfficialApk(officialBase) {
  const root = normalizeOfficialBaseUrl(officialBase)
  const ticketRes = await fetch(`${root}/api/download-page/ticket`, { method: 'POST' })
  const ticketBody = await ticketRes.json().catch(() => ({}))
  const ticketData = ticketBody?.data ?? ticketBody
  if (!ticketRes.ok) {
    throw new Error(ticketData?.message || ticketBody?.message || '获取下载票据失败')
  }
  const apkUrl = String(ticketData.apkUrl || '').trim()
  if (!apkUrl) throw new Error('官方站未返回下载地址')
  const fullUrl = apkUrl.startsWith('http')
    ? apkUrl
    : `${root}${apkUrl.startsWith('/') ? '' : '/'}${apkUrl}`
  const apkRes = await fetch(fullUrl)
  if (!apkRes.ok) throw new Error(`下载官方底包失败 (${apkRes.status})`)
  const buf = Buffer.from(await apkRes.arrayBuffer())
  if (buf.length < 1024) throw new Error('下载到的安装包无效')
  fs.mkdirSync(PACK_BASE_DIR, { recursive: true })
  fs.writeFileSync(BASE_APK, buf)
}

/**
 * 打包前同步底包：
 * - 官方本机：复制本机「下载页面」选用包
 * - 其它部署：从 packOfficialBaseUrl 的下载页票据拉取
 */
export async function ensureLocalBaseFromOfficial(config = loadConfig()) {
  fs.mkdirSync(PACK_BASE_DIR, { recursive: true })
  const officialBase = normalizeOfficialBaseUrl(config.packOfficialBaseUrl)

  if (isSelfOfficial(officialBase)) {
    return copyFromLocalDownloadPage()
  }

  const remote = await fetchOfficialBaseInfo(officialBase)
  const local = readLocalVersion()
  const remoteCode = Number(remote.versionCode) || 0
  const localCode = Number(local?.versionCode) || 0
  const needDownload =
    !fs.existsSync(BASE_APK) || !local || remoteCode !== localCode

  if (needDownload) {
    await downloadOfficialApk(officialBase)
    writeLocalVersion({ ...remote, source: officialBase })
  }

  const cur = readLocalVersion()
  if (!cur?.versionName || !cur?.versionCode) {
    throw new Error('底包版本信息缺失')
  }
  return cur
}

export function readPackBaseVersion() {
  const local = readLocalVersion()
  if (local?.versionName && local?.versionCode) return local
  if (!fs.existsSync(BASE_APK)) {
    return { versionName: '', versionCode: 0, packageName: '' }
  }
  return local || { versionName: '', versionCode: 0, packageName: '' }
}

export function isPackUsingLocalDownloadPage(config = loadConfig()) {
  return isSelfOfficial(config.packOfficialBaseUrl)
}

export async function refreshPackBaseIfOfficialSelf() {
  const config = loadConfig()
  if (!isSelfOfficial(config.packOfficialBaseUrl)) return readPackBaseVersion()
  await copyFromLocalDownloadPage()
  return readLocalVersion()
}
