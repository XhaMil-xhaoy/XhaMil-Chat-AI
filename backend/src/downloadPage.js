import fs from 'fs'
import path from 'path'
import {
  loadConfig,
  saveConfig,
  DOWNLOAD_PAGE_DIR,
  DOWNLOAD_PAGE_LEGACY_DIR,
  DOWNLOAD_PAGE_BRAND_URL_PREFIX,
  encodeMediaPathUrl
} from './config.js'
import { parseApkMeta } from './apkMeta.js'

function normalizeBrandName(value) {
  return String(value ?? '').trim().slice(0, 40)
}

function normalizeTagline(value) {
  return String(value ?? '').trim().slice(0, 60)
}

function normalizeIconUrl(value) {
  const raw = String(value ?? '').trim().replace(/\\/g, '/')
  if (!raw) return ''
  if (raw.includes('..')) return ''
  if (raw.startsWith(DOWNLOAD_PAGE_BRAND_URL_PREFIX + '/')) {
    return encodeMediaPathUrl(raw) || raw
  }
  if (/^https?:\/\//i.test(raw)) return raw
  return ''
}

export function downloadPageIconUrlFromFilename(filename) {
  const name = path.basename(String(filename || ''))
  if (!name || name.includes('..')) throw new Error('无效文件名')
  return (
    encodeMediaPathUrl(`${DOWNLOAD_PAGE_BRAND_URL_PREFIX}/${name}`) ||
    `${DOWNLOAD_PAGE_BRAND_URL_PREFIX}/${name}`
  )
}

function normalizeApkFilename(value) {
  const raw = String(value ?? '').trim().replace(/\\/g, '/')
  if (!raw) return ''
  const base = path.basename(raw)
  if (!base.toLowerCase().endsWith('.apk')) return ''
  if (base.includes('..')) return ''
  return base
}

function migrateLegacyDownloadPageFiles() {
  try {
    if (!fs.existsSync(DOWNLOAD_PAGE_LEGACY_DIR)) return
    fs.mkdirSync(DOWNLOAD_PAGE_DIR, { recursive: true })
    const entries = fs.readdirSync(DOWNLOAD_PAGE_LEGACY_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.apk')) continue
      const src = path.join(DOWNLOAD_PAGE_LEGACY_DIR, entry.name)
      const dest = path.join(DOWNLOAD_PAGE_DIR, entry.name)
      if (fs.existsSync(dest)) {
        fs.unlinkSync(src)
        continue
      }
      fs.renameSync(src, dest)
    }
  } catch (e) {
    console.warn('[download-page] migrate legacy failed:', e?.message || e)
  }
}

function resolveApkFile(filename) {
  const name = normalizeApkFilename(filename)
  if (!name) return null
  const full = path.join(DOWNLOAD_PAGE_DIR, name)
  const resolved = path.resolve(full)
  const root = path.resolve(DOWNLOAD_PAGE_DIR)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  if (!fs.existsSync(resolved)) return null
  return resolved
}

/** 供票据下载 / 管理端使用 */
export function resolveDownloadApkPath(filename) {
  return resolveApkFile(filename)
}

function normalizeVersionCode(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function normalizeVersionName(value, fallback = '') {
  return String(value ?? '').trim() || fallback
}

export function ensureDownloadPageDir() {
  fs.mkdirSync(DOWNLOAD_PAGE_DIR, { recursive: true })
  migrateLegacyDownloadPageFiles()
  return DOWNLOAD_PAGE_DIR
}

export function listDownloadPageFiles() {
  ensureDownloadPageDir()
  const entries = fs.readdirSync(DOWNLOAD_PAGE_DIR, { withFileTypes: true })
  const list = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.apk'))
    .map((e) => {
      const full = path.join(DOWNLOAD_PAGE_DIR, e.name)
      const stat = fs.statSync(full)
      return {
        filename: e.name,
        url: `/api/admin/download-page/file/${encodeURIComponent(e.name)}`,
        size: stat.size,
        mtime: stat.mtimeMs
      }
    })
    .sort((a, b) => b.mtime - a.mtime)
  const totalSize = list.reduce((sum, item) => sum + item.size, 0)
  return { dir: 'backend/data/Download Page', list, totalSize }
}

export function getDownloadPageConfig(config = loadConfig()) {
  ensureDownloadPageDir()
  const apkFilename = normalizeApkFilename(config.downloadPageApkFilename)
  return {
    enabled: config.downloadPageEnabled !== false,
    source: 'download-page',
    apkFilename,
    apkUrl: apkFilename
      ? `/api/admin/download-page/file/${encodeURIComponent(apkFilename)}`
      : '',
    versionCode: normalizeVersionCode(config.downloadPageVersionCode, 0),
    versionName: normalizeVersionName(config.downloadPageVersionName, ''),
    title: String(config.downloadPageTitle || '').trim(),
    subtitle: String(config.downloadPageSubtitle || '').trim(),
    brandName: normalizeBrandName(config.downloadPageBrandName),
    tagline: normalizeTagline(config.downloadPageTagline),
    iconUrl: normalizeIconUrl(config.downloadPageIconUrl),
    pagePath: '/download/',
    protectedDownload: true
  }
}

/** 下载页公开接口 */
export function getDownloadPagePublic(config = loadConfig()) {
  const data = getDownloadPageConfig(config)
  const apkPath = data.apkFilename ? resolveApkFile(data.apkFilename) : null
  const hasFile = Boolean(apkPath)
  const show = data.enabled && hasFile
  let publishedAt = ''
  if (apkPath) {
    try {
      const mtime = fs.statSync(apkPath).mtime
      const y = mtime.getFullYear()
      const m = String(mtime.getMonth() + 1).padStart(2, '0')
      const d = String(mtime.getDate()).padStart(2, '0')
      publishedAt = `${y}-${m}-${d}`
    } catch {
      publishedAt = ''
    }
  }
  return {
    enabled: data.enabled,
    show,
    versionName: data.versionName,
    latestVersionCode: data.versionCode,
    versionCode: data.versionCode,
    publishedAt,
    title: data.title,
    subtitle: data.subtitle,
    brandName: data.brandName,
    tagline: data.tagline,
    iconUrl: data.iconUrl,
    source: 'download-page',
    ticketRequired: true,
    downloadReady: show
  }
}

export async function saveDownloadPageConfig(body = {}) {
  const current = getDownloadPageConfig()
  let apkFilename =
    body.apkFilename !== undefined
      ? normalizeApkFilename(body.apkFilename)
      : current.apkFilename
  let versionCode =
    body.versionCode !== undefined
      ? normalizeVersionCode(body.versionCode, current.versionCode)
      : current.versionCode
  let versionName =
    body.versionName !== undefined
      ? normalizeVersionName(body.versionName, current.versionName)
      : current.versionName

  if (apkFilename) {
    const full = resolveApkFile(apkFilename)
    if (!full) throw new Error('所选安装包不存在，请重新上传')
    const meta = await parseApkMeta(full)
    versionCode = meta.versionCode
    versionName = meta.versionName
  }

  const enabled = body.enabled !== undefined ? Boolean(body.enabled) : current.enabled
  const title =
    body.title !== undefined ? String(body.title || '').trim().slice(0, 80) : current.title
  const subtitle =
    body.subtitle !== undefined
      ? String(body.subtitle || '').trim().slice(0, 160)
      : current.subtitle
  const brandName =
    body.brandName !== undefined ? normalizeBrandName(body.brandName) : current.brandName
  const tagline =
    body.tagline !== undefined ? normalizeTagline(body.tagline) : current.tagline
  const iconUrl =
    body.iconUrl !== undefined ? normalizeIconUrl(body.iconUrl) : current.iconUrl

  if (enabled && (!apkFilename || !resolveApkFile(apkFilename))) {
    throw new Error('请先上传下载页使用的 APK')
  }

  saveConfig({
    downloadPageEnabled: enabled,
    downloadPageApkFilename: apkFilename,
    downloadPageVersionCode: versionCode,
    downloadPageVersionName: versionName,
    downloadPageTitle: title,
    downloadPageSubtitle: subtitle,
    downloadPageBrandName: brandName,
    downloadPageTagline: tagline,
    downloadPageIconUrl: iconUrl
  })
  return getDownloadPageConfig()
}

export async function applyUploadedDownloadPageApk(filename) {
  ensureDownloadPageDir()
  const name = normalizeApkFilename(filename)
  const full = resolveApkFile(name)
  if (!name || !full) throw new Error('APK 文件无效')
  const meta = await parseApkMeta(full)
  saveConfig({
    downloadPageApkFilename: name,
    downloadPageVersionCode: meta.versionCode,
    downloadPageVersionName: meta.versionName,
    downloadPageEnabled: true
  })
  return {
    filename: name,
    url: `/api/admin/download-page/file/${encodeURIComponent(name)}`,
    versionCode: meta.versionCode,
    versionName: meta.versionName,
    packageName: meta.packageName,
    config: getDownloadPageConfig()
  }
}

export async function selectDownloadPageApk(filename) {
  return applyUploadedDownloadPageApk(filename)
}

export function deleteDownloadPageFile(filename) {
  const name = normalizeApkFilename(filename)
  if (!name) throw new Error('无效的文件名')
  const full = path.join(DOWNLOAD_PAGE_DIR, name)
  if (!fs.existsSync(full)) throw new Error('文件不存在')
  fs.unlinkSync(full)
  const current = getDownloadPageConfig()
  if (current.apkFilename === name) {
    saveConfig({
      downloadPageApkFilename: '',
      downloadPageVersionCode: 0,
      downloadPageVersionName: ''
    })
  }
  return { deleted: name }
}

export function deleteAllDownloadPageFiles() {
  ensureDownloadPageDir()
  const entries = fs.readdirSync(DOWNLOAD_PAGE_DIR, { withFileTypes: true })
  let deleted = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.apk')) continue
    fs.unlinkSync(path.join(DOWNLOAD_PAGE_DIR, entry.name))
    deleted += 1
  }
  saveConfig({
    downloadPageApkFilename: '',
    downloadPageVersionCode: 0,
    downloadPageVersionName: ''
  })
  return { deleted, releases: listDownloadPageFiles() }
}
