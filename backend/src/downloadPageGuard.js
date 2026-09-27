import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { getClientIp, normalizeRegisterIp } from './clientIp.js'
import { loadConfig, saveConfig, ensureAdminEntryCode } from './config.js'
import { getDownloadPageConfig, resolveDownloadApkPath } from './downloadPage.js'

const TOKEN_TTL_MS = 3 * 60 * 1000
const TICKET_PER_MINUTE = 12
const TICKET_PER_HOUR = 80
const DOWNLOAD_PER_MINUTE = 4
const DOWNLOAD_PER_HOUR = 24
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

/** @type {Map<string, { minuteStart: number, minuteCount: number, hourStart: number, hourCount: number }>} */
const rateBuckets = new Map()
/** @type {Map<string, number>} jti -> expireAt */
const usedTickets = new Map()

function clientKey(req) {
  return normalizeRegisterIp(getClientIp(req)) || '0.0.0.0'
}

function bumpRate(key, perMinute, perHour, label) {
  const now = Date.now()
  let bucket = rateBuckets.get(key)
  if (!bucket) {
    bucket = { minuteStart: now, minuteCount: 0, hourStart: now, hourCount: 0 }
  }
  if (now - bucket.minuteStart >= MINUTE_MS) {
    bucket.minuteStart = now
    bucket.minuteCount = 0
  }
  if (now - bucket.hourStart >= HOUR_MS) {
    bucket.hourStart = now
    bucket.hourCount = 0
  }
  bucket.minuteCount += 1
  bucket.hourCount += 1
  rateBuckets.set(key, bucket)
  if (bucket.minuteCount > perMinute) {
    console.warn(`[download-guard] ${label} minute limit ip=${key} count=${bucket.minuteCount}`)
    const err = new Error('请求过于频繁，请稍后再试')
    err.status = 429
    throw err
  }
  if (bucket.hourCount > perHour) {
    console.warn(`[download-guard] ${label} hour limit ip=${key} count=${bucket.hourCount}`)
    const err = new Error('今日下载次数已达上限，请稍后再试')
    err.status = 429
    throw err
  }
}

function ensureSignSecret() {
  const cfg = loadConfig()
  const existing = String(cfg.downloadPageSignSecret || '').trim()
  if (existing && existing.length >= 32) return existing
  const seed = `${ensureAdminEntryCode()}:${crypto.randomBytes(24).toString('hex')}`
  const secret = crypto.createHash('sha256').update(seed).digest('hex')
  saveConfig({ downloadPageSignSecret: secret })
  return secret
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signPayload(payload) {
  const secret = ensureSignSecret()
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest())
}

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

function purgeUsedTickets() {
  const now = Date.now()
  for (const [jti, exp] of usedTickets) {
    if (exp <= now) usedTickets.delete(jti)
  }
  if (usedTickets.size > 5000) {
    const entries = [...usedTickets.entries()].sort((a, b) => a[1] - b[1])
    for (let i = 0; i < entries.length - 4000; i++) usedTickets.delete(entries[i][0])
  }
}

function publicDownloadName(versionName = '') {
  const ver = String(versionName || '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 32)
  return ver ? `XhaMil-${ver}.apk` : 'XhaMil.apk'
}

/**
 * 签发一次性短时下载票据（不暴露真实文件名）
 * @param {import('express').Request} req
 */
export function issueDownloadTicket(req) {
  bumpRate(`t:${clientKey(req)}`, TICKET_PER_MINUTE, TICKET_PER_HOUR, 'ticket')
  const cfg = getDownloadPageConfig()
  if (!cfg.enabled) {
    const err = new Error('下载已关闭')
    err.status = 403
    throw err
  }
  const apkPath = resolveDownloadApkPath(cfg.apkFilename)
  if (!apkPath) {
    const err = new Error('暂无安装包')
    err.status = 404
    throw err
  }
  const exp = Date.now() + TOKEN_TTL_MS
  const jti = crypto.randomBytes(16).toString('hex')
  const fileFp = crypto.createHash('sha256').update(cfg.apkFilename).digest('hex').slice(0, 16)
  const payload = `v1.${exp}.${jti}.${fileFp}`
  const sig = signPayload(payload)
  const qs = new URLSearchParams({
    e: String(exp),
    n: jti,
    f: fileFp,
    s: sig
  })
  return {
    apkUrl: `/api/download-page/apk?${qs.toString()}`,
    expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
    versionName: cfg.versionName,
    versionCode: cfg.versionCode,
    fileName: publicDownloadName(cfg.versionName)
  }
}

function parseAndVerifyTicket(query = {}) {
  const exp = Number(query.e)
  const jti = String(query.n || '').trim()
  const fileFp = String(query.f || '').trim()
  const sig = String(query.s || '').trim()
  if (!Number.isFinite(exp) || !jti || !fileFp || !sig) {
    const err = new Error('下载链接无效')
    err.status = 403
    throw err
  }
  if (!/^[a-f0-9]{16,64}$/i.test(jti) || !/^[a-f0-9]{16}$/i.test(fileFp)) {
    const err = new Error('下载链接无效')
    err.status = 403
    throw err
  }
  if (Date.now() > exp + 5000) {
    const err = new Error('下载链接已过期，请返回页面重新获取')
    err.status = 403
    throw err
  }
  const payload = `v1.${exp}.${jti}.${fileFp}`
  const expect = signPayload(payload)
  if (!timingSafeEqualStr(sig, expect)) {
    const err = new Error('下载链接校验失败')
    err.status = 403
    throw err
  }
  purgeUsedTickets()
  if (usedTickets.has(jti)) {
    const err = new Error('下载链接已使用，请返回页面重新获取')
    err.status = 403
    throw err
  }
  const cfg = getDownloadPageConfig()
  if (!cfg.enabled) {
    const err = new Error('下载已关闭')
    err.status = 403
    throw err
  }
  const currentFp = crypto.createHash('sha256').update(cfg.apkFilename).digest('hex').slice(0, 16)
  if (!timingSafeEqualStr(fileFp, currentFp)) {
    const err = new Error('安装包已更新，请刷新页面后重试')
    err.status = 409
    throw err
  }
  const apkPath = resolveDownloadApkPath(cfg.apkFilename)
  if (!apkPath) {
    const err = new Error('安装包不存在')
    err.status = 404
    throw err
  }
  usedTickets.set(jti, exp + 60_000)
  return { cfg, apkPath }
}

/**
 * 校验票据并流式下发 APK
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function serveDownloadApk(req, res) {
  bumpRate(`d:${clientKey(req)}`, DOWNLOAD_PER_MINUTE, DOWNLOAD_PER_HOUR, 'download')
  const { cfg, apkPath } = parseAndVerifyTicket(req.query || {})
  const fileName = publicDownloadName(cfg.versionName)
  const stat = fs.statSync(apkPath)

  res.setHeader('Content-Type', 'application/vnd.android.package-archive')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  res.setHeader('Content-Length', String(stat.size))
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Referrer-Policy', 'no-referrer')

  const stream = fs.createReadStream(apkPath)
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ code: 500, message: '读取安装包失败', data: null })
    else res.destroy()
  })
  stream.pipe(res)
}

/** 拦截 /media/Download Page 直链（兼容旧路径） */
export function blockDownloadPageMedia(req, res, next) {
  let raw = ''
  try {
    raw = decodeURIComponent(req.path || '')
  } catch {
    raw = String(req.path || '')
  }
  if (/^\/media\/Download Page(\/|$)/i.test(raw)) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(403).type('text/plain; charset=utf-8').send('Forbidden')
  }
  return next()
}

/** 下载落地页静态资源安全响应头 */
export function downloadPageStaticHeaders(res, filePath) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (/\.html?$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "script-src 'self'",
        "connect-src 'self'",
        "form-action 'self'"
      ].join('; ')
    )
    return
  }
  if (/\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800')
  }
}

/** 管理后台鉴权后直下（不走公开票据） */
export function serveAdminDownloadFile(filename, res) {
  const apkPath = resolveDownloadApkPath(filename)
  if (!apkPath) {
    const err = new Error('文件不存在')
    err.status = 404
    throw err
  }
  const safeName = path.basename(apkPath)
  res.download(apkPath, safeName)
}
