import { Router } from 'express'
import { isValidEmail, normalizeEmail } from '../email.js'
import {
  consumeRegisterEmailCode,
  sendPasswordResetEmailCode,
  verifyRegisterEmailCode
} from '../emailCodes.js'
import {
  sendPasswordResetSmsCode,
  verifyLoginSmsCode
} from '../smsCodes.js'
import { isValidCnPhone, normalizePhone } from '../aliyunSms.js'
import { findUserById, resetUserPasswordById } from '../db.js'
import {
  consumePasswordResetLink,
  getPasswordResetLink,
  maskEmail,
  maskPhone
} from '../passwordResetLink.js'
import { fail, ok } from '../response.js'
import { revokeUserSessionsByUserId } from '../userAuth.js'

const router = Router()

function publicUserFromRow(user) {
  const email = String(user?.email || '').trim()
  const phone = String(user?.phone || '').trim().replace(/[\s-]/g, '')
  return {
    nickname: String(user?.nickname || user?.username || '').trim() || '用户',
    username: String(user?.username || '').trim() || null,
    hasEmail: !!email,
    hasPhone: !!phone,
    emailMasked: email ? maskEmail(email) : '',
    phoneMasked: phone ? maskPhone(phone) : ''
  }
}

router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    const link = await getPasswordResetLink(token)
    if (!link) return fail(res, 404, '改密链接无效或已过期')
    const user = await findUserById(link.userId)
    if (!user || user.status === 'banned') {
      return fail(res, 404, '用户不存在或已失效')
    }
    if (!user.email && !user.phone) {
      return fail(res, 400, '该账号未绑定邮箱或手机号，无法通过链接改密')
    }
    return ok(res, {
      ...publicUserFromRow(user),
      expiresAt: link.expiresAt
    })
  } catch (e) {
    return fail(res, e.status || 500, e.message || '查询失败')
  }
})

router.post('/:token/send-code', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    const link = await getPasswordResetLink(token)
    if (!link) return fail(res, 404, '改密链接无效或已过期')
    const user = await findUserById(link.userId)
    if (!user || user.status !== 'active') {
      return fail(res, 404, '用户不存在或已失效')
    }

    const method = String(req.body?.method || '').trim().toLowerCase()
    if (method === 'email' || method === 'mail') {
      const email = normalizeEmail(req.body?.email || req.body?.contact)
      if (!isValidEmail(email)) return fail(res, 400, '请输入有效邮箱')
      const bound = normalizeEmail(user.email)
      if (!bound) return fail(res, 400, '该账号未绑定邮箱')
      if (email !== bound) return fail(res, 400, '邮箱与账号绑定不一致')
      await sendPasswordResetEmailCode(req, email)
      return ok(res, { method: 'email', contactMasked: maskEmail(email) }, '验证码已发送到邮箱')
    }

    if (method === 'phone' || method === 'sms' || method === 'mobile') {
      const phone = normalizePhone(req.body?.phone || req.body?.mobile || req.body?.contact)
      if (!isValidCnPhone(phone)) return fail(res, 400, '请输入有效手机号')
      const bound = normalizePhone(user.phone)
      if (!bound) return fail(res, 400, '该账号未绑定手机号')
      if (phone !== bound) return fail(res, 400, '手机号与账号绑定不一致')
      await sendPasswordResetSmsCode(req, phone)
      return ok(res, { method: 'phone', contactMasked: maskPhone(phone) }, '验证码已发送到手机')
    }

    return fail(res, 400, '请选择邮箱找回或手机号找回')
  } catch (e) {
    return fail(res, e.status || 500, e.message || '发送失败')
  }
})

router.post('/:token/reset', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    const link = await getPasswordResetLink(token)
    if (!link) return fail(res, 404, '改密链接无效或已过期')
    const user = await findUserById(link.userId)
    if (!user || user.status !== 'active') {
      return fail(res, 404, '用户不存在或已失效')
    }

    const method = String(req.body?.method || '').trim().toLowerCase()
    const code = String(req.body?.code || req.body?.verifyCode || '').trim()
    const newPassword = String(req.body?.newPassword ?? req.body?.password ?? '')
    const confirmPassword =
      req.body?.confirmPassword != null ? String(req.body.confirmPassword) : null
    if (confirmPassword != null && confirmPassword !== newPassword) {
      return fail(res, 400, '两次新密码不一致')
    }
    if (newPassword.length < 6) return fail(res, 400, '新密码至少 6 位')

    if (method === 'email' || method === 'mail') {
      const email = normalizeEmail(req.body?.email || req.body?.contact)
      if (!isValidEmail(email)) return fail(res, 400, '请输入有效邮箱')
      if (email !== normalizeEmail(user.email)) {
        return fail(res, 400, '邮箱与账号绑定不一致')
      }
      const checked = verifyRegisterEmailCode(email, code)
      if (!checked.ok) return fail(res, 400, checked.message || '验证码错误')
      await resetUserPasswordById(user.id, newPassword)
      consumeRegisterEmailCode(email)
      await consumePasswordResetLink(token)
      revokeUserSessionsByUserId(user.id)
      return ok(res, null, '密码已修改，请使用新密码登录')
    }

    if (method === 'phone' || method === 'sms' || method === 'mobile') {
      const phone = normalizePhone(req.body?.phone || req.body?.mobile || req.body?.contact)
      if (!isValidCnPhone(phone)) return fail(res, 400, '请输入有效手机号')
      if (phone !== normalizePhone(user.phone)) {
        return fail(res, 400, '手机号与账号绑定不一致')
      }
      const checked = await verifyLoginSmsCode(phone, code)
      if (!checked.ok) return fail(res, 400, checked.message || '验证码错误')
      await resetUserPasswordById(user.id, newPassword)
      await consumePasswordResetLink(token)
      revokeUserSessionsByUserId(user.id)
      return ok(res, null, '密码已修改，请使用新密码登录')
    }

    return fail(res, 400, '请选择邮箱找回或手机号找回')
  } catch (e) {
    return fail(res, e.status || 500, e.message || '修改密码失败')
  }
})

export default router
