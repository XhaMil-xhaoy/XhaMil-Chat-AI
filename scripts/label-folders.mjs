/**
 * 为每个已跟踪目录单独提交中文标注（GitHub 右侧显示最后一次触及该目录的提交说明）
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)

const SPECIAL = {
  '.': '项目说明与开源协议',
  'admin-art': '管理后台前端源码（Vue3）',
  'admin-art/.husky': 'Git 提交钩子',
  'admin-art/public': '管理端公共静态文件',
  'admin-art/scripts': '管理端工具脚本',
  'admin-art/src': '管理端前端源码',
  'admin-art/src/api': '管理端 API 封装',
  'admin-art/src/assets': '管理端静态素材',
  'admin-art/src/assets/images': '管理端图片素材',
  'admin-art/src/assets/styles': '全局样式',
  'admin-art/src/assets/svg': 'SVG 资源',
  'admin-art/src/components': '通用组件',
  'admin-art/src/components/business': '业务组件',
  'admin-art/src/components/core': '核心 UI 组件',
  'admin-art/src/components/xhamil': 'XhaMil 业务组件',
  'admin-art/src/config': '前端配置',
  'admin-art/src/data': '预设数据',
  'admin-art/src/directives': 'Vue 指令',
  'admin-art/src/enums': '枚举定义',
  'admin-art/src/hooks': '组合式函数',
  'admin-art/src/locales': '国际化',
  'admin-art/src/locales/langs': '中英文语言包',
  'admin-art/src/mock': '本地 Mock 数据',
  'admin-art/src/plugins': '插件注册',
  'admin-art/src/router': '路由',
  'admin-art/src/store': '状态管理',
  'admin-art/src/types': 'TypeScript 类型',
  'admin-art/src/utils': '工具函数',
  'admin-art/src/views': '页面视图',
  'admin-art/src/views/auth': '登录注册页',
  'admin-art/src/views/dashboard': '仪表盘示例页',
  'admin-art/src/views/system': '系统管理示例页',
  'admin-art/src/views/xhamil': 'XhaMil 业务管理页',
  'admin-art/src/views/xhamil/analysis': '数据分析',
  'admin-art/src/views/xhamil/app-docs': 'App 说明文档配置',
  'admin-art/src/views/xhamil/app-update': 'App 发版更新',
  'admin-art/src/views/xhamil/avatars': '头像管理',
  'admin-art/src/views/xhamil/banned-words': '违禁词',
  'admin-art/src/views/xhamil/changelog': '更新日志',
  'admin-art/src/views/xhamil/chat-photos': '聊天图片管理',
  'admin-art/src/views/xhamil/chat-videos': '聊天视频管理',
  'admin-art/src/views/xhamil/chat-voice': '聊天语音管理',
  'admin-art/src/views/xhamil/database': '数据库管理',
  'admin-art/src/views/xhamil/database-browse': '数据库浏览',
  'admin-art/src/views/xhamil/download-page': '官方下载页配置',
  'admin-art/src/views/xhamil/error-codes': '错误码',
  'admin-art/src/views/xhamil/functional-dev': '功能开发开关',
  'admin-art/src/views/xhamil/group-ai': '群聊 AI',
  'admin-art/src/views/xhamil/group-announcement-images': '群公告图片',
  'admin-art/src/views/xhamil/group-files': '群文件管理',
  'admin-art/src/views/xhamil/groups': '群组管理',
  'admin-art/src/views/xhamil/icons': '图标资源管理',
  'admin-art/src/views/xhamil/media': '媒体浏览器',
  'admin-art/src/views/xhamil/moments': '说说管理',
  'admin-art/src/views/xhamil/moments-photos': '说说图片',
  'admin-art/src/views/xhamil/moments-videos': '说说视频',
  'admin-art/src/views/xhamil/public-voice-rooms': '公开语音房',
  'admin-art/src/views/xhamil/reports': '举报处理',
  'admin-art/src/views/xhamil/users': '用户管理',
  'admin-art/src/views/xhamil/verification': '实名/验证配置',
  'admin-art/src/views/xhamil/workbench': '工作台',
  backend: 'Node 后端 API 与管理端静态资源',
  'backend/data': '运行时数据目录（敏感文件已忽略）',
  'backend/pack': '打包相关',
  'backend/pack/tools': 'App 打包工具',
  'backend/public': '对外静态资源',
  'backend/public/admin': '管理后台构建产物',
  'backend/public/admin/assets': '管理后台静态资源文件',
  'backend/public/desktop-map': '桌面端地图页',
  'backend/public/desktop-map/leaflet': 'Leaflet 地图库',
  'backend/public/download': '官方下载页',
  'backend/public/download/promo': '下载页宣传图',
  'backend/public/download/vendor': '下载页第三方脚本',
  'backend/public/pack': '免费打包页',
  'backend/public/pack/img': '打包页图片',
  'backend/public/password-reset': '密码重置页',
  'backend/scripts': '运维与清理脚本',
  'backend/src': '后端业务源码',
  'backend/src/data': '后端内置数据',
  'backend/src/routes': 'HTTP 路由',
  deploy: '进程启动脚本（宝塔等）',
  docs: '部署与运维文档',
  json: '配置模板（复制 config.example 为 config.json）',
  media: '媒体资源根目录（默认素材 + 上传占位）',
  'media/About Page': '关于页开发者/鸣谢头像（运行时上传）',
  'media/App Releases': 'App 安装包上传目录（运行时）',
  'media/Audio': '聊天语音上传目录（运行时）',
  'media/Avatar Frames': '头像框资源',
  'media/Chat Bubbles': '聊天气泡皮肤',
  'media/Chat Images': '聊天图片上传目录（运行时）',
  'media/Chat Videos': '聊天视频上传目录（运行时）',
  'media/Default Avatars': '用户默认头像池',
  'media/Download Page': '下载页旧资源占位（运行时）',
  'media/Group Files': '群文件上传目录（运行时）',
  'media/Moments': '说说图片上传目录（运行时）',
  'media/Moments Videos': '说说视频上传目录（运行时）',
  'media/Notification sound': '客户端通知提示音',
  'media/Official Images': '官方默认图（登录/语音房/Logo等）',
  'media/Reports': '举报截图上传目录（运行时）',
  'media/Sticker': '表情贴纸目录',
  'media/Sticker/builtin-official': '内置官方表情包',
  'media/Tts': 'TTS 语音缓存目录（运行时）',
  'media/avatar': '用户头像（含 default.png）',
  'media/vosk': '语音识别模型说明（模型文件需自备）'
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function shAllow(cmd) {
  try {
    return sh(cmd)
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '')
  }
}

const files = sh('git ls-files -z').split('\0').filter(Boolean)
const dirs = new Set()
for (const f of files) {
  const parts = f.split('/')
  for (let i = 1; i < parts.length; i++) {
    dirs.add(parts.slice(0, i).join('/'))
  }
}

function labelFor(dir) {
  if (SPECIAL[dir]) return SPECIAL[dir]
  const base = dir.split('/').pop()
  if (dir.startsWith('admin-art/src/assets/images/')) return `管理端图片：${base}`
  if (dir.startsWith('admin-art/src/components/')) return `组件：${base}`
  if (dir.startsWith('admin-art/src/views/')) return `页面：${base}`
  if (dir.startsWith('admin-art/src/')) return `源码：${base}`
  if (dir.startsWith('admin-art/')) return `管理端：${base}`
  if (dir.startsWith('backend/public/')) return `静态资源：${base}`
  if (dir.startsWith('backend/src/')) return `后端源码：${base}`
  if (dir.startsWith('backend/')) return `后端：${base}`
  if (dir.startsWith('media/')) return `媒体目录：${base}`
  return `目录：${base}`
}

/** 深度优先：先标深层，最后标顶层，使父目录可再单独标一次 */
const sorted = [...dirs].sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b))

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: '熊浩鑫',
  GIT_AUTHOR_EMAIL: '1960492369@qq.com',
  GIT_COMMITTER_NAME: '熊浩鑫',
  GIT_COMMITTER_EMAIL: '1960492369@qq.com'
}

function commitDir(dir, msg) {
  const abs = path.join(ROOT, dir)
  fs.mkdirSync(abs, { recursive: true })
  const labelFile = path.join(abs, '.folder-label')
  fs.writeFileSync(labelFile, msg + '\n', 'utf8')
  const rel = dir.replace(/\\/g, '/') + '/.folder-label'
  execSync(`git add -f -- "${rel.replace(/"/g, '\\"')}"`, { stdio: 'pipe', env })
  const staged = sh('git diff --cached --name-only')
  if (!staged) {
    console.log('NOSTAGE', dir)
    return false
  }
  execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: 'pipe', env })
  console.log('OK', dir, '=>', msg)
  return true
}

// 先恢复被写空的 .gitkeep
for (const f of files) {
  if (!f.endsWith('/.gitkeep') && !f.endsWith('.gitkeep')) continue
  const abs = path.join(ROOT, f)
  if (!fs.existsSync(abs)) continue
  const cur = fs.readFileSync(abs, 'utf8')
  if (cur.trim() !== '') {
    // 若被写成了中文说明，改回空占位，说明放到 .folder-label
    fs.writeFileSync(abs, '', 'utf8')
  }
}

let n = 0
for (const dir of sorted) {
  if (commitDir(dir, labelFor(dir))) n++
}

// 顶层目录再标一次（保证仓库首页显示正确）
const tops = [
  ['media', SPECIAL.media],
  ['json', SPECIAL.json],
  ['docs', SPECIAL.docs],
  ['deploy', SPECIAL.deploy],
  ['admin-art', SPECIAL['admin-art']],
  ['backend', SPECIAL.backend]
]
for (const [dir, msg] of tops) {
  if (commitDir(dir, msg)) n++
}

// 根
fs.writeFileSync(path.join(ROOT, '.folder-label'), SPECIAL['.'] + '\n', 'utf8')
execSync('git add -- .folder-label', { stdio: 'pipe', env })
if (sh('git diff --cached --name-only')) {
  execSync(`git commit -m "${SPECIAL['.']}"`, { stdio: 'pipe', env })
  n++
  console.log('OK . =>', SPECIAL['.'])
}

console.log('DONE commits=', n)
