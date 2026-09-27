import { DEFAULT_GROUP_AVATAR_URL } from './config.js'

export const BUTLER_NAME = '群管家'
export const BUTLER_AVATAR_URL = DEFAULT_GROUP_AVATAR_URL
export const DEFAULT_BUTLER_WELCOME = '欢迎进入群聊'
export const DEFAULT_BUTLER_LEAVE = '远走高飞了'

export function formatButlerWelcome(template, nickname) {
  const name = String(nickname || '新成员').trim() || '新成员'
  const tpl = String(template || DEFAULT_BUTLER_WELCOME).trim() || DEFAULT_BUTLER_WELCOME
  if (/\{昵称\}|\{nickname\}/i.test(tpl)) {
    return tpl.replace(/\{昵称\}/g, name).replace(/\{nickname\}/gi, name)
  }
  return `${name} ${tpl}`.trim()
}

export function formatButlerLeaveNotice(nickname, template) {
  const name = String(nickname || '某成员').trim() || '某成员'
  const tpl = String(template || DEFAULT_BUTLER_LEAVE).trim() || DEFAULT_BUTLER_LEAVE
  if (/\{昵称\}|\{nickname\}/i.test(tpl)) {
    return tpl.replace(/\{昵称\}/g, name).replace(/\{nickname\}/gi, name)
  }
  return `${name} ${tpl}`.trim()
}

export function formatMuteDurationLabel(minutes) {
  const m = Math.max(1, Math.round(Number(minutes) || 0))
  if (m < 60) return `${m}分钟`
  if (m < 60 * 24) {
    const hours = Math.floor(m / 60)
    const rest = m % 60
    return rest ? `${hours}小时${rest}分钟` : `${hours}小时`
  }
  const days = Math.floor(m / (60 * 24))
  const restHours = Math.floor((m % (60 * 24)) / 60)
  return restHours ? `${days}天${restHours}小时` : `${days}天`
}

export function formatButlerMemberMuteNotice(nickname, durationLabel) {
  const name = String(nickname || '某成员').trim() || '某成员'
  const duration = String(durationLabel || '').trim() || '一段时间'
  return `${name}被群主禁言${duration}`
}

export function formatButlerMemberUnmuteNotice(nickname) {
  const name = String(nickname || '某成员').trim() || '某成员'
  return `${name}被群主解除禁言`
}

export function formatButlerMemberSetAdminNotice(nickname) {
  const name = String(nickname || '某成员').trim() || '某成员'
  return `${name}被群主设置为管理员`
}

export function formatButlerMemberRemoveAdminNotice(nickname) {
  const name = String(nickname || '某成员').trim() || '某成员'
  return `${name}被群主取消管理员`
}

export function formatButlerAtMention(nickname) {
  const name = String(nickname || '某成员').trim() || '某成员'
  return `@${name}`
}

export function formatButlerBannedWordWarning(nickname) {
  return `${formatButlerAtMention(nickname)} 请勿输入涉及政治、领导人、色情、谣言等违禁词汇，违规将封禁账号`
}

export function formatButlerBannedWordSystemMuteNotice(nickname, minutes = 10) {
  const duration = formatMuteDurationLabel(minutes)
  return `${formatButlerAtMention(nickname)} 你已被系统禁言${duration}`
}

export function formatButlerAiAssignedNotice(botName) {
  const name = String(botName || 'AI').trim() || 'AI'
  return `此群已被分配 AI「${name}」`
}

/**
 * 邀请入群系统提示载荷（客户端可分段渲染可点击昵称）
 * @param {{ id: number, name: string }} inviter
 * @param {Array<{ id: number, name: string }>} members
 */
export function buildGroupInvitePayload(inviter, members) {
  const inv = {
    id: Number(inviter?.id) || 0,
    name: String(inviter?.name || '成员').trim() || '成员'
  }
  const list = (Array.isArray(members) ? members : [])
    .map((m) => ({
      id: Number(m?.id) || 0,
      name: String(m?.name || '').trim()
    }))
    .filter((m) => m.name)
  return JSON.stringify({
    t: 'group_invite',
    inviter: inv,
    members: list
  })
}

export function formatGroupInvitePlainText(inviterName, memberNames) {
  const inv = String(inviterName || '成员').trim() || '成员'
  const names = (Array.isArray(memberNames) ? memberNames : [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
  if (!names.length) return `${inv} 邀请成员加入了群聊`
  return `${inv} 邀请 ${names.join('、')} 加入了群聊`
}

/** 解析邀请入群提示：JSON 或纯文本「A 邀请 B、C 加入了群聊」 */
export function parseGroupInviteContent(content) {
  const raw = String(content || '').trim()
  if (!raw) return null
  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw)
      if (data && (data.t === 'group_invite' || data.type === 'group_invite')) {
        const inviter = {
          id: Number(data.inviter?.id) || 0,
          name: String(data.inviter?.name || '').trim() || '成员'
        }
        const members = (Array.isArray(data.members) ? data.members : [])
          .map((m) => ({
            id: Number(m?.id) || 0,
            name: String(m?.name || '').trim()
          }))
          .filter((m) => m.name)
        if (!members.length) return null
        return {
          inviter,
          members,
          plain: formatGroupInvitePlainText(
            inviter.name,
            members.map((m) => m.name)
          )
        }
      }
    } catch {
      /* fall through */
    }
  }
  const m = raw.match(/^(.+?)\s*邀请\s+(.+?)\s*加入了群聊\s*$/)
  if (!m) return null
  const inviterName = String(m[1] || '').trim()
  const namesPart = String(m[2] || '').trim()
  if (!inviterName || !namesPart) return null
  const memberNames = namesPart
    .split(/[、,，]/)
    .map((n) => n.trim())
    .filter(Boolean)
  if (!memberNames.length) return null
  return {
    inviter: { id: 0, name: inviterName },
    members: memberNames.map((name) => ({ id: 0, name })),
    plain: formatGroupInvitePlainText(inviterName, memberNames)
  }
}

export function mapButlerMessageRow(row, viewerUserId) {
  const messageType = 'butler'
  const imageUrl = row.image_url || row.imageUrl || ''
  return {
    id: row.id,
    conversationId: row.conversationId ?? row.conversation_id,
    userId: null,
    content: row.content || '',
    messageType,
    type: messageType,
    imageUrl,
    photoUrl: imageUrl,
    voiceUrl: '',
    voiceDuration: 0,
    isSelf: false,
    createdAt: row.createdAt ?? row.created_at,
    deletedAt: row.deletedAt ?? row.deleted_at ?? null,
    deleted: !!(row.deletedAt ?? row.deleted_at),
    username: BUTLER_NAME,
    nickname: BUTLER_NAME,
    avatarUrl: BUTLER_AVATAR_URL
  }
}
