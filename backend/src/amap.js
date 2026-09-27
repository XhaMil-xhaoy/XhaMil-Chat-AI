import { loadConfig, saveConfig } from './config.js'

const PLACE_SEARCH_URL = 'https://restapi.amap.com/v3/place/text'
const PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around'
const REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo'
const WEATHER_URL = 'https://restapi.amap.com/v3/weather/weatherInfo'
const DISTANCE_URL = 'https://restapi.amap.com/v3/distance'

/** 与高德控制台「服务平台」对齐的可配置项（不含已下线的智能硬件） */
const KEY_FIELDS = [
  'amapWebApiKey',
  'amapJsApiKey',
  'amapJsSecurityCode',
  'amapAndroidKey',
  'amapIosKey',
  'amapWechatMiniKey',
  'amapHarmonyKey'
]

function maskKey(key) {
  const s = String(key || '').trim()
  if (!s) return ''
  if (s.length <= 8) return `${s.slice(0, 2)}****`
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

function trim(config, field) {
  return String(config?.[field] || '').trim()
}

function webServiceKey(config = loadConfig()) {
  return trim(config, 'amapWebApiKey')
}

/** 选点页 JS：优先 Web 端 Key；旧配置只有 Web 服务时回退 */
function jsApiKey(config = loadConfig()) {
  return trim(config, 'amapJsApiKey') || webServiceKey(config)
}

export function isAmapConfigured(config = loadConfig()) {
  // 任一平台 Key 已填即视为「已配置」（开源交付可只填用到的）
  return KEY_FIELDS.some((f) => !!trim(config, f))
}

export function isAmapEnabled(config = loadConfig()) {
  if (config.amapEnabled === false) return false
  // 客户端露出「发送位置」：至少要有 Web 服务（搜点）或 Web 端（地图）之一
  return !!(webServiceKey(config) || trim(config, 'amapJsApiKey'))
}

export function getAmapConfigPublic(config = loadConfig()) {
  const style = trim(config, 'amapMapStyle') || 'amap://styles/whitesmoke'
  return {
    amapEnabled: config.amapEnabled !== false,
    amapWebApiKeyMasked: maskKey(trim(config, 'amapWebApiKey')),
    amapJsApiKeyMasked: maskKey(trim(config, 'amapJsApiKey')),
    amapAndroidKeyMasked: maskKey(trim(config, 'amapAndroidKey')),
    amapIosKeyMasked: maskKey(trim(config, 'amapIosKey')),
    amapWechatMiniKeyMasked: maskKey(trim(config, 'amapWechatMiniKey')),
    amapHarmonyKeyMasked: maskKey(trim(config, 'amapHarmonyKey')),
    hasWebApiKey: !!trim(config, 'amapWebApiKey'),
    hasJsApiKey: !!trim(config, 'amapJsApiKey'),
    hasJsSecurityCode: !!trim(config, 'amapJsSecurityCode'),
    hasAndroidKey: !!trim(config, 'amapAndroidKey'),
    hasIosKey: !!trim(config, 'amapIosKey'),
    hasWechatMiniKey: !!trim(config, 'amapWechatMiniKey'),
    hasHarmonyKey: !!trim(config, 'amapHarmonyKey'),
    amapMapStyle: style,
    configured: isAmapConfigured(config),
    enabled: isAmapEnabled(config)
  }
}

function applyKeyField(next, body, field) {
  const legacyClear = {
    amapWebApiKey: 'clearWebApiKey',
    amapJsApiKey: 'clearJsApiKey',
    amapJsSecurityCode: 'clearJsSecurityCode',
    amapAndroidKey: 'clearAndroidKey',
    amapIosKey: 'clearIosKey',
    amapWechatMiniKey: 'clearWechatMiniKey',
    amapHarmonyKey: 'clearHarmonyKey'
  }[field]

  if (body[legacyClear] === true || body[field] === '') {
    next[field] = ''
    return
  }
  if (body[field] !== undefined && String(body[field]).trim() !== '') {
    next[field] = String(body[field]).trim()
  }
}

export function saveAmapConfig(body = {}) {
  const b = body || {}
  const current = loadConfig()
  const next = { ...current }

  if (b.amapEnabled !== undefined) {
    next.amapEnabled = !!b.amapEnabled
  }
  for (const field of KEY_FIELDS) {
    applyKeyField(next, b, field)
  }
  if (b.amapMapStyle !== undefined) {
    const style = String(b.amapMapStyle || '').trim()
    next.amapMapStyle = style || 'amap://styles/whitesmoke'
  }

  const patch = {
    amapEnabled: next.amapEnabled !== false,
    amapMapStyle: String(next.amapMapStyle || '').trim() || 'amap://styles/whitesmoke'
  }
  for (const field of KEY_FIELDS) {
    patch[field] = String(next[field] || '').trim()
  }
  saveConfig(patch)
  return getAmapConfigPublic()
}

/**
 * 登录用户选点/定位配置。
 * Key 全部来自后台，客户端不写死。
 */
export function getAmapMapClientConfig(config = loadConfig()) {
  if (!isAmapEnabled(config)) {
    return {
      enabled: false,
      key: '',
      securityJsCode: '',
      androidKey: '',
      iosKey: '',
      style: 'amap://styles/whitesmoke'
    }
  }
  return {
    enabled: true,
    key: jsApiKey(config),
    securityJsCode: trim(config, 'amapJsSecurityCode'),
    androidKey: trim(config, 'amapAndroidKey'),
    iosKey: trim(config, 'amapIosKey'),
    style: trim(config, 'amapMapStyle') || 'amap://styles/whitesmoke'
  }
}

async function amapGet(url, params) {
  const config = loadConfig()
  const key = webServiceKey(config)
  if (!key) {
    const err = new Error('未配置高德 Web 服务 Key（管理后台 → 发送位置）')
    err.status = 503
    throw err
  }
  if (config.amapEnabled === false) {
    const err = new Error('位置服务已关闭')
    err.status = 503
    throw err
  }
  const q = new URLSearchParams({ key, output: 'JSON', ...params })
  const res = await fetch(`${url}?${q.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    const err = new Error(`高德接口 HTTP ${res.status}`)
    err.status = 502
    throw err
  }
  const data = await res.json()
  if (String(data.status) !== '1') {
    const err = new Error(data.info || data.infocode || '高德接口失败')
    err.status = 400
    err.amap = data
    throw err
  }
  return data
}

function normalizePoi(item = {}) {
  const loc = String(item.location || '').split(',')
  const lng = Number(loc[0])
  const lat = Number(loc[1])
  const name = String(item.name || '').trim()
  const address = String(item.address || item.pname || '').trim()
  const district = [item.pname, item.cityname, item.adname].filter(Boolean).join('')
  return {
    id: String(item.id || ''),
    title: name || '位置',
    address: address || district || name || '位置',
    district,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    type: String(item.type || ''),
    typecode: String(item.typecode || '')
  }
}

export async function aroundAmapPlaces({
  lat,
  lng,
  keyword = '',
  radius = 2000,
  page = 1,
  pageSize = 25
} = {}) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    const err = new Error('无效坐标')
    err.status = 400
    throw err
  }
  const pageNum = Math.max(1, Number(page) || 1)
  const offset = Math.min(50, Math.max(1, Number(pageSize) || 25))
  const q = String(keyword || '').trim()
  const params = {
    location: `${ln},${la}`,
    radius: String(Math.min(50000, Math.max(100, Number(radius) || 2000))),
    sortrule: 'distance',
    offset: String(offset),
    page: String(pageNum),
    extensions: 'base'
  }
  if (q) params.keywords = q
  const data = await amapGet(PLACE_AROUND_URL, params)
  const pois = Array.isArray(data.pois) ? data.pois : []
  return {
    list: pois.map(normalizePoi).filter((p) => p.lat && p.lng),
    count: Number(data.count) || pois.length
  }
}

export async function searchAmapPlaces({
  keyword = '',
  lat,
  lng,
  city = '',
  page = 1,
  pageSize = 20,
  around = true
} = {}) {
  const q = String(keyword || '').trim()
  if (!q) return { list: [], count: 0 }

  const pageNum = Math.max(1, Number(page) || 1)
  const offset = Math.min(50, Math.max(1, Number(pageSize) || 20))
  const hasLoc = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))

  let data
  if (around && hasLoc) {
    data = await amapGet(PLACE_AROUND_URL, {
      keywords: q,
      location: `${Number(lng)},${Number(lat)}`,
      radius: '50000',
      sortrule: 'weight',
      offset: String(offset),
      page: String(pageNum),
      extensions: 'base'
    })
  } else {
    data = await amapGet(PLACE_SEARCH_URL, {
      keywords: q,
      city: String(city || '').trim(),
      citylimit: city ? 'true' : 'false',
      offset: String(offset),
      page: String(pageNum),
      extensions: 'base'
    })
  }

  const pois = Array.isArray(data.pois) ? data.pois : []
  return {
    list: pois.map(normalizePoi).filter((p) => p.lat && p.lng),
    count: Number(data.count) || pois.length
  }
}

export async function regeoAmap({ lat, lng } = {}) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    const err = new Error('无效坐标')
    err.status = 400
    throw err
  }
  const data = await amapGet(REGEO_URL, {
    location: `${ln},${la}`,
    extensions: 'base',
    radius: '1000'
  })
  const regeocode = data.regeocode || {}
  const comp = regeocode.addressComponent || {}
  const formatted = String(regeocode.formatted_address || '').trim()
  const title =
    String(comp.building || '').trim() ||
    String(comp.neighborhood?.name || '').trim() ||
    String(comp.township || '').trim() ||
    String(comp.district || '').trim() ||
    '位置'
  return {
    title,
    address: formatted || title,
    lat: la,
    lng: ln,
    province: String(comp.province || ''),
    city: String(Array.isArray(comp.city) ? '' : comp.city || comp.province || ''),
    district: String(comp.district || ''),
    adcode: String(comp.adcode || '').trim()
  }
}

/**
 * 根据坐标查实时天气（先逆地理拿 adcode，再调高德天气 Web 服务）
 */
export async function weatherAmap({ lat, lng } = {}) {
  const geo = await regeoAmap({ lat, lng })
  const cityCode = String(geo.adcode || '').trim()
  if (!cityCode) {
    const err = new Error('无法解析地区编码')
    err.status = 400
    throw err
  }
  const data = await amapGet(WEATHER_URL, {
    city: cityCode,
    extensions: 'base'
  })
  const live = Array.isArray(data.lives) ? data.lives[0] : null
  if (!live || typeof live !== 'object') {
    const err = new Error('暂无天气数据')
    err.status = 404
    throw err
  }
  const temperature = String(live.temperature || '').trim()
  const weather = String(live.weather || '').trim() || '未知'
  return {
    city: String(live.city || geo.district || geo.city || '').trim(),
    province: String(live.province || geo.province || '').trim(),
    adcode: String(live.adcode || cityCode).trim(),
    weather,
    temperature,
    temperatureText: temperature ? `${temperature}°` : '',
    windDirection: String(live.winddirection || '').trim(),
    windPower: String(live.windpower || '').trim(),
    humidity: String(live.humidity || '').trim(),
    reportTime: String(live.reporttime || '').trim()
  }
}

/**
 * 路径规划距离（高德距离测量：驾车/步行导航距离，非直线）
 * @param {{ fromLat: number, fromLng: number, destinations: Array<{lat:number,lng:number}|[number,number]>, mode?: 'driving'|'walking' }} opts
 */
export async function routeDistancesAmap({
  fromLat,
  fromLng,
  destinations = [],
  mode = 'driving'
} = {}) {
  const ola = Number(fromLat)
  const oln = Number(fromLng)
  if (!Number.isFinite(ola) || !Number.isFinite(oln)) {
    const err = new Error('无效起点坐标')
    err.status = 400
    throw err
  }
  const points = (Array.isArray(destinations) ? destinations : [])
    .map((d) => {
      if (Array.isArray(d)) {
        return { lat: Number(d[0]), lng: Number(d[1]) }
      }
      return { lat: Number(d?.lat), lng: Number(d?.lng) }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 100)
  if (!points.length) return { list: [], mode: mode === 'walking' ? 'walking' : 'driving' }

  // 1=驾车导航距离，3=步行规划距离
  const type = mode === 'walking' || mode === 'walk' ? '3' : '1'
  const CHUNK = 40
  const list = []
  for (let i = 0; i < points.length; i += CHUNK) {
    const chunk = points.slice(i, i + CHUNK)
    const origins = chunk.map(() => `${oln},${ola}`).join('|')
    const destination = chunk.map((p) => `${p.lng},${p.lat}`).join('|')
    const data = await amapGet(DISTANCE_URL, {
      origins,
      destination,
      type
    })
    const results = Array.isArray(data.results) ? data.results : []
    for (let j = 0; j < chunk.length; j++) {
      const r =
        results.find((item) => Number(item?.dest_id) === j + 1) ||
        results.find((item) => Number(item?.origin_id) === j + 1) ||
        results[j] ||
        null
      const distance = Number(r?.distance)
      const duration = Number(r?.duration)
      list.push({
        lat: chunk[j].lat,
        lng: chunk[j].lng,
        distanceM: Number.isFinite(distance) ? Math.max(0, Math.round(distance)) : -1,
        durationSec: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : -1
      })
    }
  }
  return {
    list,
    mode: type === '3' ? 'walking' : 'driving'
  }
}

export function getAmapClientStatus() {
  const config = loadConfig()
  return {
    enabled: isAmapEnabled(config),
    configured: isAmapConfigured(config)
  }
}
