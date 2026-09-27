import fs from 'fs'
import path from 'path'
import {
  CHAT_IMAGE_DIR,
  CHAT_IMAGE_URL_PREFIX,
  CHAT_MEDIA_RETENTION_MS,
  CHAT_VIDEO_DIR,
  CHAT_VIDEO_URL_PREFIX,
  MOMENTS_VIDEO_DIR,
  MOMENTS_VIDEO_URL_PREFIX
} from './config.js'
import { getMysqlPool } from './db.js'

const RETENTION_MS = CHAT_MEDIA_RETENTION_MS

let tableReady = null

function filenameOf(url) {
  const raw = String(url || '').trim().split('?')[0].replace(/\\/g, '/')
  if (!raw) return ''
  const name = raw.split('/').pop() || ''
  try {
    return path.basename(decodeURIComponent(name))
  } catch {
    return path.basename(name)
  }
}

function entryOfType(messageType, content) {
  const type = String(messageType || '').toLowerCase()
  const text = String(content || '')
  if (type === 'sticker' || text.includes('[[sticker]]')) return '表情'
  if (type === 'butler') return '群管家欢迎'
  if (type === 'announcement') return '群公告'
  if (type === 'photo_album') return '相册'
  if (type === 'motion_photo') return '实况图'
  if (type === 'video') return '聊天视频'
  return '聊天'
}

export function inferUploadEntry(messageType, content, fallback = '聊天') {
  const inferred = entryOfType(messageType, content)
  return inferred || fallback
}

async function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      const pool = getMysqlPool()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media_uploads (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          url VARCHAR(500) NOT NULL,
          kind VARCHAR(32) NOT NULL,
          user_id BIGINT NULL,
          entry_point VARCHAR(64) NOT NULL DEFAULT '聊天',
          message_id BIGINT NULL,
          sent_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_media_url (url(191)),
          KEY idx_media_kind (kind)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    })().catch((e) => {
      tableReady = null
      throw e
    })
  }
  return tableReady
}

export async function recordMediaUpload({ url, kind, userId, entry }) {
  const clean = String(url || '').trim()
  if (!clean) return
  try {
    await ensureTable()
    const pool = getMysqlPool()
    await pool.query(
      `INSERT INTO media_uploads (url, kind, user_id, entry_point)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = IFNULL(user_id, VALUES(user_id)),
         entry_point = IF(entry_point = '' OR entry_point = '聊天', VALUES(entry_point), entry_point)`,
      [clean.slice(0, 500), String(kind || 'chat_photo').slice(0, 32), Number(userId) || null, String(entry || '聊天').slice(0, 64)]
    )
  } catch (e) {
    console.warn('[media] record upload failed:', e.message || e)
  }
}

export async function bindSentMedia({ url, userId, messageId, messageType, content, extraUrls }) {
  const urls = [url, ...(Array.isArray(extraUrls) ? extraUrls : [])]
    .map((u) => String(u || '').trim())
    .filter(Boolean)
  if (!urls.length) return
  const entry = inferUploadEntry(messageType, content)
  const kind = String(messageType || '').toLowerCase() === 'video' ? 'chat_video' : 'chat_photo'
  try {
    await ensureTable()
    const pool = getMysqlPool()
    for (const item of urls) {
      await pool.query(
        `INSERT INTO media_uploads (url, kind, user_id, entry_point, message_id, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           message_id = VALUES(message_id),
           sent_at = IFNULL(sent_at, VALUES(sent_at)),
           user_id = IFNULL(user_id, VALUES(user_id)),
           entry_point = IF(entry_point = '' OR entry_point = '聊天', VALUES(entry_point), entry_point)`,
        [item.slice(0, 500), kind, Number(userId) || null, entry, Number(messageId) || null]
      )
    }
  } catch (e) {
    console.warn('[media] bind sent failed:', e.message || e)
  }
}

function urlsFromMessage(row) {
  const out = []
  const image = String(row.imageUrl || '').trim()
  if (image) out.push(image)
  if (String(row.messageType || '').toLowerCase() === 'photo_album') {
    try {
      const parsed = JSON.parse(String(row.content || ''))
      const list = Array.isArray(parsed?.urls) ? parsed.urls : []
      for (const u of list) {
        const s = String(u || '').trim()
        if (s) out.push(s)
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

async function loadUsageIndex() {
  const pool = getMysqlPool()
  await ensureTable()
  const [messages] = await pool.query(
    `SELECT m.image_url AS imageUrl, m.content, m.message_type AS messageType,
            m.created_at AS createdAt, m.user_id AS userId,
            COALESCE(NULLIF(TRIM(u.nickname), ''), u.username, '') AS senderName
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.deleted_at IS NULL
       AND (
         (m.image_url IS NOT NULL AND m.image_url <> '')
         OR m.message_type = 'photo_album'
       )`
  )
  const [uploads] = await pool.query(
    `SELECT mu.url, mu.kind, mu.entry_point AS entryPoint, mu.sent_at AS sentAt, mu.created_at AS createdAt,
            mu.user_id AS userId,
            COALESCE(NULLIF(TRIM(u.nickname), ''), u.username, '') AS senderName
     FROM media_uploads mu
     LEFT JOIN users u ON u.id = mu.user_id`
  )
  const byFile = new Map()
  const touch = (url, info) => {
    const name = filenameOf(url)
    if (!name) return
    const prev = byFile.get(name) || { refs: [] }
    prev.refs.push(info)
    byFile.set(name, prev)
  }
  for (const row of messages) {
    const sentAt = row.createdAt ? new Date(row.createdAt).getTime() : 0
    for (const url of urlsFromMessage(row)) {
      touch(url, {
        sentAt,
        userId: Number(row.userId) || 0,
        senderName: String(row.senderName || '').trim(),
        entry: entryOfType(row.messageType, row.content),
        messageType: String(row.messageType || '').toLowerCase(),
        sticker: entryOfType(row.messageType, row.content) === '表情'
      })
    }
  }
  for (const row of uploads) {
    const moment = row.kind === 'moment_video'
    touch(row.url, {
      sentAt: new Date(row.sentAt || row.createdAt || 0).getTime(),
      userId: Number(row.userId) || 0,
      senderName: String(row.senderName || '').trim(),
      entry: String(row.entryPoint || '').trim() || (moment ? '说说' : ''),
      messageType: row.kind === 'chat_video' || moment ? 'video' : 'photo',
      sticker: false,
      moment,
      uploadOnly: !row.sentAt
    })
  }
  return byFile
}

function summarize(name, index) {
  const bag = index.get(name)
  const refs = bag?.refs || []
  const moments = refs.filter((r) => r.moment)
  const real = refs.filter((r) => r.sentAt > 0 && !r.sticker && !r.moment)
  const stickers = refs.filter((r) => r.sticker)
  const pick = [...real].sort((a, b) => b.sentAt - a.sentAt)[0] || refs[0] || null
  const newest = real.reduce((max, r) => Math.max(max, r.sentAt || 0), 0)
  const remainMs = newest ? newest + RETENTION_MS - Date.now() : RETENTION_MS
  const remainDays = Math.max(0, Math.ceil(remainMs / (24 * 60 * 60 * 1000)))
  const noExpire = !real.length && (stickers.length > 0 || moments.length > 0)
  return {
    senderName: pick?.senderName || '',
    entryPoint:
      pick?.entry ||
      (moments.length && !real.length ? '说说' : stickers.length && !real.length ? '表情' : '聊天'),
    remainDays: noExpire ? null : remainDays,
    sentAt: newest ? new Date(newest).toISOString() : '',
    stickerOnly: stickers.length > 0 && real.length === 0,
    expired: real.length > 0 && newest > 0 && Date.now() - newest >= RETENTION_MS
  }
}

export async function enrichMediaList(list) {
  let index = new Map()
  try {
    index = await loadUsageIndex()
  } catch (e) {
    console.warn('[media] enrich failed:', e.message || e)
  }
  return list.map((item) => {
    const meta = summarize(item.filename, index)
    return {
      ...item,
      senderName: meta.senderName || '未知',
      entryPoint: meta.entryPoint || '聊天',
      remainDays: meta.remainDays,
      sentAt: meta.sentAt
    }
  })
}

function unlinkIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function purgeExpiredChatMedia() {
  let index
  try {
    index = await loadUsageIndex()
  } catch (e) {
    console.warn('[media] purge skipped:', e.message || e)
    return { purged: 0 }
  }
  let purged = 0
  const dirs = [
    { dir: CHAT_IMAGE_DIR, prefix: CHAT_IMAGE_URL_PREFIX },
    { dir: CHAT_VIDEO_DIR, prefix: CHAT_VIDEO_URL_PREFIX }
  ]
  for (const { dir } of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name)
      let st
      try {
        st = fs.statSync(filePath)
      } catch {
        continue
      }
      if (!st.isFile()) continue
      const meta = summarize(name, index)
      if (meta.stickerOnly) continue
      const known = index.has(name)
      const orphanOld = !known && Date.now() - st.mtimeMs >= RETENTION_MS
      if (meta.expired || orphanOld) {
        if (unlinkIfExists(filePath)) purged += 1
      }
    }
  }
  return { purged }
}

export function momentVideoFilename(name) {
  const base = path.basename(String(name || ''))
  if (!base || base.includes('..') || /[\\/]/.test(base)) return null
  return base
}

export { MOMENTS_VIDEO_DIR, MOMENTS_VIDEO_URL_PREFIX }
