/**
 * 拉取公开网页的 Open Graph / 标题摘要，供聊天链接卡片使用。
 * 禁止内网 SSRF；内存 + 磁盘缓存，避免每次打开聊天都重新抓取。
 */
import { isIP } from 'node:net'
import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天
const FETCH_TIMEOUT_MS = 6500
const MAX_BYTES = 512 * 1024
const memoryCache = new Map()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DISK_CACHE_DIR = path.resolve(__dirname, '../../json/link-preview-cache')

function ensureDiskDir() {
  try {
    fs.mkdirSync(DISK_CACHE_DIR, { recursive: true })
  } catch {
    /* ignore */
  }
}

function diskKey(url) {
  return crypto.createHash('sha1').update(String(url || '')).digest('hex')
}

function diskPath(url) {
  return path.join(DISK_CACHE_DIR, `${diskKey(url)}.json`)
}

function readDiskCache(keyHref) {
  try {
    const file = diskPath(keyHref)
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const expiresAt = Number(raw?.expiresAt || 0)
    if (!expiresAt || expiresAt <= Date.now() || !raw?.data) {
      try {
        fs.unlinkSync(file)
      } catch {
        /* ignore */
      }
      return null
    }
    return { expiresAt, data: raw.data }
  } catch {
    return null
  }
}

function writeDiskCache(keyHref, data, expiresAt) {
  try {
    ensureDiskDir()
    fs.writeFileSync(
      diskPath(keyHref),
      JSON.stringify({ expiresAt, data }),
      'utf8'
    )
  } catch {
    /* ignore */
  }
}

function pruneMemoryCache() {
  const now = Date.now()
  for (const [k, v] of memoryCache) {
    if (!v || (v.expiresAt || 0) <= now) memoryCache.delete(k)
  }
}

function pruneDiskCache() {
  try {
    ensureDiskDir()
    const files = fs.readdirSync(DISK_CACHE_DIR).filter((f) => f.endsWith('.json'))
    if (files.length <= 800) return
    const ranked = files
      .map((f) => {
        const p = path.join(DISK_CACHE_DIR, f)
        try {
          return { p, m: fs.statSync(p).mtimeMs }
        } catch {
          return { p, m: 0 }
        }
      })
      .sort((a, b) => a.m - b.m)
    for (const item of ranked.slice(0, files.length - 800)) {
      try {
        fs.unlinkSync(item.p)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
}

function stripTags(s) {
  return decodeHtmlEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function metaContent(html, keys) {
  for (const key of keys) {
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    )
    const m = html.match(re1) || html.match(re2)
    if (m?.[1]) {
      const v = decodeHtmlEntities(m[1]).trim()
      if (v) return v
    }
  }
  return ''
}

function pickTitle(html) {
  const og = metaContent(html, ['og:title', 'twitter:title'])
  if (og) return og
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1] ? stripTags(m[1]) : ''
}

function pickDescription(html) {
  return metaContent(html, ['og:description', 'twitter:description', 'description'])
}

function pickImage(html, pageUrl) {
  const raw = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])
  if (!raw) return ''
  try {
    return new URL(raw, pageUrl).href
  } catch {
    return ''
  }
}

function isPrivateIp(ip) {
  const v = String(ip || '').trim().toLowerCase()
  if (!v) return true
  if (v === '::1' || v === '0.0.0.0') return true
  if (v.startsWith('127.') || v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('169.254.')) {
    return true
  }
  const m = v.match(/^172\.(\d+)\./)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return true
  }
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
  return false
}

async function assertPublicHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    const err = new Error('不允许访问该地址')
    err.status = 400
    throw err
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      const err = new Error('不允许访问内网地址')
      err.status = 400
      throw err
    }
    return
  }
  let records
  try {
    records = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    const err = new Error('无法解析该网址')
    err.status = 400
    throw err
  }
  if (!records?.length || records.some((r) => isPrivateIp(r.address))) {
    const err = new Error('不允许访问内网地址')
    err.status = 400
    throw err
  }
}

function normalizeUrl(raw) {
  const text = String(raw || '').trim()
  if (!text) {
    const err = new Error('请提供网址')
    err.status = 400
    throw err
  }
  let u
  try {
    u = new URL(text)
  } catch {
    const err = new Error('网址格式不正确')
    err.status = 400
    throw err
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    const err = new Error('仅支持 http/https 网址')
    err.status = 400
    throw err
  }
  u.hash = ''
  return u
}

async function readLimitedText(res) {
  const reader = res.body?.getReader?.()
  if (!reader) {
    const t = await res.text()
    return t.slice(0, MAX_BYTES)
  }
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_BYTES) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - MAX_BYTES))))
      try {
        reader.cancel()
      } catch {
        /* ignore */
      }
      break
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ url: string, host: string, title: string, description: string, imageUrl: string, siteName: string }>}
 */
export async function fetchLinkPreview(rawUrl) {
  pruneMemoryCache()
  const u = normalizeUrl(rawUrl)
  const key = u.href
  const memHit = memoryCache.get(key)
  if (memHit && memHit.expiresAt > Date.now()) return memHit.data
  const diskHit = readDiskCache(key)
  if (diskHit) {
    memoryCache.set(key, diskHit)
    return diskHit.data
  }

  await assertPublicHost(u.hostname)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  let res
  try {
    res = await fetch(u.href, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; XhaMilLinkPreview/1.0; +https://ask.xhamil.com)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    })
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    const err = new Error(aborted ? '网页加载超时' : '无法打开该网址')
    err.status = aborted ? 504 : 502
    throw err
  } finally {
    clearTimeout(timer)
  }

  const finalUrl = String(res.url || u.href)
  const ctype = String(res.headers.get('content-type') || '').toLowerCase()
  if (!res.ok) {
    const err = new Error(`网页返回 ${res.status}`)
    err.status = 502
    throw err
  }
  if (ctype && !ctype.includes('text/html') && !ctype.includes('application/xhtml')) {
    const host = (() => {
      try {
        return new URL(finalUrl).hostname
      } catch {
        return u.hostname
      }
    })()
    const data = {
      url: finalUrl,
      host,
      title: host,
      description: '',
      imageUrl: '',
      siteName: host
    }
    const expiresAt = Date.now() + CACHE_TTL_MS
    memoryCache.set(key, { expiresAt, data })
    writeDiskCache(key, data, expiresAt)
    pruneDiskCache()
    return data
  }

  const html = await readLimitedText(res)
  const title = pickTitle(html).slice(0, 120)
  const description = pickDescription(html).slice(0, 240)
  const imageUrl = pickImage(html, finalUrl)
  const siteName = metaContent(html, ['og:site_name']).slice(0, 80)
  let host = u.hostname
  try {
    host = new URL(finalUrl).hostname
  } catch {
    /* keep */
  }
  const data = {
    url: finalUrl,
    host,
    title: title || host,
    description,
    imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : '',
    siteName: siteName || host
  }
  const expiresAt = Date.now() + CACHE_TTL_MS
  memoryCache.set(key, { expiresAt, data })
  writeDiskCache(key, data, expiresAt)
  pruneDiskCache()
  return data
}
