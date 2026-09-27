import QRCode from 'qrcode'

export function publicOrigin(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
  const proto = xfProto || req.protocol || 'https'
  const xfHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim()
  const host = xfHost || req.headers.host || 'ask.xhamil.com'
  return `${proto}://${host}`.replace(/\/$/, '')
}

export function downloadGoUrl(req) {
  return `${publicOrigin(req)}/api/download-page/go`
}

/** @param {import('express').Request} req @param {import('express').Response} res @param {'png'|'svg'} [format] */
export async function sendDownloadQr(req, res, format = 'png') {
  const goUrl = downloadGoUrl(req)
  if (format === 'svg') {
    const svg = await QRCode.toString(goUrl, {
      type: 'svg',
      margin: 1,
      width: 232,
      color: { dark: '#121826', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(svg)
  }
  const png = await QRCode.toBuffer(goUrl, {
    type: 'png',
    margin: 1,
    width: 232,
    color: { dark: '#121826', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  })
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.status(200).send(png)
}
