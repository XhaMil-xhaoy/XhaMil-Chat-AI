import fs from 'fs'
import path from 'path'
import { AVATAR_DIR, AVATAR_URL_PREFIX, isDefaultAvatarUrl } from './config.js'

/** 规范化头像 URL，兼容旧路径格式；去掉 ?v= 缓存戳便于引用比对 */
export function normalizeAvatarPath(p) {
  if (!p || typeof p !== 'string') return ''
  try {
    let s = String(p).trim()
    if (!s) return ''
    // 组合群头像等会带 ?v=时间戳，比对/占用统计必须去掉
    s = s.split('#')[0].split('?')[0].trim()
    if (!s) return ''
    if (/^(https?:)?\/\//i.test(s)) return s
    if (s.startsWith('/media/avatar/')) return s.replace(/\\/g, '/').replace(/\/+/g, '/')
    if (s.startsWith('media/avatar/')) {
      return ('/' + s).replace(/\\/g, '/').replace(/\/+/g, '/')
    }
    // 兼容 XhaMil Chat 旧格式 /avatars/
    if (s.startsWith('/avatars/')) {
      return `${AVATAR_URL_PREFIX}/${s.slice('/avatars/'.length)}`.replace(/\/+/g, '/')
    }
    if (s.startsWith('avatars/')) {
      return `${AVATAR_URL_PREFIX}/${s.slice('avatars/'.length)}`.replace(/\/+/g, '/')
    }
    if (s.startsWith('/avatar/') && !s.startsWith('/media/avatar/')) {
      return `${AVATAR_URL_PREFIX}/${s.slice('/avatar/'.length)}`.replace(/\/+/g, '/')
    }
    if (s.startsWith('avatar/') && !s.startsWith('avatar-')) {
      return `${AVATAR_URL_PREFIX}/${s.slice('avatar/'.length)}`.replace(/\/+/g, '/')
    }
    if (/^avatar-[^/\\]+\.(jpg|jpeg|png|gif|webp)$/i.test(s)) {
      return `${AVATAR_URL_PREFIX}/${s}`.replace(/\/+/g, '/')
    }
    return s.replace(/\\/g, '/').replace(/\/+/g, '/')
  } catch {
    return ''
  }
}

export function isDefaultAvatar(avatarPath) {
  return isDefaultAvatarUrl(avatarPath)
}

export async function isAvatarPathUsed(avatarPath, mysqlPool) {
  const norm = normalizeAvatarPath(avatarPath)
  if (!norm) return false
  if (isDefaultAvatar(norm)) return true

  const [userRows] = await mysqlPool.query(
    'SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ""'
  )
  for (const row of userRows) {
    if (normalizeAvatarPath(row.avatar_url) === norm) return true
  }

  const [convRows] = await mysqlPool.query(
    'SELECT avatar_url FROM conversations WHERE avatar_url IS NOT NULL AND avatar_url != ""'
  )
  for (const row of convRows) {
    if (normalizeAvatarPath(row.avatar_url) === norm) return true
  }

  try {
    const [botRows] = await mysqlPool.query(
      'SELECT avatar_url FROM ai_bots WHERE avatar_url IS NOT NULL AND avatar_url != ""'
    )
    for (const row of botRows) {
      if (normalizeAvatarPath(row.avatar_url) === norm) return true
    }
  } catch {
    // ai_bots 表尚未创建时忽略
  }

  return false
}

/** 安全删除头像文件：默认头像不删；仍被引用时不删 */
export async function safeDeleteAvatarFile(avatarPath, mysqlPool) {
  const norm = normalizeAvatarPath(avatarPath)
  if (!norm || !norm.startsWith(`${AVATAR_URL_PREFIX}/`)) return
  if (isDefaultAvatar(norm)) return

  const filename = norm.slice(`${AVATAR_URL_PREFIX}/`.length)
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) return

  if (mysqlPool && (await isAvatarPathUsed(avatarPath, mysqlPool))) return

  const abs = path.join(AVATAR_DIR, filename)
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs)
    } catch {
      // 删除失败不影响主流程
    }
  }
}

export function avatarUrlFromFilename(filename) {
  return `${AVATAR_URL_PREFIX}/${filename}`
}

function safeFilename(name) {
  const base = path.basename(String(name || ''))
  if (!base || base.includes('..') || /[\\/]/.test(base)) return null
  return base
}

export async function buildAvatarUsageMap(mysqlPool) {
  const map = new Map()
  const [userRows] = await mysqlPool.query(
    'SELECT id, username, nickname, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ""'
  )
  for (const row of userRows) {
    const norm = normalizeAvatarPath(row.avatar_url)
    if (!norm) continue
    if (!map.has(norm)) map.set(norm, [])
    map.get(norm).push({
      type: 'user',
      id: row.id,
      username: row.username,
      nickname: row.nickname
    })
  }
  const [convRows] = await mysqlPool.query(
    `SELECT id, title, avatar_url, group_code AS groupCode, conv_type AS convType
     FROM conversations WHERE avatar_url IS NOT NULL AND avatar_url != ""`
  )
  for (const row of convRows) {
    const norm = normalizeAvatarPath(row.avatar_url)
    if (!norm) continue
    if (!map.has(norm)) map.set(norm, [])
    map.get(norm).push({
      type: 'conversation',
      id: row.id,
      convType: row.convType || '',
      groupCode: row.groupCode || '',
      username: row.title,
      nickname: row.title
    })
  }

  try {
    const [botRows] = await mysqlPool.query(
      'SELECT id, name, avatar_url FROM ai_bots WHERE avatar_url IS NOT NULL AND avatar_url != ""'
    )
    for (const row of botRows) {
      const norm = normalizeAvatarPath(row.avatar_url)
      if (!norm) continue
      if (!map.has(norm)) map.set(norm, [])
      map.get(norm).push({
        type: 'ai_bot',
        id: row.id,
        username: row.name,
        nickname: row.name
      })
    }
  } catch {
    // ai_bots 表尚未创建时忽略
  }

  return map
}

export async function listAvatarFiles(mysqlPool) {
  if (!fs.existsSync(AVATAR_DIR)) {
    return { dir: AVATAR_DIR, list: [], totalSize: 0 }
  }
  // 顺手清掉已解散群留下的组合头像，避免后台堆一堆「未使用」
  if (mysqlPool) {
    await cleanupOrphanGroupMosaicFiles(mysqlPool).catch((e) => {
      console.warn('[avatar] orphan mosaic cleanup failed', e?.message || e)
    })
  }
  const usageMap = mysqlPool ? await buildAvatarUsageMap(mysqlPool) : new Map()
  const entries = fs.readdirSync(AVATAR_DIR, { withFileTypes: true })
  const list = entries
    .filter((e) => e.isFile())
    .map((e) => {
      const filePath = path.join(AVATAR_DIR, e.name)
      const stat = fs.statSync(filePath)
      const url = avatarUrlFromFilename(e.name)
      const usedBy = usageMap.get(url) || []
      const isDefault = isDefaultAvatar(url)
      return {
        filename: e.name,
        url,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        isDefault,
        inUse: isDefault || usedBy.length > 0,
        usedBy
      }
    })
    .sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  const totalSize = list.reduce((sum, item) => sum + item.size, 0)
  return { dir: AVATAR_DIR, list, totalSize }
}

/** 删除无对应群聊的 group-mosaic-*.webp */
export async function cleanupOrphanGroupMosaicFiles(mysqlPool) {
  if (!fs.existsSync(AVATAR_DIR) || !mysqlPool) return { deleted: 0 }
  const names = fs
    .readdirSync(AVATAR_DIR)
    .filter((n) => /^group-mosaic-\d+\.webp$/i.test(n))
  if (!names.length) return { deleted: 0 }

  const ids = names
    .map((n) => Number(/^group-mosaic-(\d+)\.webp$/i.exec(n)?.[1]))
    .filter((id) => id > 0)
  if (!ids.length) return { deleted: 0 }

  const [rows] = await mysqlPool.query(
    `SELECT id FROM conversations
     WHERE conv_type = 'group' AND id IN (${ids.map(() => '?').join(',')})`,
    ids
  )
  const alive = new Set(rows.map((r) => Number(r.id)))
  let deleted = 0
  for (const name of names) {
    const id = Number(/^group-mosaic-(\d+)\.webp$/i.exec(name)?.[1])
    if (!id || alive.has(id)) continue
    const abs = path.join(AVATAR_DIR, name)
    try {
      fs.unlinkSync(abs)
      deleted += 1
    } catch {
      /* ignore */
    }
  }
  if (deleted > 0) {
    console.log(`[avatar] cleaned ${deleted} orphan group-mosaic files`)
  }
  return { deleted }
}

export async function deleteAvatarFileForAdmin(filename, mysqlPool) {
  const safe = safeFilename(filename)
  if (!safe) throw new Error('无效的文件名')
  const url = avatarUrlFromFilename(safe)
  if (isDefaultAvatar(url)) throw new Error('默认头像不可删除')
  if (mysqlPool && (await isAvatarPathUsed(url, mysqlPool))) {
    throw new Error('该头像仍被用户或会话引用，无法删除')
  }
  const abs = path.join(AVATAR_DIR, safe)
  if (!fs.existsSync(abs)) throw new Error('文件不存在')
  fs.unlinkSync(abs)
  return { filename: safe }
}
