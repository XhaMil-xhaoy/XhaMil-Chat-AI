import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)

const LABELS = [
  ['media/Sticker/builtin-official', '内置官方表情包'],
  ['media/About Page', '关于页开发者/鸣谢头像（运行时上传）'],
  ['media/App Releases', 'App 安装包上传目录（运行时）'],
  ['media/Audio', '聊天语音上传目录（运行时）'],
  ['media/Avatar Frames', '头像框资源'],
  ['media/Chat Bubbles', '聊天气泡皮肤'],
  ['media/Chat Images', '聊天图片上传目录（运行时）'],
  ['media/Chat Videos', '聊天视频上传目录（运行时）'],
  ['media/Default Avatars', '用户默认头像池'],
  ['media/Download Page', '下载页旧资源占位（运行时）'],
  ['media/Group Files', '群文件上传目录（运行时）'],
  ['media/Moments', '说说图片上传目录（运行时）'],
  ['media/Moments Videos', '说说视频上传目录（运行时）'],
  ['media/Notification sound', '客户端通知提示音'],
  ['media/Official Images', '官方默认图（登录/语音房/Logo等）'],
  ['media/Reports', '举报截图上传目录（运行时）'],
  ['media/Tts', 'TTS 语音缓存目录（运行时）'],
  ['media/avatar', '用户头像（含 default.png）'],
  ['media/vosk', '语音识别模型说明（模型文件需自备）'],
  ['media/Sticker', '表情贴纸目录'],
  ['media', '媒体资源根目录（默认素材 + 上传占位）'],
  ['json', '配置模板（复制 config.example 为 config.json）'],
  ['docs', '部署与运维文档'],
  ['deploy', '进程启动脚本（宝塔等）'],
  ['admin-art', '管理后台前端源码（Vue3）'],
  ['backend', 'Node 后端 API 与管理端静态资源']
]

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: '熊浩鑫',
  GIT_AUTHOR_EMAIL: '1960492369@qq.com',
  GIT_COMMITTER_NAME: '熊浩鑫',
  GIT_COMMITTER_EMAIL: '1960492369@qq.com'
}

function run(cmd) {
  execSync(cmd, { stdio: 'pipe', env, windowsHide: true })
}

// commit gitignore fix first
run('git add -- .gitignore')
try {
  run('git commit -m "允许 media 占位目录提交 .folder-label 中文标注"')
  console.log('OK gitignore')
} catch {
  console.log('skip gitignore commit')
}

for (const [dir, msg] of LABELS) {
  const abs = path.join(ROOT, dir)
  fs.mkdirSync(abs, { recursive: true })
  const labelPath = path.join(abs, '.folder-label')
  fs.writeFileSync(labelPath, msg + '\n', 'utf8')
  const rel = dir.replace(/\\/g, '/') + '/.folder-label'
  run(`git add -f -- "${rel}"`)
  const staged = execSync('git diff --cached --name-only', { encoding: 'utf8', env }).trim()
  if (!staged) {
    console.log('NOSTAGE', dir)
    continue
  }
  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`)
  console.log('OK', dir, '=>', msg)
}

console.log('DONE')
