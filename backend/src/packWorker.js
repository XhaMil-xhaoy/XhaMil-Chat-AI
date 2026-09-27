import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PACK_DIR, PACK_JOBS_DIR, PACK_BASE_DIR, PACK_TOOLS_DIR, ROOT_DIR } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = PACK_DIR
const JOBS = PACK_JOBS_DIR
const BASE_APK = path.join(PACK_BASE_DIR, 'app.apk')
const FALLBACK_TOOLS = path.resolve(ROOT_DIR, '..', 'XhaMilPack', 'tools')

function resolvePackTool(filename) {
  const local = path.join(PACK_TOOLS_DIR, filename)
  if (fs.existsSync(local)) return local
  const fallback = path.join(FALLBACK_TOOLS, filename)
  if (fs.existsSync(fallback)) return fallback
  return local
}

const APKTOOL = resolvePackTool('apktool.jar')
const SIGNER = resolvePackTool('uber-apk-signer.jar')
const KEYSTORE = resolvePackTool('xhamil-release.jks')
const KEY_PASS = process.env.PACK_KEYSTORE_PASS || 'XhaMilShare2026'
const KEY_ALIAS = process.env.PACK_KEY_ALIAS || 'xhamil'

const queue = []
let running = false

function readMeta(jobDir) {
  const p = path.join(jobDir, 'meta.json')
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeMeta(jobDir, patch) {
  const p = path.join(jobDir, 'meta.json')
  const cur = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() }
  fs.writeFileSync(p, JSON.stringify(next, null, 2))
  return next
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.on('data', (d) => {
      out += d
      opts.onChunk?.(String(d))
    })
    child.stderr.on('data', (d) => {
      out += d
      opts.onChunk?.(String(d))
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} exited ${code}\n${out.slice(-4000)}`))
    })
  })
}

function javaBin() {
  return process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', 'java')
    : 'java'
}

function findIconFile(jobDir, meta) {
  const name = meta.icon || ''
  const candidates = [
    name ? path.join(jobDir, name) : '',
    path.join(jobDir, 'icon.png'),
    path.join(jobDir, 'icon.jpg'),
    path.join(jobDir, 'icon.jpeg'),
    path.join(jobDir, 'icon.webp')
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p)) || null
}

function isPngBuffer(buf) {
  return (
    Buffer.isBuffer(buf) &&
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
}

const IMG2PNG_JAVA = resolvePackTool('Img2Png.java')
const IMG2PNG_CLASS = resolvePackTool('Img2Png.class')

async function ensureImg2PngCompiled() {
  if (!fs.existsSync(IMG2PNG_JAVA)) throw new Error('缺少 tools/Img2Png.java')
  const javaM = fs.statSync(IMG2PNG_JAVA).mtimeMs
  const classM = fs.existsSync(IMG2PNG_CLASS) ? fs.statSync(IMG2PNG_CLASS).mtimeMs : 0
  if (classM >= javaM) return
  await run('javac', [IMG2PNG_JAVA], { cwd: path.dirname(IMG2PNG_JAVA) })
  if (!fs.existsSync(IMG2PNG_CLASS)) throw new Error('编译 Img2Png 失败')
}

/**
 * 把上传图转成真正的 PNG（JPEG/GIF 等也会转）。
 * mode=square：强制正方形；mode=max：最长边不超过 size，保持比例。
 */
async function convertImageToPng(srcPath, outPng, size = 512, mode = 'square') {
  await ensureImg2PngCompiled()
  try {
    const args = ['-cp', path.dirname(IMG2PNG_JAVA), 'Img2Png', srcPath, outPng, String(size), mode]
    await run(javaBin(), args)
  } catch (err) {
    throw new Error(
      '图片无法转换，请上传 PNG 或 JPG（不要用 WebP/HEIC）。' +
        String(err.message || err).slice(0, 200)
    )
  }
  const buf = fs.readFileSync(outPng)
  if (!isPngBuffer(buf)) throw new Error('图片转换后仍不是有效 PNG')
  return outPng
}

async function convertIconToPng(iconPath, outPng, size = 512) {
  return convertImageToPng(iconPath, outPng, size, 'square')
}

function findJobImage(jobDir, metaKey, basename) {
  const name = metaKey ? String(metaKey) : ''
  const candidates = [
    name ? path.join(jobDir, name) : '',
    path.join(jobDir, `${basename}.png`),
    path.join(jobDir, `${basename}.jpg`),
    path.join(jobDir, `${basename}.jpeg`),
    path.join(jobDir, `${basename}.webp`)
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p)) || null
}

function collectDrawableFiles(decodedDir, baseName) {
  const targets = []
  const re = new RegExp(`^${baseName}\\.(png|jpg|jpeg|webp)$`, 'i')
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const st = fs.statSync(full)
      if (st.isDirectory()) walk(full)
      else if (re.test(name)) targets.push(full)
    }
  }
  walk(path.join(decodedDir, 'res'))
  return targets
}

/** 用 PNG 覆盖同名 drawable（jpg/webp 会删掉并写成 .png，@drawable/name 不受扩展名影响） */
async function replaceDrawableImage(decodedDir, baseName, srcPath, maxSide = 1600) {
  if (!srcPath || !fs.existsSync(srcPath)) return 0
  const pngPath = path.join(path.dirname(srcPath), `${baseName}_converted.png`)
  await convertImageToPng(srcPath, pngPath, maxSide, 'max')
  const buf = fs.readFileSync(pngPath)
  const targets = collectDrawableFiles(decodedDir, baseName)
  if (!targets.length) {
    // 底包若缺文件，写入 nodpi，保证资源存在
    const nodpi = path.join(decodedDir, 'res', 'drawable-nodpi')
    fs.mkdirSync(nodpi, { recursive: true })
    fs.writeFileSync(path.join(nodpi, `${baseName}.png`), buf)
    return 1
  }
  const dirs = new Set(targets.map((t) => path.dirname(t)))
  for (const t of targets) {
    if (!/\.png$/i.test(t)) fs.unlinkSync(t)
  }
  for (const dir of dirs) {
    fs.writeFileSync(path.join(dir, `${baseName}.png`), buf)
  }
  return dirs.size
}

async function replaceIcons(decodedDir, iconPath) {
  if (!iconPath || !fs.existsSync(iconPath)) return
  const pngPath = path.join(path.dirname(iconPath), 'icon_converted.png')
  await convertIconToPng(iconPath, pngPath, 512)
  const buf = fs.readFileSync(pngPath)
  const targets = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const st = fs.statSync(full)
      if (st.isDirectory()) walk(full)
      else if (
        /ic_launcher(_round)?\.png$/i.test(name) ||
        /ic_launcher_foreground\.png$/i.test(name) ||
        /splash_icon\.png$/i.test(name)
      ) {
        targets.push(full)
      }
    }
  }
  walk(path.join(decodedDir, 'res'))
  for (const t of targets) fs.writeFileSync(t, buf)
}

async function replaceExtraArts(decodedDir, jobDir, meta) {
  const arts = [
    { key: 'loginArt', base: 'login_hero', label: '登录页插图' },
    { key: 'splashArt', base: 'launch_splash_full', label: '启动页插图' },
    { key: 'aboutArt', base: 'about_branding_footer', label: '关于页插图' }
  ]
  let n = 0
  for (const art of arts) {
    const src = findJobImage(jobDir, meta[art.key], art.key)
    if (!src) continue
    n += await replaceDrawableImage(decodedDir, art.base, src, 1600)
  }
  return n
}

function patchStringsXml(decodedDir, officialName) {
  const valuesDir = path.join(decodedDir, 'res', 'values')
  if (!fs.existsSync(valuesDir)) return
  const name = escapeXml(officialName)
  for (const fileName of fs.readdirSync(valuesDir)) {
    if (!fileName.startsWith('strings') || !fileName.endsWith('.xml')) continue
    const fp = path.join(valuesDir, fileName)
    let xml = fs.readFileSync(fp, 'utf8')
    let next = xml.replace(
      /(<string\s+name="app_name">)([\s\S]*?)(<\/string>)/,
      `$1${name}$3`
    )
    next = next.replace(
      /(<string\s+name="register_footer_brand">)([\s\S]*?)(<\/string>)/,
      `$1${name} · Better Together$3`
    )
    // 关于页版权等写死文案里的品牌名
    next = next.replace(/© XhaMil/g, `© ${name}`)
    if (next !== xml) fs.writeFileSync(fp, next)
  }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function patchApktoolYml(decodedDir, versionName, versionCode, packageName) {
  const yml = path.join(decodedDir, 'apktool.yml')
  if (!fs.existsSync(yml)) return
  let text = fs.readFileSync(yml, 'utf8')
  if (/versionInfo:/.test(text)) {
    text = text.replace(/versionCode:\s*.*/g, `versionCode: ${versionCode}`)
    text = text.replace(/versionName:\s*.*/g, `versionName: ${JSON.stringify(String(versionName))}`)
  } else {
    text += `\nversionInfo:\n  versionCode: ${versionCode}\n  versionName: ${JSON.stringify(String(versionName))}\n`
  }
  if (packageName) {
    if (/renameManifestPackage\s*:/.test(text)) {
      text = text.replace(/renameManifestPackage\s*:.*/g, `renameManifestPackage: ${packageName}`)
    } else {
      text += `\nrenameManifestPackage: ${packageName}\n`
    }
  }
  fs.writeFileSync(yml, text)
}

const BASE_PACKAGE = 'com.xhamil.app'

/** 替换 Manifest / 权限 / FileProvider 等处的 applicationId */
function patchPackageName(decodedDir, packageName) {
  if (!packageName || packageName === BASE_PACKAGE) return
  const manifest = path.join(decodedDir, 'AndroidManifest.xml')
  if (fs.existsSync(manifest)) {
    let xml = fs.readFileSync(manifest, 'utf8')
    const next = xml.split(BASE_PACKAGE).join(packageName)
    if (next !== xml) fs.writeFileSync(manifest, next)
  }
  // 少数 xml 资源里也可能写死了包名
  const walkXml = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      const st = fs.statSync(full)
      if (st.isDirectory()) walkXml(full)
      else if (name.endsWith('.xml')) {
        let txt = fs.readFileSync(full, 'utf8')
        if (!txt.includes(BASE_PACKAGE)) continue
        fs.writeFileSync(full, txt.split(BASE_PACKAGE).join(packageName))
      }
    }
  }
  walkXml(path.join(decodedDir, 'res'))
}

function writeOemAsset(decodedDir, meta) {
  const assets = path.join(decodedDir, 'assets')
  fs.mkdirSync(assets, { recursive: true })
  const oem = {
    officialName: meta.officialName || meta.appName || '',
    appName: meta.officialName || meta.appName || '',
    packageName: meta.packageName || '',
    serverUrl: meta.serverUrl || '',
    versionName: meta.versionName || '',
    versionCode: meta.versionCode || 0
  }
  fs.writeFileSync(path.join(assets, 'xhamil_oem.json'), JSON.stringify(oem, null, 2))
}

/** 仅补真正缺失的 Material state 属性，避免与已有 attrs 冲突 */
function patchMissingMaterialAttrs(decodedDir) {
  const valuesDir = path.join(decodedDir, 'res', 'values')
  if (!fs.existsSync(valuesDir)) return
  const existing = new Set()
  for (const name of fs.readdirSync(valuesDir)) {
    if (!name.endsWith('.xml')) continue
    const txt = fs.readFileSync(path.join(valuesDir, name), 'utf8')
    const re = /<attr\s+name="([^"]+)"/g
    let m
    while ((m = re.exec(txt))) existing.add(m[1])
  }
  const needed = ['state_liftable', 'state_lifted', 'state_dragged'].filter((n) => !existing.has(n))
  const fp = path.join(valuesDir, 'pack_fix_attrs.xml')
  if (!needed.length) {
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
    return
  }
  const lines = needed.map((n) => `    <attr name="${n}" format="boolean" />`).join('\n')
  fs.writeFileSync(
    fp,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${lines}\n</resources>\n`
  )
}

const ANIMATOR_STUB =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<set xmlns:android="http://schemas.android.com/apk/res/android" />\n'

/** 用空 stub 覆盖易炸的 Material animator，保留文件名以免 public.xml 报缺符号 */
function neutralizeFragileAnimators(decodedDir) {
  const animDir = path.join(decodedDir, 'res', 'animator')
  if (!fs.existsSync(animDir)) return 0
  let changed = 0
  for (const name of fs.readdirSync(animDir)) {
    if (!name.endsWith('.xml')) continue
    const lower = name.toLowerCase()
    const fp = path.join(animDir, name)
    const xml = fs.readFileSync(fp, 'utf8')
    const risky =
      lower.includes('appbar') ||
      lower.includes('m3_') ||
      lower.includes('design_') ||
      lower.includes('state_list') ||
      /state_liftable|state_lifted|state_dragged/.test(xml)
    if (!risky) continue
    fs.writeFileSync(fp, ANIMATOR_STUB)
    changed++
  }
  return changed
}

/** 按 aapt2 报错继续中和引用文件；若 public.xml 缺符号则补回 stub */
function repairResourcesAfterBuildError(decodedDir, buildError) {
  let changed = 0
  const pathRe = /W: ([^\s:]+):\d+: error:/g
  let m
  while ((m = pathRe.exec(buildError || ''))) {
    const fp = m[1]
    if (fp.includes('/res/animator/') && fp.endsWith('.xml') && fs.existsSync(fp)) {
      fs.writeFileSync(fp, ANIMATOR_STUB)
      changed++
    }
  }
  // public.xml: no definition for declared symbol '...:animator/foo'
  const missingRe = /no definition for declared symbol '[^']+:animator\/([^']+)'/g
  const animDir = path.join(decodedDir, 'res', 'animator')
  fs.mkdirSync(animDir, { recursive: true })
  while ((m = missingRe.exec(buildError || ''))) {
    const name = m[1].replace(/\.xml$/i, '') + '.xml'
    const fp = path.join(animDir, name)
    fs.writeFileSync(fp, ANIMATOR_STUB)
    changed++
  }
  // also strip app:state_* from any remaining animator xml
  if (fs.existsSync(animDir)) {
    for (const name of fs.readdirSync(animDir)) {
      if (!name.endsWith('.xml')) continue
      const fp = path.join(animDir, name)
      let xml = fs.readFileSync(fp, 'utf8')
      const next = xml
        .replace(/\s+app:state_liftable="[^"]*"/g, '')
        .replace(/\s+app:state_lifted="[^"]*"/g, '')
        .replace(/\s+app:state_dragged="[^"]*"/g, '')
        .replace(/\s+.*?state_liftable="[^"]*"/g, '')
        .replace(/\s+.*?state_lifted="[^"]*"/g, '')
        .replace(/\s+.*?state_dragged="[^"]*"/g, '')
      if (next !== xml) {
        fs.writeFileSync(fp, next)
        changed++
      }
    }
  }
  return changed
}

function safeFileName(name) {
  return String(name || 'App')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'App'
}

async function processJob(jobId) {
  const jobDir = path.join(JOBS, jobId)
  const meta = readMeta(jobDir)
  const logPath = path.join(jobDir, 'build.log')
  const appendLog = (s) => fs.appendFileSync(logPath, s)

  const fail = (message) => {
    writeMeta(jobDir, {
      status: 'error',
      progress: meta.progress || 0,
      stage: 'error',
      message,
      error: message
    })
  }

  try {
    if (!fs.existsSync(BASE_APK)) throw new Error('服务器缺少底包 base/app.apk')
    if (!fs.existsSync(APKTOOL)) throw new Error('服务器缺少 tools/apktool.jar')
    if (!fs.existsSync(SIGNER)) throw new Error('服务器缺少 tools/uber-apk-signer.jar')
    if (!fs.existsSync(KEYSTORE)) throw new Error('服务器缺少签名证书 tools/xhamil-release.jks')

    writeMeta(jobDir, {
      status: 'running',
      progress: 5,
      stage: 'prepare',
      message: '准备打包环境…'
    })

    const work = path.join(jobDir, 'work')
    const decoded = path.join(work, 'decoded')
    fs.rmSync(work, { recursive: true, force: true })
    fs.mkdirSync(work, { recursive: true })

    writeMeta(jobDir, {
      progress: 15,
      stage: 'decode',
      message: '正在解包底包…'
    })
    await run(javaBin(), ['-jar', APKTOOL, 'd', '-f', '-s', BASE_APK, '-o', decoded], {
      onChunk: appendLog
    })

    writeMeta(jobDir, {
      progress: 40,
      stage: 'brand',
      message: '正在写入官方名称、包名、版本与图标…'
    })
    const officialName = meta.officialName || meta.appName || 'App'
    const packageName = meta.packageName || BASE_PACKAGE
    patchStringsXml(decoded, officialName)
    patchApktoolYml(decoded, meta.versionName, meta.versionCode, packageName)
    patchPackageName(decoded, packageName)
    await replaceIcons(decoded, findIconFile(jobDir, meta))
    const artCount = await replaceExtraArts(decoded, jobDir, meta)
    appendLog(`replaced ${artCount} custom illustration drawable dir(s)\n`)
    writeOemAsset(decoded, meta)
    patchMissingMaterialAttrs(decoded)
    const neutralized = neutralizeFragileAnimators(decoded)
    appendLog(`neutralized ${neutralized} fragile animator xml(s) before build\n`)

    writeMeta(jobDir, {
      progress: 55,
      stage: 'build',
      message: '正在重新打包 APK…'
    })
    const unsigned = path.join(work, 'unsigned.apk')
    try {
      await run(javaBin(), ['-jar', APKTOOL, 'b', decoded, '-o', unsigned], {
        onChunk: appendLog
      })
    } catch (buildErr) {
      const msg = String(buildErr.message || buildErr)
      appendLog(`\nbuild failed, retry after resource repair:\n${msg}\n`)
      const n = repairResourcesAfterBuildError(decoded, msg)
      appendLog(`repaired ${n} resource xml(s)\n`)
      writeMeta(jobDir, {
        progress: 60,
        stage: 'build',
        message: '资源兼容修复后重试打包…'
      })
      if (fs.existsSync(unsigned)) fs.unlinkSync(unsigned)
      await run(javaBin(), ['-jar', APKTOOL, 'b', '-f', decoded, '-o', unsigned], {
        onChunk: appendLog
      })
    }

    writeMeta(jobDir, {
      progress: 80,
      stage: 'sign',
      message: '正在签名…'
    })
    const signedDir = path.join(work, 'signed')
    fs.mkdirSync(signedDir, { recursive: true })
    await run(
      javaBin(),
      [
        '-jar',
        SIGNER,
        '--apks',
        unsigned,
        '--out',
        signedDir,
        '--ks',
        KEYSTORE,
        '--ksAlias',
        KEY_ALIAS,
        '--ksPass',
        KEY_PASS,
        '--ksKeyPass',
        KEY_PASS,
        '--allowResign'
      ],
      { onChunk: appendLog }
    )

    const signedApk =
      fs.readdirSync(signedDir).find((n) => n.endsWith('.apk') && !n.includes('.idsig')) ||
      null
    if (!signedApk) throw new Error('签名完成但未找到 APK')

    const outName = `${safeFileName(officialName)}-${safeFileName(meta.versionName)}-${meta.versionCode}.apk`
    const outPath = path.join(jobDir, outName)
    fs.copyFileSync(path.join(signedDir, signedApk), outPath)

    // free disk: drop decoded workspace
    fs.rmSync(work, { recursive: true, force: true })

    writeMeta(jobDir, {
      status: 'done',
      progress: 100,
      stage: 'done',
      message: '打包完成，开始下载…',
      apkFile: outName,
      downloadUrl: `/api/jobs/${jobId}/download`
    })
  } catch (err) {
    appendLog(`\nERROR: ${err.stack || err.message}\n`)
    fail(err.message || '打包失败')
  }
}

export function enqueuePackJob(jobId) {
  queue.push(jobId)
  writeMeta(path.join(JOBS, jobId), {
    status: 'queued',
    progress: 1,
    stage: 'queued',
    message: '已进入打包队列…'
  })
  pump()
}

async function pump() {
  if (running) return
  const jobId = queue.shift()
  if (!jobId) return
  running = true
  try {
    await processJob(jobId)
  } finally {
    running = false
    if (queue.length) setImmediate(pump)
  }
}

export function getJobMeta(jobId) {
  const jobDir = path.join(JOBS, jobId)
  const metaPath = path.join(jobDir, 'meta.json')
  if (!fs.existsSync(metaPath)) return null
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
}

export function getJobApkPath(jobId) {
  const meta = getJobMeta(jobId)
  if (!meta?.apkFile) return null
  const p = path.join(JOBS, jobId, meta.apkFile)
  return fs.existsSync(p) ? p : null
}
