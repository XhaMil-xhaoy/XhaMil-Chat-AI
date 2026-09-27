/**
 * 后台生成的改密链接（短时 token）。
 * Redis 可用时走 Redis；否则内存 Map 降级。
 */
import crypto from 'crypto'
import { getPublicSiteUrl } from './config.js'
import { isRedisReady, redisDel, redisGetJson, redisKey, redisSetJson } from './redis.js'

const TTL_MS = 48 * 60 * 60 * 1000
const TOKEN_RE = /^[a-f0-9]{32,64}$/i
const memoryLinks = new Map()

function nowMs() {
  return Date.now()
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex')
}

function redisLinkKey(token) {
  return redisKey('pwdreset', token)
}

function pruneMemory() {
  const now = nowMs()
  for (const [id, s] of memoryLinks) {
    if (!s || (Number(s.expiresAt) || 0) <= now || s.used) memoryLinks.delete(id)
  }
}

async function saveLink(link) {
  const id = link.token
  const ttl = Math.max(1, Math.ceil(((Number(link.expiresAt) || 0) - nowMs()) / 1000))
  if (isRedisReady()) {
    await redisSetJson(redisLinkKey(id), link, ttl)
  }
  memoryLinks.set(id, link)
}

async function loadLink(token) {
  const id = String(token || '').trim()
  if (!TOKEN_RE.test(id)) return null
  if (isRedisReady()) {
    const fromRedis = await redisGetJson(redisLinkKey(id))
    if (fromRedis) return fromRedis
  }
  pruneMemory()
  return memoryLinks.get(id) || null
}

async function removeLink(token) {
  const id = String(token || '').trim()
  if (!id) return
  memoryLinks.delete(id)
  if (isRedisReady()) await redisDel(redisLinkKey(id))
}

export function buildPasswordResetUrl(token) {
  const id = String(token || '').trim()
  // 仅用站点根地址，绝不拼接后台入口路径
  let base = getPublicSiteUrl()
  try {
    if (base) {
      const u = new URL(base)
      base = `${u.protocol}//${u.host}`
    }
  } catch {
    base = String(base || '').replace(/\/+$/, '')
  }
  const path = `/password-reset/?token=${encodeURIComponent(id)}`
  if (base) return `${base}${path}`
  return path
}

export function maskEmail(email) {
  const e = String(email || '').trim().toLowerCase()
  const at = e.indexOf('@')
  if (at <= 0) return ''
  const name = e.slice(0, at)
  const domain = e.slice(at + 1)
  if (name.length <= 1) return `*@${domain}`
  if (name.length === 2) return `${name[0]}*@${domain}`
  return `${name[0]}***${name[name.length - 1]}@${domain}`
}

export function maskPhone(phone) {
  const p = String(phone || '').trim().replace(/[\s-]/g, '')
  if (p.length < 7) return p ? '****' : ''
  return `${p.slice(0, 3)}****${p.slice(-4)}`
}

/**
 * @param {{ userId: number, username?: string, nickname?: string }} opts
 */
export async function createPasswordResetLink(opts) {
  const userId = Number(opts?.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    const err = new Error('无效的用户')
    err.status = 400
    throw err
  }
  const token = makeToken()
  const createdAt = nowMs()
  const expiresAt = createdAt + TTL_MS
  const link = {
    token,
    userId,
    username: String(opts?.username || '').trim() || null,
    nickname: String(opts?.nickname || '').trim() || null,
    createdAt,
    expiresAt,
    used: false
  }
  await saveLink(link)
  return {
    token,
    url: buildPasswordResetUrl(token),
    expiresAt,
    expiresInHours: Math.round(TTL_MS / 3600000)
  }
}

export async function getPasswordResetLink(token) {
  const link = await loadLink(token)
  if (!link) return null
  if (link.used) return null
  if ((Number(link.expiresAt) || 0) <= nowMs()) {
    await removeLink(token)
    return null
  }
  return link
}

export async function consumePasswordResetLink(token) {
  const link = await getPasswordResetLink(token)
  if (!link) return null
  link.used = true
  await removeLink(token)
  return link
}
