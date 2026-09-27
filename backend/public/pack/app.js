const form = document.getElementById('packForm')
const iconFile = document.getElementById('iconFile')
const iconPreview = document.getElementById('iconPreview')
const iconBox = document.getElementById('iconBox')
const submitBtn = document.getElementById('submitBtn')
const result = document.getElementById('result')
const progressWrap = document.getElementById('progressWrap')
const progressBar = document.getElementById('progressBar')
const progressText = document.getElementById('progressText')
const progressPct = document.getElementById('progressPct')
const ctaHint = document.getElementById('ctaHint')
const doneActions = document.getElementById('doneActions')
const downloadBtn = document.getElementById('downloadBtn')
const repackBtn = document.getElementById('repackBtn')

let selectedIcon = null
const selectedArts = { loginArt: null, splashArt: null, aboutArt: null }
let pollTimer = null
let downloadStartedFor = null

function bindCounter(inputId, counterId, max) {
  const input = document.getElementById(inputId)
  const counter = document.getElementById(counterId)
  if (!input || !counter) return
  const update = () => {
    counter.textContent = `${String(input.value || '').length}/${max}`
  }
  input.addEventListener('input', update)
  update()
}

bindCounter('officialName', 'nameCount', 20)
bindCounter('packageName', 'pkgCount', 50)
bindCounter('note', 'descCount', 200)

const serverUrlEl = document.getElementById('serverUrl')
if (serverUrlEl && !serverUrlEl.value) {
  serverUrlEl.value = location.origin
}

async function loadBaseVersion() {
  const nameEl = document.getElementById('versionName')
  const codeEl = document.getElementById('versionCode')
  try {
    const res = await fetch('/api/pack/base-info', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || json || {}
    if (!res.ok) throw new Error(json.message || data.message || '读取底包版本失败')
    nameEl.value = data.versionName || ''
    codeEl.value = data.versionCode != null ? String(data.versionCode) : ''
  } catch (err) {
    nameEl.placeholder = '识别失败'
    codeEl.placeholder = '识别失败'
    showResult(err.message || '无法同步官方底包', 'error')
  }
}
loadBaseVersion()

iconBox?.addEventListener('click', () => iconFile.click())
iconFile?.addEventListener('change', () => {
  const file = iconFile.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    showResult('图标请小于 2MB', 'error')
    iconFile.value = ''
    return
  }
  selectedIcon = file
  const url = URL.createObjectURL(file)
  iconPreview.innerHTML = `<img src="${url}" alt="icon preview" />`
})

document.querySelectorAll('.art-upload').forEach((box) => {
  const key = box.dataset.art
  const input = box.querySelector('input[type="file"]')
  const preview = box.querySelector('.art-preview')
  if (!key || !input || !preview) return
  box.addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showResult('插图请小于 5MB', 'error')
      input.value = ''
      return
    }
    selectedArts[key] = file
    preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="${key}" />`
  })
})

function setStep(n) {
  document.querySelectorAll('.step').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.step) <= n)
  })
}

submitBtn?.addEventListener('click', () => {
  if (submitBtn.disabled) return
  form.requestSubmit()
})

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const officialName = document.getElementById('officialName').value.trim()
  const packageName = document.getElementById('packageName').value.trim()
  const versionName = document.getElementById('versionName').value.trim()
  const versionCode = Number(document.getElementById('versionCode').value.trim())
  const serverUrl = document.getElementById('serverUrl').value.trim()
  const note = document.getElementById('note').value.trim()

  if (!officialName) return showResult('请填写应用名称', 'error')
  if (!packageName) return showResult('请填写应用包名', 'error')
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
    return showResult('包名格式不正确，例如 com.example.app', 'error')
  }
  if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
    return showResult('底包版本尚未识别，请刷新页面重试', 'error')
  }
  if (!serverUrl) return showResult('请填写应用地址', 'error')
  if (!/^https?:\/\//i.test(serverUrl)) {
    return showResult('应用地址需以 http:// 或 https:// 开头', 'error')
  }
  if (serverUrl.includes('/api')) {
    return showResult('请填写根地址，不要带 /api', 'error')
  }
  if (!selectedIcon) return showResult('请先上传应用图标', 'error')

  const fd = new FormData()
  fd.append('officialName', officialName)
  fd.append('packageName', packageName)
  fd.append('serverUrl', serverUrl.replace(/\/+$/, ''))
  fd.append('note', note)
  fd.append('icon', selectedIcon)
  if (selectedArts.loginArt) fd.append('loginArt', selectedArts.loginArt)
  if (selectedArts.splashArt) fd.append('splashArt', selectedArts.splashArt)
  if (selectedArts.aboutArt) fd.append('aboutArt', selectedArts.aboutArt)

  stopPoll()
  downloadStartedFor = null
  doneActions.classList.add('hidden')
  submitBtn.disabled = true
  submitBtn.textContent = '正在打包…'
  ctaHint.textContent = '正在同步底包并准备应用…'
  setStep(2)
  setProgress(2, '正在提交打包任务…')
  showResult('正在提交打包任务…', '')

  try {
    const res = await fetch('/api/pack', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    const data = json?.data || json || {}
    if (!res.ok) throw new Error(json.message || data.message || `提交失败 (${res.status})`)
    if (!data.jobId) throw new Error('未返回任务 ID')
    showResult(json.message || '已开始打包', 'ok')
    setProgress(5, '排队中…')
    setStep(3)
    startPoll(data.jobId)
  } catch (err) {
    showResult(err.message || '网络异常', 'error')
    hideProgress()
    resetCta()
    setStep(1)
  }
})

function startPoll(jobId) {
  stopPoll()
  const tick = async () => {
    try {
      const res = await fetch(`/api/pack/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const data = json?.data || json || {}
      if (!res.ok) throw new Error(json.message || data.message || `查询失败`)

      const pct = Math.max(0, Math.min(100, Number(data.progress) || 0))
      setProgress(pct, data.message || stageLabel(data.stage))
      ctaHint.textContent = data.message || stageLabel(data.stage)

      if (data.status === 'done') {
        stopPoll()
        showResult('打包完成', 'ok')
        ctaHint.textContent = '安装包已生成'
        resetCta()
        const url = data.downloadUrl || `/api/pack/jobs/${encodeURIComponent(jobId)}/download`
        downloadBtn.href = url
        doneActions.classList.remove('hidden')
        if (downloadStartedFor !== jobId) {
          downloadStartedFor = jobId
          autoDownload(url)
        }
        return
      }
      if (data.status === 'error') {
        stopPoll()
        hideProgress()
        showResult(data.error || data.message || '打包失败', 'error')
        resetCta()
        setStep(1)
      }
    } catch (err) {
      setProgress(null, err.message || '进度查询失败，重试中…')
    }
  }
  tick()
  pollTimer = setInterval(tick, 1200)
}

function stopPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function autoDownload(url) {
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function stageLabel(stage) {
  const map = {
    queued: '正在准备应用…',
    prepare: '正在准备应用…',
    decode: '正在解包底包…',
    brand: '正在写入应用信息…',
    build: '正在生成安装包…',
    sign: '正在优化与签名…',
    done: '打包完成'
  }
  return map[stage] || '正在打包…'
}

function setProgress(pct, text) {
  progressWrap.classList.remove('hidden')
  if (typeof pct === 'number') {
    progressBar.style.width = `${pct}%`
    progressPct.textContent = `${Math.round(pct)}%`
  }
  if (text) progressText.textContent = text
}

function hideProgress() {
  progressWrap.classList.add('hidden')
  progressBar.style.width = '0%'
  progressPct.textContent = '0%'
  progressText.textContent = ''
}

function showResult(text, type) {
  result.classList.remove('hidden', 'error', 'ok')
  if (type) result.classList.add(type)
  result.textContent = text
}

function resetCta() {
  submitBtn.disabled = false
  submitBtn.textContent = '开始打包'
  ctaHint.textContent = '免费打包，完成后自动下载；底包随官方下载页选用包更新'
}

repackBtn?.addEventListener('click', () => {
  doneActions.classList.add('hidden')
  hideProgress()
  result.classList.add('hidden')
  resetCta()
  setStep(1)
  loadBaseVersion()
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
