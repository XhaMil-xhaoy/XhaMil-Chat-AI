import sharp from 'sharp'

function clampLat(lat) {
  return Math.min(85.0511, Math.max(-85.0511, lat))
}

async function fetchTile(x, y, z) {
  const host = 1 + ((x + y) % 4)
  const url =
    `https://webrd0${host}.is.autonavi.com/appmaptile` +
    `?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; XhaMilMapPreview/1.0)',
      Referer: 'https://www.amap.com/'
    }
  })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 80) return null
  return buf
}

/** 与 Android AmapStaticPreview 一致：多瓦片拼接 JPEG */
export async function renderAmapPreview(lat, lng, width, height, zoom = 16) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('坐标无效')
  }
  const outW = Math.max(120, Math.min(900, Math.round(width)))
  const outH = Math.max(80, Math.min(600, Math.round(height)))
  const z = Math.max(12, Math.min(17, Math.round(zoom)))

  const n = 2 ** z
  const world = n * 256
  const centerX = ((lng + 180) / 360) * world
  const latRad = (clampLat(lat) * Math.PI) / 180
  const centerY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * world

  const left = centerX - outW / 2
  const top = centerY - outH / 2
  const startTx = Math.floor(left / 256)
  const startTy = Math.floor(top / 256)
  const endTx = Math.floor((left + outW) / 256)
  const endTy = Math.floor((top + outH) / 256)

  const composites = []
  for (let tx = startTx; tx <= endTx; tx += 1) {
    for (let ty = startTy; ty <= endTy; ty += 1) {
      const wrappedX = ((tx % n) + n) % n
      const clampedY = Math.max(0, Math.min(n - 1, ty))
      const tile = await fetchTile(wrappedX, clampedY, z)
      if (!tile) continue

      const dx = Math.round(tx * 256 - left)
      const dy = Math.round(ty * 256 - top)
      const clipLeft = Math.max(0, -dx)
      const clipTop = Math.max(0, -dy)
      const visibleW = Math.min(256 - clipLeft, outW - Math.max(0, dx))
      const visibleH = Math.min(256 - clipTop, outH - Math.max(0, dy))
      if (visibleW <= 0 || visibleH <= 0) continue

      let input = tile
      if (clipLeft || clipTop || visibleW < 256 || visibleH < 256) {
        input = await sharp(tile)
          .extract({ left: clipLeft, top: clipTop, width: visibleW, height: visibleH })
          .toBuffer()
      }
      composites.push({
        input,
        left: Math.max(0, dx),
        top: Math.max(0, dy)
      })
    }
  }

  if (!composites.length) {
    throw new Error('瓦片加载失败')
  }

  return sharp({
    create: {
      width: outW,
      height: outH,
      channels: 3,
      background: { r: 232, g: 234, b: 235 }
    }
  })
    .composite(composites)
    .modulate({ saturation: 0.88, brightness: 1.02 })
    .jpeg({ quality: 86 })
    .toBuffer()
}
