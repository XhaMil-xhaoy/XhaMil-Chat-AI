;(() => {
  const cfg = Object.assign(
    {
      brandName: 'XhaMil',
      tagline: '聊聊 · 更轻松',
      headline: '年轻人的聊天方式',
      subline: '装上就能用 · 清爽界面 · 聊天更轻松',
      apiBase: '',
      fallbackApk: '',
      fallbackVersionName: ''
    },
    window.DOWNLOAD_PAGE_CONFIG || {}
  )

  if (!cfg.apiBase) cfg.apiBase = ''

  const $ = (id) => document.getElementById(id)

  function resolveUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    const base = String(cfg.apiBase || '').replace(/\/$/, '') || location.origin
    return raw.startsWith('/') ? base + raw : `${base}/${raw}`
  }

  function showToast(message) {
    const el = $('toast')
    if (!el) return
    el.textContent = message
    el.classList.add('is-show')
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => el.classList.remove('is-show'), 1800)
  }

  function setButton({ label, enabled }) {
    const btn = $('downloadBtn')
    if (!btn) return
    if ($('btnLabel')) $('btnLabel').textContent = label
    if (enabled) {
      btn.href = '#download'
      btn.setAttribute('aria-disabled', 'false')
    } else {
      btn.href = '#'
      btn.setAttribute('aria-disabled', 'true')
    }
  }

  function setVersionMeta({ versionName, publishedAt }) {
    const ver = String(versionName || '').trim()
    const date = String(publishedAt || '').trim()
    const nameEl = $('verName')
    const metaEl = $('verMeta')
    const foot = $('metaVersion')
    if (nameEl) nameEl.textContent = ver ? `v${ver}` : '—'
    if (foot) foot.textContent = ver ? `v${ver}` : '—'
    if (metaEl) {
      if (ver && date) {
        metaEl.innerHTML = `当前版本 <b>v${ver}</b><span class="sep"></span>发布于 <b>${date}</b>`
      } else if (ver) {
        metaEl.innerHTML = `当前版本 <b>v${ver}</b>`
      } else {
        metaEl.textContent = '当前版本 —'
      }
    }
  }

  function applyBrand() {
    const name = String(cfg.brandName || 'XhaMil').trim() || 'XhaMil'
    if ($('brandName')) $('brandName').textContent = name
    if ($('footBrand')) $('footBrand').textContent = name
    if ($('brandTag')) $('brandTag').textContent = cfg.tagline || ''
    if ($('headline')) $('headline').textContent = cfg.headline || `下载 ${name}`
    if ($('subline')) $('subline').textContent = cfg.subline || ''
    const icon = cfg.iconUrl ? resolveUrl(cfg.iconUrl) : './icon.png'
    const el = $('brandIcon')
    if (el) {
      el.src = icon
      el.alt = name
    }
    document.title = `${name} · 下载`
    if ($('year')) $('year').textContent = String(new Date().getFullYear())
  }

  function bindQr() {
    const img = $('qrImg')
    if (!img) return
    const bust = Date.now()
    img.src = `./qr.png?v=${bust}`
    img.onerror = () => {
      if (!img.dataset.apiTried) {
        img.dataset.apiTried = '1'
        const base = String(cfg.apiBase || '').replace(/\/$/, '') || location.origin
        img.src = `${base}/api/download-page/qr.png?v=${bust}`
        return
      }
      img.alt = '二维码加载失败，请点上方按钮下载'
      img.style.opacity = '0.35'
    }
  }

  function showQueryError() {
    try {
      const err = new URLSearchParams(location.search).get('err')
      if (err) showToast(decodeURIComponent(err))
    } catch (_) {}
  }

  let downloadBusy = false

  async function loadUpdate() {
    const base = String(cfg.apiBase || '').replace(/\/$/, '')
    try {
      const res = await fetch(`${base}/api/config/download-page`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data = json?.data || json || {}
      const versionName = String(data.versionName || '').trim()
      const publishedAt = String(data.publishedAt || '').trim()
      const ready = data.show !== false && data.downloadReady !== false

      if (data.brandName !== undefined && data.brandName !== null) {
        const n = String(data.brandName).trim()
        if (n) cfg.brandName = n
      }
      if (data.tagline !== undefined && data.tagline !== null) {
        const t = String(data.tagline).trim()
        if (t) cfg.tagline = t
      }
      if (data.iconUrl !== undefined && data.iconUrl !== null) {
        cfg.iconUrl = String(data.iconUrl).trim()
      }
      applyBrand()

      if (data.title && $('headline')) $('headline').textContent = String(data.title)
      if (data.subtitle && $('subline')) $('subline').textContent = String(data.subtitle)

      setVersionMeta({ versionName, publishedAt })

      if (!ready) {
        setButton({ label: '暂无安装包', enabled: false })
        if ($('hint')) $('hint').textContent = '后台还没上传 APK，或已关闭下载'
        if ($('versionLine')) $('versionLine').textContent = '等待上传安装包'
        return
      }

      setButton({ label: 'Android 下载', enabled: true })
      if ($('hint')) $('hint').textContent = '仅支持 Android · 安装时请允许「未知来源」'
      if ($('versionLine')) $('versionLine').textContent = '扫码或点击上方按钮下载安装包'
    } catch (err) {
      console.warn('[download]', err)
      setButton({ label: '暂时无法下载', enabled: false })
      if ($('hint')) $('hint').textContent = '无法读取版本信息'
      if ($('versionLine')) $('versionLine').textContent = '加载失败，请稍后刷新重试'
      setVersionMeta({ versionName: '', publishedAt: '' })
    }
  }

  async function startProtectedDownload(e) {
    e?.preventDefault?.()
    const a = e?.currentTarget
    if (!a || a.getAttribute('aria-disabled') === 'true') return
    if (downloadBusy) return
    downloadBusy = true
    const prevLabel = $('btnLabel')?.textContent
    if ($('btnLabel')) $('btnLabel').textContent = '正在准备…'
    try {
      const base = String(cfg.apiBase || '').replace(/\/$/, '')
      const res = await fetch(`${base}/api/download-page/ticket`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`)
      const data = json?.data || json || {}
      const href = resolveUrl(data.apkUrl)
      if (!href) throw new Error('未获取到下载地址')
      showToast('开始下载…')
      window.location.assign(href)
    } catch (err) {
      console.warn('[download] ticket', err)
      showToast(err?.message || '获取下载链接失败')
    } finally {
      downloadBusy = false
      if ($('btnLabel') && prevLabel) $('btnLabel').textContent = prevLabel
    }
  }

  applyBrand()
  bindQr()
  showQueryError()
  loadUpdate()
  $('downloadBtn')?.addEventListener('click', startProtectedDownload)
})()
