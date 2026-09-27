/**
 * 免费表情包搜索：斗图啦 + 发表情。
 * 外链统一走本站 proxy，避免防盗链灰块。
 */

const MAX_WORDS = 20
const PAGE_SIZE = 48
const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const STICKER_PROXY_PREFIX = '/api/config/stickers/proxy?url='

function toProxyUrl(externalUrl) {
  const url = String(externalUrl || '').trim()
  if (!url) return ''
  if (url.startsWith('/media/') || url.startsWith('/api/')) return url
  return `${STICKER_PROXY_PREFIX}${encodeURIComponent(url)}`
}

function normalizeImageUrl(raw) {
  let url = String(raw || '')
    .trim()
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`
  if (!/^https:\/\//i.test(url) && !url.startsWith('/media/') && !url.startsWith('/api/')) {
    return ''
  }
  if (/\.(?:ico|svg)(?:[?#]|$)/i.test(url)) return ''
  if (/avatar|logo|icon|sprite|qrcode|bootstrap|static\.doutu/i.test(url)) return ''
  return url
}

function pushUnique(list, seen, imageUrl, filename) {
  const url = normalizeImageUrl(imageUrl)
  if (!url || seen.has(url)) return
  seen.add(url)
  // 外链统一转本站 proxy；已是 /api|/media 的保持原样
  const out = url.startsWith('/media/') || url.startsWith('/api/') ? url : toProxyUrl(url)
  if (!out) return
  list.push({ filename, url: out })
}

async function fetchText(url, { referer, timeoutMs = 6_000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/json,*/*',
        'User-Agent': UA,
        Referer: referer || url,
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`上游 ${res.status}`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** 斗图啦 */
async function searchDoutupk(words, pageNum) {
  const encoded = encodeURIComponent(words)
  const pathUrl =
    pageNum <= 1
      ? `https://www.doutupk.com/search?keyword=${encoded}`
      : `https://www.doutupk.com/search?keyword=${encoded}&page=${pageNum}`
  const html = await fetchText(pathUrl, {
    referer: 'https://www.doutupk.com/',
    timeoutMs: 7_000
  })
  const seen = new Set()
  const list = []
  const re = /data-original=["'](https?:\/\/[^"']+)["']/gi
  let m
  let i = 0
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
    if (!/doutula\.com|doutupk\.com|aliyuncs\.com|pkdoutu\.com/i.test(raw)) continue
    pushUnique(list, seen, raw, `dt_${pageNum}_${i}`)
    i += 1
    if (list.length >= PAGE_SIZE) break
  }
  return list
}

/** 发表情 */
async function searchFabiaoqing(words, pageNum) {
  const encoded = encodeURIComponent(words)
  const pathUrl =
    pageNum <= 1
      ? `https://fabiaoqing.com/search/bqb/keyword/${encoded}`
      : `https://fabiaoqing.com/search/bqb/keyword/${encoded}/page/${pageNum}.html`
  const html = await fetchText(pathUrl, {
    referer: 'https://fabiaoqing.com/',
    timeoutMs: 7_000
  })
  const re =
    /https?:\/\/(?:img\.)?(?:soutula\.com|sinaimg\.cn|fabiaoqing\.com)\/[^"'\\s<>]+?\.(?:gif|jpg|jpeg|png|webp)/gi
  const matches = html.match(re) || []
  const seen = new Set()
  const list = []
  for (let i = 0; i < matches.length; i += 1) {
    pushUnique(list, seen, matches[i], `fbq_${pageNum}_${i}`)
    if (list.length >= PAGE_SIZE) break
  }
  return list
}

export async function searchFreeStickers(query, page = 1) {
  const words = String(query || '').trim().slice(0, MAX_WORDS)
  const pageNum = Math.max(1, Math.min(50, Number(page) || 1))
  if (!words) {
    return { list: [], page: pageNum, query: '', source: '' }
  }

  const settled = await Promise.allSettled([
    searchDoutupk(words, pageNum),
    searchFabiaoqing(words, pageNum)
  ])

  const seen = new Set()
  const list = []
  const sources = []
  const order = [
    { name: 'doutupk', result: settled[0] },
    { name: 'fabiaoqing', result: settled[1] }
  ]
  for (const { name, result } of order) {
    if (result.status !== 'fulfilled') continue
    const chunk = result.value || []
    if (!chunk.length) continue
    sources.push(name)
    for (const item of chunk) {
      pushUnique(list, seen, item.url, item.filename)
      if (list.length >= PAGE_SIZE) break
    }
    if (list.length >= PAGE_SIZE) break
  }

  if (!list.length) {
    const errs = settled
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason || ''))
      .filter(Boolean)
    throw new Error(errs[0] || '未找到相关表情包')
  }

  return {
    list,
    page: pageNum,
    query: words,
    source: sources.join('+') || 'mixed'
  }
}
