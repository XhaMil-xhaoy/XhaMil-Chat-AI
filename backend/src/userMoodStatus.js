/** QQ 风格心情状态：仅允许白名单 id */
export const MOOD_STATUS_CATALOG = [
  { id: 'quiet', emoji: '🧊', label: '想静静' },
  { id: 'chill', emoji: '🍹', label: '悠哉哉' },
  { id: 'weak_signal', emoji: '📶', label: '信号弱' },
  { id: 'sleeping', emoji: '😴', label: '睡觉中' },
  { id: 'homework', emoji: '📝', label: '肝作业' },
  { id: 'studying', emoji: '📖', label: '学习中' },
  { id: 'working', emoji: '🧱', label: '搬砖中' },
  { id: 'slacking', emoji: '🐟', label: '摸鱼中' },
  { id: 'bored', emoji: '😶', label: '无聊中' },
  { id: 'timi', emoji: '🎮', label: 'TiMi中' },
  { id: 'yuanmeng', emoji: '⭐', label: '一起元梦' },
  { id: 'star_buddy', emoji: '🌟', label: '求星搭子' },
  { id: 'late_night', emoji: '🐼', label: '熬夜中' },
  { id: 'binge', emoji: '📺', label: '追剧中' }
]

const byId = new Map(MOOD_STATUS_CATALOG.map((x) => [x.id, x]))

/** @type {Map<number, string>} */
const moodCache = new Map()

export function normalizeMoodStatus(raw) {
  const id = String(raw || '').trim()
  if (!id) return ''
  return byId.has(id) ? id : ''
}

export function moodStatusFields(raw) {
  const id = normalizeMoodStatus(raw)
  if (!id) {
    return { moodStatus: '', moodStatusLabel: '', moodStatusEmoji: '' }
  }
  const item = byId.get(id)
  return {
    moodStatus: id,
    moodStatusLabel: item?.label || '',
    moodStatusEmoji: item?.emoji || ''
  }
}

export function cacheUserMood(userId, raw) {
  const id = Number(userId)
  if (!id) return
  const mood = normalizeMoodStatus(raw)
  if (!mood) moodCache.delete(id)
  else moodCache.set(id, mood)
}

export function getCachedUserMood(userId) {
  const id = Number(userId)
  if (!id) return ''
  return moodCache.get(id) || ''
}

export function listMoodStatusCatalog() {
  return MOOD_STATUS_CATALOG.map((x) => ({ ...x }))
}
