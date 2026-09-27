import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = process.env.XHAMIL_ROOT_DIR
  ? path.resolve(process.env.XHAMIL_ROOT_DIR)
  : path.resolve(__dirname, '../..')
export const JSON_DIR = process.env.XHAMIL_JSON_DIR
  ? path.resolve(process.env.XHAMIL_JSON_DIR)
  : path.join(ROOT_DIR, 'json')
export const HUB_DATA_DIR = process.env.XHAMIL_DATA_DIR
  ? path.resolve(process.env.XHAMIL_DATA_DIR)
  : path.join(ROOT_DIR, 'backend', 'data')
export const MEDIA_DIR = path.join(ROOT_DIR, 'media')
export const CHAT_IMAGE_DIR = path.join(MEDIA_DIR, 'Chat Images')
export const CHAT_IMAGE_URL_PREFIX = '/media/Chat Images'
export const MOMENTS_IMAGE_DIR = path.join(MEDIA_DIR, 'Moments')
export const MOMENTS_IMAGE_URL_PREFIX = '/media/Moments'
/** 用户举报截图专用目录 */
export const REPORT_IMAGE_DIR = path.join(MEDIA_DIR, 'Reports')
export const REPORT_IMAGE_URL_PREFIX = '/media/Reports'
export const MOMENTS_VIDEO_DIR = path.join(MEDIA_DIR, 'Moments Videos')
export const MOMENTS_VIDEO_URL_PREFIX = '/media/Moments Videos'
/** 说说视频单文件上限 2GB，最长 2 分钟 */
export const MOMENTS_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const MOMENTS_VIDEO_MAX_DURATION_SEC = 120
export const CHAT_VIDEO_DIR = path.join(MEDIA_DIR, 'Chat Videos')
export const CHAT_VIDEO_URL_PREFIX = '/media/Chat Videos'
/** 聊天视频单文件上限 2GB */
export const CHAT_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const VOICE_AUDIO_DIR = path.join(MEDIA_DIR, 'Audio')
export const VOICE_AUDIO_URL_PREFIX = '/media/Audio'
export const GROUP_FILE_DIR = path.join(MEDIA_DIR, 'Group Files')
export const GROUP_FILE_URL_PREFIX = '/media/Group Files'
/** 单文件上限 5GB */
export const GROUP_FILE_MAX_BYTES = 5 * 1024 * 1024 * 1024
/** 单群存储配额 8GB */
export const GROUP_FILE_QUOTA_BYTES = 8 * 1024 * 1024 * 1024
/** 群文件最长保留 7 天 */
export const GROUP_FILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const GROUP_FILE_RETENTION_DAYS = 7
/** 私聊文件最长保留 1 天 */
export const DIRECT_FILE_RETENTION_MS = 1 * 24 * 60 * 60 * 1000
export const DIRECT_FILE_RETENTION_DAYS = 1
/** 聊天照片/视频服务端保留 7 天；客户端依赖 App 加密缓存继续查看 */
export const CHAT_MEDIA_RETENTION_MS = 25 * 24 * 60 * 60 * 1000
export const CHAT_MEDIA_RETENTION_DAYS = 25
export const ADMIN_DIR = path.join(ROOT_DIR, 'backend', 'public', 'admin')
export const DOWNLOAD_DIR = path.join(ROOT_DIR, 'backend', 'public', 'download')
export const PASSWORD_RESET_DIR = path.join(ROOT_DIR, 'backend', 'public', 'password-reset')
export const DESKTOP_MAP_DIR = path.join(ROOT_DIR, 'backend', 'public', 'desktop-map')
export const CONFIG_PATH = path.join(JSON_DIR, 'config.json')
export const DEFAULT_GROUP_AVATAR_URL = '/media/Official Images/avatar 2.png'
export const LEGACY_GROUP_AVATAR_URL = '/media/Official Images/image1.png'
/** 旧单张默认用户头像（已弃用，见 Default Avatars） */
export const LEGACY_DEFAULT_AVATAR_URL = '/media/Official Images/image.png'
export const DEFAULT_AVATARS_DIR = path.join(MEDIA_DIR, 'Default Avatars')
export const DEFAULT_AVATARS_URL_PREFIX = '/media/Default Avatars'

/** 默认池文件名：default-01.png / default-02.jpg … 换图保持主名即可 */
const DEFAULT_AVATAR_FILE_RE = /^default-(\d{2})\.(png|jpe?g|webp|gif)$/i

/**
 * 扫描 Default Avatars 目录，按槽位 default-01… 收集实际存在的文件。
 * 同一槽位若有多个扩展名，取修改时间最新的（方便直接换 jpg/png，不必先删旧文件）。
 * 不写死扩展名：以后替换同名图片或改成 .jpg，随机/种子映射都会指到真实文件。
 */
export function scanDefaultAvatarPool() {
  const bySlot = new Map()
  try {
    if (!fs.existsSync(DEFAULT_AVATARS_DIR)) return []
    for (const name of fs.readdirSync(DEFAULT_AVATARS_DIR)) {
      const m = DEFAULT_AVATAR_FILE_RE.exec(name)
      if (!m) continue
      const slot = m[1]
      const abs = path.join(DEFAULT_AVATARS_DIR, name)
      let st
      try {
        st = fs.statSync(abs)
      } catch {
        continue
      }
      if (!st.isFile() || st.size <= 0) continue
      const prev = bySlot.get(slot)
      if (!prev || st.mtimeMs >= prev.mtimeMs) {
        bySlot.set(slot, { slot, name, mtimeMs: st.mtimeMs })
      }
    }
  } catch {
    return []
  }
  return [...bySlot.values()].sort((a, b) => Number(a.slot) - Number(b.slot))
}

/** 当前默认池 URL 列表（无 ?v=，适合写入数据库） */
export function getDefaultAvatarUrls() {
  const pool = scanDefaultAvatarPool()
  if (pool.length) {
    return pool.map((f) => `${DEFAULT_AVATARS_URL_PREFIX}/${f.name}`)
  }
  // 目录空时的占位（启动早期 / 未放图）
  return [
    `${DEFAULT_AVATARS_URL_PREFIX}/default-01.png`,
    `${DEFAULT_AVATARS_URL_PREFIX}/default-02.png`,
    `${DEFAULT_AVATARS_URL_PREFIX}/default-03.png`,
    `${DEFAULT_AVATARS_URL_PREFIX}/default-04.png`,
    `${DEFAULT_AVATARS_URL_PREFIX}/default-05.png`,
    `${DEFAULT_AVATARS_URL_PREFIX}/default-06.png`
  ]
}

/** @deprecated 请用 getDefaultAvatarUrls()；保留数组形态兼容旧 import 快照 */
export const DEFAULT_AVATAR_URLS = getDefaultAvatarUrls()

export function getDefaultAvatarUrl() {
  return getDefaultAvatarUrls()[0]
}

/** 兼容旧代码：模块加载时的第一项；运行时请用 getDefaultAvatarUrl() */
export const DEFAULT_AVATAR_URL = getDefaultAvatarUrl()

/**
 * 把「默认池」URL 纠到磁盘上真实文件（同槽位换扩展名也能对上）。
 * 例：库里是 default-06.png，目录里只剩 default-06.jpg → 返回 jpg。
 */
export function resolveDefaultAvatarUrl(url) {
  const raw = String(url || '')
    .trim()
    .split('?')[0]
    .replace(/\\/g, '/')
  if (!raw) return getDefaultAvatarUrl()
  const m = /\/media\/Default Avatars\/(default-(\d{2})\.[a-z0-9]+)$/i.exec(raw)
  if (!m) {
    if (avatarMediaFileExists(raw)) return raw
    return getDefaultAvatarUrl()
  }
  const slot = m[2]
  const pool = scanDefaultAvatarPool()
  const hit = pool.find((f) => f.slot === slot)
  if (hit) return `${DEFAULT_AVATARS_URL_PREFIX}/${hit.name}`
  // 槽位没了：回落池内第一张
  return getDefaultAvatarUrl()
}

/** 给默认图加文件 mtime 缓存戳，同名覆盖后客户端立刻拿到新图 */
export function withDefaultAvatarCacheBust(url) {
  const base = String(url || '')
    .trim()
    .split('?')[0]
    .replace(/\\/g, '/')
  if (!base.startsWith(`${DEFAULT_AVATARS_URL_PREFIX}/`)) return base
  const abs = resolveMediaUrlToPath(base)
  if (!abs) return base
  try {
    const st = fs.statSync(abs)
    return `${base}?v=${Math.floor(st.mtimeMs)}`
  } catch {
    return base
  }
}

export const AVATAR_DIR = path.join(MEDIA_DIR, 'avatar')
export const AVATAR_URL_PREFIX = '/media/avatar'
/** 关于页开发者 / 鸣谢头像（与用户头像 media/avatar 分离） */
export const ABOUT_PAGE_DIR = path.join(MEDIA_DIR, 'About Page')
export const ABOUT_PAGE_URL_PREFIX = '/media/About Page'
export const OFFICIAL_IMAGES_DIR = path.join(MEDIA_DIR, 'Official Images')
export const OFFICIAL_IMAGES_URL_PREFIX = '/media/Official Images'
export const STICKER_DIR = path.join(MEDIA_DIR, 'Sticker')
export const STICKER_URL_PREFIX = '/media/Sticker'
export const AVATAR_FRAME_DIR = path.join(MEDIA_DIR, 'Avatar Frames')
export const AVATAR_FRAME_URL_PREFIX = '/media/Avatar Frames'
export const CHAT_BUBBLE_DIR = path.join(MEDIA_DIR, 'Chat Bubbles')
export const CHAT_BUBBLE_URL_PREFIX = '/media/Chat Bubbles'
export const APP_RELEASE_DIR = path.join(MEDIA_DIR, 'App Releases')
export const APP_RELEASE_URL_PREFIX = '/media/App Releases'
export const APP_RELEASE_MAX_BYTES = 512 * 1024 * 1024
/**
 * 下载落地页专用 APK（私有目录，不走 /media 静态直链）
 * 旧路径 media/Download Page 仅作迁移源
 */
export const DOWNLOAD_PAGE_LEGACY_DIR = path.join(MEDIA_DIR, 'Download Page')
export const DOWNLOAD_PAGE_DIR = path.join(HUB_DATA_DIR, 'Download Page')
/** @deprecated 已禁用直链，保留常量避免旧引用报错 */
export const DOWNLOAD_PAGE_URL_PREFIX = '/api/download-page/apk'
export const DOWNLOAD_PAGE_MAX_BYTES = 512 * 1024 * 1024
/** 下载落地页品牌图标（公开 /media，与私有 APK 目录分离） */
export const DOWNLOAD_PAGE_BRAND_DIR = path.join(MEDIA_DIR, 'download-brand')
export const DOWNLOAD_PAGE_BRAND_URL_PREFIX = '/media/download-brand'
export const DEFAULT_AVATAR_FRAME_FILENAME = 'Avatar Frame.png'
export const LEGACY_DEFAULT_AVATAR_FRAME_URL = '/media/Official Images/Avatar Frame.png'
export const DEFAULT_AVATAR_FRAME_URL = `${AVATAR_FRAME_URL_PREFIX}/${DEFAULT_AVATAR_FRAME_FILENAME}`

export function canonicalizeAvatarFrameUrl(frameUrl) {
  const raw = String(frameUrl || '').trim().replace(/\\/g, '/')
  if (!raw) return ''
  if (raw === LEGACY_DEFAULT_AVATAR_FRAME_URL) return DEFAULT_AVATAR_FRAME_URL
  if (!raw.startsWith('/media/')) return raw
  return raw
    .split('/')
    .map((part, index) => {
      if (index === 0 || !part) return part
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })
    .join('/')
}
export const DEFAULT_MAIL_LOGO_URL = '/media/Official Images/XhaMilAI.jpg'
/** Android / 手机端 App 图标（官方图） */
export const PHONE_APP_ICON_URL = '/media/Official Images/phone logo.png'

/** 将 /media/... 路径各段正确编码，避免 Official Images 等目录名含空格导致 404 */
export function encodeMediaPathUrl(url) {
  const raw = String(url || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!raw) return ''
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  if (!raw.startsWith('/')) return raw
  return raw
    .split('/')
    .map((part, index) => {
      if (index === 0) return part
      if (!part) return part
      try {
        return encodeURIComponent(decodeURIComponent(part))
      } catch {
        return encodeURIComponent(part)
      }
    })
    .join('/')
}

export function officialImageUrl(filename) {
  const name = String(filename || '').trim()
  if (!name) return ''
  const folder = encodeMediaPathUrl(OFFICIAL_IMAGES_URL_PREFIX)
  return `${folder}/${encodeURIComponent(name)}`
}

export const DEFAULT_BROWSER_TITLE = 'XhaMil 聊天'
export const DEFAULT_NAV_BAR_TITLE = 'XhaMil 聊天'
export const DEFAULT_ADMIN_BROWSER_TITLE = 'XhaMil 管理后台'
export const DEFAULT_LOGIN_WELCOME_TITLE = 'Hi，欢迎回到 {name}'
export const DEFAULT_REGISTER_WELCOME_TITLE = 'Hi，欢迎来到 {name}'
export const DEFAULT_APP_DISPLAY_NAME = 'XhaMil'
export const DEFAULT_APP_NAV_BAR_TITLE = 'XhaMil 聊天'
export const DEFAULT_APP_SPLASH_TAGLINE = '聊聊 · 更轻松'

export function pickRandomDefaultAvatarUrl() {
  const urls = getDefaultAvatarUrls()
  const i = Math.floor(Math.random() * urls.length)
  return urls[i]
}

/** 按稳定种子选默认头像（同一用户始终同一张槽位；扩展名随目录实际文件） */
export function pickDefaultAvatarUrlForSeed(seed) {
  const urls = getDefaultAvatarUrls()
  const n = Math.abs(Number(seed) || 0)
  return urls[n % urls.length]
}

export function isDefaultAvatarUrl(url) {
  const v = String(url || '')
    .trim()
    .split('?')[0]
    .replace(/\\/g, '/')
  if (!v) return true
  if (
    v === LEGACY_DEFAULT_AVATAR_URL ||
    v === '/media/avatar/default.png' ||
    v === DEFAULT_AVATAR_URL
  ) {
    return true
  }
  // 任意扩展名的 default-01…09 都算默认池
  if (/\/media\/Default Avatars\/default-\d{2}\.(png|jpe?g|webp|gif)$/i.test(v)) return true
  // 也认当前扫描结果（防止大小写/编码差异）
  return getDefaultAvatarUrls().some((u) => u === v)
}

/** 将 /media/... URL 解析为本地绝对路径；非法或越界返回 null */
export function resolveMediaUrlToPath(url) {
  const base = String(url || '')
    .trim()
    .split('?')[0]
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
  if (!base.startsWith('/media/')) return null
  let rel
  try {
    rel = decodeURIComponent(base.slice('/media/'.length))
  } catch {
    rel = base.slice('/media/'.length)
  }
  if (!rel || rel.includes('..')) return null
  const abs = path.resolve(MEDIA_DIR, rel)
  const root = path.resolve(MEDIA_DIR)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

/** 头像文件是否还在磁盘上（默认池 / 官方图 / 用户上传） */
export function avatarMediaFileExists(url) {
  const abs = resolveMediaUrlToPath(url)
  if (!abs) return false
  try {
    return fs.existsSync(abs)
  } catch {
    return false
  }
}

export function normalizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
  const raw = url.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!raw) return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
  const v = raw.split('?')[0]
  if (v.startsWith(`${DEFAULT_AVATARS_URL_PREFIX}/`)) {
    // 同槽位换扩展名 / 同名覆盖：纠到磁盘真实文件并带 mtime 戳
    return withDefaultAvatarCacheBust(resolveDefaultAvatarUrl(v))
  }
  if (v.startsWith(`${AVATAR_URL_PREFIX}/`)) {
    // 迁移丢文件时避免裂图：上传头像不存在则回落到默认池
    if (!avatarMediaFileExists(v)) return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
    return raw
  }
  if (v.startsWith(`${OFFICIAL_IMAGES_URL_PREFIX}/`)) {
    // 旧默认图映射到新默认池（稳定映射，避免每次响应乱跳）
    if (v === LEGACY_DEFAULT_AVATAR_URL || v === '/media/avatar/default.png') {
      return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
    }
    if (!avatarMediaFileExists(v)) return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
    return raw
  }
  if (v === DEFAULT_AVATAR_URL || v === '/media/avatar/default.png') {
    return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
  }
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
  }
  return withDefaultAvatarCacheBust(getDefaultAvatarUrl())
}

export function normalizeGroupAvatarUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_GROUP_AVATAR_URL
  const v = url.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!v) return DEFAULT_GROUP_AVATAR_URL
  if (v.startsWith(`${AVATAR_URL_PREFIX}/`)) return v
  if (v.startsWith(`${DEFAULT_AVATARS_URL_PREFIX}/`)) return v
  if (v.startsWith(`${OFFICIAL_IMAGES_URL_PREFIX}/`)) return v
  if (
    v === DEFAULT_GROUP_AVATAR_URL ||
    v === LEGACY_GROUP_AVATAR_URL ||
    v === LEGACY_DEFAULT_AVATAR_URL ||
    v === DEFAULT_AVATAR_URL
  ) {
    return DEFAULT_GROUP_AVATAR_URL
  }
  if (v.startsWith('http://') || v.startsWith('https://')) return DEFAULT_GROUP_AVATAR_URL
  return DEFAULT_GROUP_AVATAR_URL
}

const ALLOWED_EXTERNAL_STICKER_HOST_RE =
  /^(?:[a-z0-9-]+\.)*(?:sogoucdn\.com|doutupk\.com|doutula\.com|pkdoutu\.com|soutula\.com|fabiaoqing\.com|sinaimg\.cn|baidu\.com|bdimg\.com|bdstatic\.com|bcebos\.com|aliyuncs\.com|dbbqb\.com|jsdelivr\.net|githubusercontent\.com|gitee\.com)$/i

/** 搜索结果里的本站代理地址 → 真实外链 */
export function unwrapStickerProxyUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    let pathAndQuery = raw
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      pathAndQuery = `${u.pathname}${u.search}`
    }
    if (!/\/(?:api\/)?config\/stickers\/proxy/i.test(pathAndQuery)) return raw
    const q = pathAndQuery.includes('?') ? pathAndQuery.slice(pathAndQuery.indexOf('?') + 1) : ''
    const inner = new URLSearchParams(q).get('url')
    if (!inner) return raw
    let decoded = String(inner).trim()
    if (decoded.startsWith('//')) decoded = `https:${decoded}`
    if (decoded.startsWith('http://')) decoded = `https://${decoded.slice(7)}`
    if (!/^https:\/\//i.test(decoded)) return raw
    return decoded
  } catch {
    return raw
  }
}

export function isAllowedExternalStickerUrl(url) {
  const v = unwrapStickerProxyUrl(url)
  if (!/^https?:\/\//i.test(v)) return false
  try {
    const host = new URL(v).hostname
    return ALLOWED_EXTERNAL_STICKER_HOST_RE.test(host)
  } catch {
    return false
  }
}

export function isAllowedUserPhotoUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return false
  if (
    raw.startsWith(`${CHAT_IMAGE_URL_PREFIX}/`) ||
    raw.startsWith('/chat-image/') ||
    raw.startsWith(`${STICKER_URL_PREFIX}/`) ||
    raw.startsWith('/media/EmojiPackage/')
  ) {
    return true
  }
  // 本站表情代理地址（搜索结果）
  if (/\/(?:api\/)?config\/stickers\/proxy\?/i.test(raw)) {
    return isAllowedExternalStickerUrl(raw)
  }
  return isAllowedExternalStickerUrl(raw)
}

export function isAllowedUserVideoUrl(url) {
  const v = String(url || '').trim().replace(/\\/g, '/')
  if (!v) return false
  return v.startsWith(`${CHAT_VIDEO_URL_PREFIX}/`)
}

export function isAllowedUserFileUrl(url) {
  const v = String(url || '').trim().replace(/\\/g, '/')
  if (!v) return false
  return v.startsWith(`${GROUP_FILE_URL_PREFIX}/`)
}

export const DEFAULT_CONFIG = {
  server: { port: 5000, host: '127.0.0.1' },
  admin: { username: 'admin', password: 'admin123', entryCode: '' },
  database: {
    type: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'xhamil_chat',
    charset: 'utf8mb4'
  },
  /** Redis：会话 / 在线 / 未 ACK 投递缓冲；连不上则自动降级内存 */
  redis: {
    enabled: true,
    url: 'redis://127.0.0.1:6379',
    host: '127.0.0.1',
    port: 6379,
    password: '',
    db: 0,
    keyPrefix: 'xhamil:'
  },
  turnstile: { enabled: false, siteKey: '', secretKey: '' },
  geetestEnabled: false,
  geetestCaptchaId: '',
  geetestCaptchaKey: '',
  emailVerificationEnabled: false,
  /** 短信注册（阿里云号码认证 / 短信认证） */
  smsVerificationEnabled: true,
  aliyunSmsAccessKeyId: '',
  aliyunSmsAccessKeySecret: '',
  aliyunSmsSignName: '恒创联众',
  aliyunSmsTemplateCode: '100001',
  aliyunSmsCodeValidMin: 5,
  aliyunSmsCodeLength: 6,
  smtpHost: '',
  smtpPort: 465,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
  smtpFromName: '',
  smtpMailTitle: '注册验证码',
  smtpMailBody: '您的注册验证码是：{{code}}，{{min}}分钟内有效。',
  smtpMailTemplate: 'classic',
  smtpMailLogo: DEFAULT_MAIL_LOGO_URL,
  publicSiteUrl: '',
  maxOwnedGroupsPerUser: 0,
  groupCreationBannedUserIds: [],
  userRestrictions: {},
  frontendBrowserTitle: DEFAULT_BROWSER_TITLE,
  frontendNavBarTitle: DEFAULT_NAV_BAR_TITLE,
  adminBrowserTitle: DEFAULT_ADMIN_BROWSER_TITLE,
  loginWelcomeTitle: DEFAULT_LOGIN_WELCOME_TITLE,
  registerWelcomeTitle: DEFAULT_REGISTER_WELCOME_TITLE,
  appDisplayName: DEFAULT_APP_DISPLAY_NAME,
  appNavBarTitle: DEFAULT_APP_NAV_BAR_TITLE,
  appSplashTagline: DEFAULT_APP_SPLASH_TAGLINE,
  gateGroupEnabled: false,
  gateGroupCode: '',
  gateGroupTitle: '欢迎加入聊天室',
  gateGroupContent:
    '本功能适用于开发者交流或校园聊天室场景。确认后将直接进入指定群聊，无需额外申请。',
  gateGroupConfirmText: '进入',
  gateGroupCancelText: '退出',
  helpSupportTitle: '帮助与客服',
  helpSupportContent: '如有问题请联系客服。',
  helpSupportQq: '',
  helpSupportWechat: '',
  aboutTagline: '用心做好每一次聊天',
  aboutCreditsTitle: '致谢',
  aboutDeveloperName: 'xhaoy',
  aboutDeveloperRole: '全栈开发 · 独自扛下所有',
  aboutDeveloperBadge: 'Dev',
  aboutDeveloperAvatarUrl: '',
  aboutThanksTitle: '特别鸣谢',
  aboutThanksHint: '开发狂魔 + 测试运营双人组',
  aboutCopyright: '© XhaMil · xhaoy',
  aboutThanksJson: JSON.stringify([
    { name: 'xhaoy', role: '前端开发', tint: '#2F6FED', avatarUrl: '' },
    { name: 'xhaoy', role: '后端优化', tint: '#10B981', avatarUrl: '' },
    { name: 'xhaoy', role: '产品设计', tint: '#8B5CF6', avatarUrl: '' },
    { name: 'xhaoy', role: '交互动效', tint: '#F97316', avatarUrl: '' },
    { name: 'xhaoy', role: '音视频架构', tint: '#EA4335', avatarUrl: '' },
    { name: 'xhaoy', role: '安全与性能', tint: '#06B6D4', avatarUrl: '' },
    { name: 'xhaoy', role: '运维部署', tint: '#EC4899', avatarUrl: '' },
    { name: 'xhaoy', role: '深夜修 Bug', tint: '#64748B', avatarUrl: '' },
    { name: 'fuyelk', role: '测试运营', tint: '#0EA5E9', avatarUrl: '' },
    { name: 'DOYWB🤔', role: '测试运营', tint: '#A855F7', avatarUrl: '' }
  ]),
  bannedWordsEnabled: false,
  bannedWordsText: '',
  bannedWordsMask: '*',
  bannedWordsActivePresetId: null,
  privateCallDisabled: false,
  /** 发送位置：高德各端 Key（与开放平台「服务平台」对齐，全部后台配置，客户端不写死） */
  amapEnabled: true,
  /** Web 服务：服务器代理 POI / 逆地理 */
  amapWebApiKey: '',
  /** Web 端(JS API)：选点页地图 */
  amapJsApiKey: '',
  /** 与 Web 端 Key 配套的安全密钥 */
  amapJsSecurityCode: '',
  /** Android 平台：定位 / 原生地图 SDK */
  amapAndroidKey: '',
  /** iOS 平台（预留） */
  amapIosKey: '',
  /** 微信小程序（预留） */
  amapWechatMiniKey: '',
  /** HarmonyOS NEXT（预留） */
  amapHarmonyKey: '',
  /** 选点页地图样式，默认远山黛（清新雅致） */
  amapMapStyle: 'amap://styles/whitesmoke',
  voiceToTextProvider: 'auto',
  voiceToTextApiKey: '',
  voiceToTextModel: '',
  siliconflowApiKey: '',
  groqApiKey: '',
  adminOnboarding: {
    completed: false
  },
  appUpdateEnabled: false,
  appUpdateDialogType: 'update',
  appUpdateVersionCode: 1,
  appUpdateVersionName: '1.0',
  appUpdateApkFilename: '',
  appUpdateForceUpdate: false,
  appUpdateTitle: '发现新版本',
  appUpdateContent: '新版本已发布，建议立即更新以获得更好体验。',
  appUpdateConfirmText: '立即更新',
  appUpdateCancelText: '稍后再说',
  /** 下载页对外安装包（与 appUpdate* 热更新分离；打包底包也拉这里） */
  downloadPageEnabled: true,
  downloadPageApkFilename: '',
  downloadPageVersionCode: 0,
  downloadPageVersionName: '',
  downloadPageTitle: '',
  downloadPageSubtitle: '',
  /** 下载页顶栏品牌：名称 / 标语 / 图标 */
  downloadPageBrandName: '',
  downloadPageTagline: '',
  downloadPageIconUrl: '',
  /** HMAC 密钥：首次签发下载票据时自动生成 */
  downloadPageSignSecret: '',
  /**
   * 内嵌打包页拉取官方底包的根地址。
   * 买家部署默认指向 ask.xhamil.com；官方本机部署可留空（走本地 App 发版）。
   */
  packOfficialBaseUrl: 'https://ask.xhamil.com'
}

export const PACK_DIR = path.join(ROOT_DIR, 'backend', 'pack')
export const PACK_BASE_DIR = path.join(PACK_DIR, 'base')
export const PACK_TOOLS_DIR = path.join(PACK_DIR, 'tools')
export const PACK_JOBS_DIR = path.join(PACK_DIR, 'jobs')

const ADMIN_ENTRY_RESERVED = new Set([
  'admin',
  'api',
  'media',
  'chat-image',
  'voice',
  'ws',
  'favicon.ico',
  'robots.txt'
])

const ADMIN_ENTRY_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'

export function normalizeAdminEntryCode(code) {
  const v = String(code || '').trim()
  if (!/^[A-Za-z]{8,16}$/.test(v)) return ''
  if (ADMIN_ENTRY_RESERVED.has(v.toLowerCase())) return ''
  return v
}

export function isLegacyAdminEntryCode(code) {
  return /^\d{8,16}$/.test(String(code || '').trim())
}

export function generateAdminEntryCode() {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let code = ''
    while (code.length < 10) {
      code += ADMIN_ENTRY_LETTERS[crypto.randomInt(0, ADMIN_ENTRY_LETTERS.length)]
    }
    if (!ADMIN_ENTRY_RESERVED.has(code.toLowerCase())) return code
  }
  return `Xh${crypto.randomBytes(4).toString('hex')}Mil`.slice(0, 10)
}

export function getAdminEntryCode(config = loadConfig()) {
  return normalizeAdminEntryCode(config.admin?.entryCode)
}

export function getAdminEntryPath(config = loadConfig()) {
  const code = getAdminEntryCode(config)
  return code ? `/${code}` : ''
}

export function getAdminIndexPath(config = loadConfig()) {
  const base = getAdminEntryPath(config)
  return base ? `${base}/#/` : ''
}

export function getAdminLoginPath(config = loadConfig()) {
  const base = getAdminEntryPath(config)
  return base ? `${base}/#/auth/login` : ''
}

export function getAdminLogoutPath(config = loadConfig()) {
  return getAdminLoginPath(config)
}

export function getAdminLoginUrlAfterLogout(config = loadConfig()) {
  // Vue3 hash 路由：退出后回到登录页即可（勿再拼 FastAdmin 的 ?url=）
  return getAdminLoginPath(config)
}

/** 站点外网根地址，用于启动日志、邮件等（勿带末尾 /） */
export function getPublicSiteUrl(config = loadConfig()) {
  return String(config.publicSiteUrl || '').trim().replace(/\/+$/, '')
}

/**
 * 启动日志里展示的后台访问地址：优先 publicSiteUrl，否则本机 http://host:port
 */
export function resolveStartupBrowseUrls(config = loadConfig(), port = 5000, host = '127.0.0.1') {
  const publicBase = getPublicSiteUrl(config)
  const bindHost = String(host || '127.0.0.1').trim()
  const localHost =
    !bindHost || bindHost === '0.0.0.0' || bindHost === '::' ? '127.0.0.1' : bindHost
  const localBase = `http://${localHost}:${port}`
  const base = publicBase || localBase
  const adminLogin = getAdminLoginUrlAfterLogout(config)
  return {
    publicBase,
    localBase,
    adminUrl: `${base}${adminLogin}`,
    localAdminUrl: `${localBase}${adminLogin}`
  }
}

/** 首次启动或旧版纯数字入口时，自动生成字母随机入口码并写入 config.json */
export function ensureAdminEntryCode() {
  const config = loadConfig()
  const raw = String(config.admin?.entryCode || '').trim()
  const existing = normalizeAdminEntryCode(raw)
  if (existing && !isLegacyAdminEntryCode(raw)) return existing
  const code = generateAdminEntryCode()
  saveConfig({ admin: { ...config.admin, entryCode: code } })
  return code
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(JSON_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
    return structuredClone(DEFAULT_CONFIG)
  }
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  // 丢弃已移除的 hub / 超级后台字段，避免 saveConfig 写回
  const {
    superAdmin: _sa,
    deployment: _dep,
    hub: _hub,
    nodeLicense: _nl,
    mobileServers: _ms,
    serverLicenses: _sl,
    ...rest
  } = raw || {}
  return {
    ...DEFAULT_CONFIG,
    ...rest,
    server: { ...DEFAULT_CONFIG.server, ...(rest.server || {}) },
    admin: { ...DEFAULT_CONFIG.admin, ...(rest.admin || {}) },
    database: { ...DEFAULT_CONFIG.database, ...(rest.database || {}) },
    redis: { ...DEFAULT_CONFIG.redis, ...(rest.redis || {}) },
    turnstile: { ...DEFAULT_CONFIG.turnstile, ...(rest.turnstile || {}) },
    adminOnboarding: { ...DEFAULT_CONFIG.adminOnboarding, ...(rest.adminOnboarding || {}) }
  }
}

export function saveConfig(partial) {
  const current = loadConfig()
  const next = {
    ...current,
    ...partial,
    server: { ...current.server, ...(partial.server || {}) },
    admin: { ...current.admin, ...(partial.admin || {}) },
    database: { ...current.database, ...(partial.database || {}) },
    redis: { ...current.redis, ...(partial.redis || {}) },
    turnstile: { ...current.turnstile, ...(partial.turnstile || {}) },
    adminOnboarding: { ...current.adminOnboarding, ...(partial.adminOnboarding || {}) }
  }
  fs.mkdirSync(JSON_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function getConfigMeta() {
  const exists = fs.existsSync(CONFIG_PATH)
  let sizeText = '—'
  if (exists) {
    const bytes = fs.statSync(CONFIG_PATH).size
    sizeText = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
  }
  return {
    file: 'json/config.json',
    desc: '仅存后台配置与 MySQL 连接信息，不存聊天/用户业务数据',
    exists,
    sizeText
  }
}
