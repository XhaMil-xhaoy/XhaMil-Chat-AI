import { Router } from 'express'
import { loadConfig, isAllowedExternalStickerUrl } from '../config.js'
import { getFrontendBrandingPublic } from '../frontendBranding.js'
import { getHelpSupportPublic } from '../helpSupport.js'
import { getAboutPagePublic } from '../aboutPage.js'
import { getAppUpdatePublic } from '../appUpdate.js'
import { getDownloadPagePublic } from '../downloadPage.js'
import { getBaseApkPublic } from '../baseApk.js'
import { issueDownloadTicket, serveDownloadApk } from '../downloadPageGuard.js'
import { sendDownloadQr } from '../downloadPageQr.js'
import { getPrivateCallPublic } from '../privateCallConfig.js'
import { getAmapClientStatus } from '../amap.js'
import { listChangelogPublic } from '../changelog.js'
import { getPublicVerificationFlags, verifyGeetestFromRequestBody } from '../geetest.js'
import { listStickers } from '../stickers.js'
import { searchFreeStickers } from '../stickerSearch.js'
import { resolveExternalStickerForProxy } from '../stickerCache.js'
import { fail, ok } from '../response.js'

const router = Router()

router.get('/config/stickers/proxy', async (req, res) => {
  try {
    const raw = String(req.query?.url || '').trim()
    if (!isAllowedExternalStickerUrl(raw)) {
      return fail(res, 400, '无效的表情包地址')
    }
    const resolved = await resolveExternalStickerForProxy(raw)
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    res.setHeader('Content-Type', resolved.contentType)
    resolved.stream.on('error', () => {
      if (!res.headersSent) fail(res, 502, '表情包加载失败')
      else res.destroy()
    })
    return resolved.stream.pipe(res)
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    const status = e?.status || (aborted ? 504 : 502)
    return fail(res, status, aborted ? '表情包加载超时' : (e.message || '表情包加载失败'))
  }
})

router.get('/config/site-branding', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getFrontendBrandingPublic())
})

router.get('/config/help-support', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getHelpSupportPublic())
})

router.get('/config/about-page', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getAboutPagePublic())
})

// 与 update-log 同理：部分环境对路径关键字敏感，客户端优先用 app-about
router.get('/config/app-about', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getAboutPagePublic())
})

router.get('/config/app-update', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getAppUpdatePublic(req))
})

router.get('/config/download-page', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, getDownloadPagePublic())
})

/** 官方底包元信息：供其它部署的打包页低频拉取 */
router.get('/config/base-apk', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  try {
    return ok(res, await getBaseApkPublic())
  } catch (e) {
    return fail(res, 500, e?.message || '读取底包信息失败')
  }
})

/** 下载页：签发一次性短时 APK 票据（不暴露真实路径） */
router.post('/download-page/ticket', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  try {
    return ok(res, issueDownloadTicket(req))
  } catch (e) {
    return fail(res, e.status || 400, e.message || '无法获取下载链接')
  }
})

/** 扫码直链：签发票据并 302 跳转到 APK（每次扫码都是新票据） */
router.get('/download-page/go', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  try {
    const data = issueDownloadTicket(req)
    const target = String(data.apkUrl || '').trim()
    if (!target) throw Object.assign(new Error('暂无安装包'), { status: 404 })
    return res.redirect(302, target)
  } catch (e) {
    // 扫码失败时回下载页，避免空白报错页
    const msg = encodeURIComponent(e?.message || '暂时无法下载')
    return res.redirect(302, `/download/?err=${msg}`)
  }
})

/** 兼容旧地址：/api/download-page/qr.png */
router.get(['/download-page/qr.png', '/download-page/qr.svg'], async (req, res) => {
  try {
    const format = String(req.path || '').endsWith('.svg') ? 'svg' : 'png'
    return await sendDownloadQr(req, res, format)
  } catch (e) {
    return fail(res, 500, e?.message || '二维码生成失败')
  }
})

/** 下载页：校验票据后下发 APK */
router.get('/download-page/apk', (req, res) => {
  try {
    return serveDownloadApk(req, res)
  } catch (e) {
    if (!res.headersSent) {
      return fail(res, e.status || 403, e.message || '下载失败')
    }
    res.destroy()
  }
})

// 注意：勿用路径名 changelog —— 宝塔 Nginx 敏感文件规则会匹配 CHANGELOG 并 404
router.get('/config/update-log', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  return ok(res, listChangelogPublic())
})

router.get('/config/chat-features', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  const location = getAmapClientStatus()
  return ok(res, {
    ...getPrivateCallPublic(),
    /** 未配高德 Web Key 或关闭时为 false，客户端应隐藏「发送位置」 */
    locationEnabled: !!location.enabled,
    locationConfigured: !!location.configured
  })
})

router.get('/config/stickers', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  try {
    const data = listStickers()
    return ok(res, { list: data.list, packs: data.packs || [] })
  } catch (e) {
    return fail(res, 500, e.message || '加载表情包失败')
  }
})

router.get('/config/stickers/search', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  try {
    const q = String(req.query?.q ?? req.query?.words ?? req.query?.keyword ?? '').trim()
    const page = Number(req.query?.page) || 1
    if (!q) return ok(res, { list: [], page: 1, query: '' })
    const data = await searchFreeStickers(q, page)
    return ok(res, data)
  } catch (e) {
    return fail(res, 500, e.message || '搜索表情包失败')
  }
})

router.get('/config/verification-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  const config = loadConfig()
  return ok(res, {
    ...getPublicVerificationFlags(config),
    turnstileEnabled: !!config.turnstile?.enabled,
    turnstileSiteKey: config.turnstile?.siteKey || ''
  })
})

router.post('/geetest/verify', async (req, res) => {
  try {
    const gr = await verifyGeetestFromRequestBody(req.body)
    if (gr.ok) return ok(res, null, '验证成功')
    return fail(res, 400, gr.message || '验证失败')
  } catch (e) {
    return fail(res, 500, e.message || '验证失败')
  }
})

export default router
