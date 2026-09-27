import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fail, ok } from '../response.js'
import { enqueuePackJob, getJobMeta, getJobApkPath } from '../packWorker.js'
import { ensureLocalBaseFromOfficial, readPackBaseVersion } from '../packSync.js'
import { PACK_JOBS_DIR } from '../config.js'
import { loadConfig } from '../config.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 }
})

const PACK_FIELDS = [
  { name: 'icon', maxCount: 1 },
  { name: 'loginArt', maxCount: 1 },
  { name: 'splashArt', maxCount: 1 },
  { name: 'aboutArt', maxCount: 1 }
]

router.get('/pack/base-info', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const synced = await ensureLocalBaseFromOfficial(loadConfig())
    const local = readPackBaseVersion()
    const versionName = local.versionName || synced.versionName || ''
    const versionCode = Number(local.versionCode || synced.versionCode) || 0
    if (!versionName || versionCode < 1) {
      return fail(res, 503, '底包尚未就绪：请先在官方 App 发版选用安装包')
    }
    return ok(res, {
      versionName,
      versionCode,
      packageName: local.packageName || synced.packageName || '',
      ready: true,
      readonly: true
    })
  } catch (e) {
    return fail(res, 503, e.message || '同步底包失败')
  }
})

router.post('/pack', (req, res) => {
  upload.fields(PACK_FIELDS)(req, res, async (err) => {
    if (err) {
      const msg = String(err.message || '')
      if (/File too large|LIMIT_FILE_SIZE/i.test(msg) || err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 400, '图片过大（图标≤2MB，插图≤5MB）')
      }
      return fail(res, 400, err.message || '上传失败')
    }
    try {
      await ensureLocalBaseFromOfficial(loadConfig())
      const base = readPackBaseVersion()
      const versionName = base.versionName
      const versionCode = Number(base.versionCode) || 0
      if (!versionName || versionCode < 1) return fail(res, 503, '底包未就绪')

      const files = req.files || {}
      const icon = files.icon?.[0]
      if (icon && icon.size > 2 * 1024 * 1024) return fail(res, 400, '应用图标请小于 2MB')

      const officialName = String(req.body?.officialName || req.body?.appName || '').trim()
      const packageName = String(req.body?.packageName || '').trim()
      const serverUrl = String(req.body?.serverUrl || '')
        .trim()
        .replace(/\/+$/, '')
      const note = String(req.body?.note || '').trim()

      if (!officialName) return fail(res, 400, '请填写官方名称')
      if (!packageName) return fail(res, 400, '请填写包名')
      if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
        return fail(res, 400, '包名格式不正确，例如 com.xinghe.chat')
      }
      if (packageName.length > 64) return fail(res, 400, '包名过长')
      if (!serverUrl) return fail(res, 400, '请填写服务器地址')
      if (!/^https?:\/\//i.test(serverUrl)) {
        return fail(res, 400, '服务器地址需以 http:// 或 https:// 开头')
      }
      if (serverUrl.includes('/api')) {
        return fail(res, 400, '请填写根地址，不要带 /api')
      }
      if (!icon?.buffer?.length) return fail(res, 400, '请上传 App 图标')

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const jobDir = path.join(PACK_JOBS_DIR, jobId)
      fs.mkdirSync(jobDir, { recursive: true })

      const saveUpload = (file, basename) => {
        if (!file?.buffer?.length) return ''
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
        const fp = path.join(jobDir, `${basename}${ext}`)
        fs.writeFileSync(fp, file.buffer)
        return path.basename(fp)
      }

      const meta = {
        id: jobId,
        officialName,
        appName: officialName,
        packageName,
        versionName,
        versionCode,
        serverUrl,
        note,
        icon: saveUpload(icon, 'icon'),
        loginArt: saveUpload(files.loginArt?.[0], 'loginArt'),
        splashArt: saveUpload(files.splashArt?.[0], 'splashArt'),
        aboutArt: saveUpload(files.aboutArt?.[0], 'aboutArt'),
        status: 'queued',
        progress: 0,
        stage: 'queued',
        createdAt: new Date().toISOString(),
        message: '任务已创建，即将开始打包…'
      }
      fs.writeFileSync(path.join(jobDir, 'meta.json'), JSON.stringify(meta, null, 2))
      enqueuePackJob(jobId)
      return ok(
        res,
        { jobId },
        `「${officialName}」${packageName} v${versionName}（${versionCode}）已开始打包`
      )
    } catch (e) {
      return fail(res, 400, e.message || '提交失败')
    }
  })
})

router.get('/pack/jobs/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const meta = getJobMeta(req.params.id)
  if (!meta) return fail(res, 404, '任务不存在')
  return ok(res, {
    id: meta.id,
    status: meta.status,
    progress: meta.progress ?? 0,
    stage: meta.stage || '',
    message: meta.message || '',
    downloadUrl: meta.status === 'done' ? `/api/pack/jobs/${req.params.id}/download` : null,
    apkFile: meta.apkFile || null,
    error: meta.error || null
  })
})

router.get('/pack/jobs/:id/download', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const meta = getJobMeta(req.params.id)
  if (!meta) return fail(res, 404, '任务不存在')
  if (meta.status !== 'done') return fail(res, 409, '尚未打包完成')
  const apkPath = getJobApkPath(req.params.id)
  if (!apkPath) return fail(res, 404, '安装包不存在')
  return res.download(apkPath, meta.apkFile || path.basename(apkPath))
})

export default router
