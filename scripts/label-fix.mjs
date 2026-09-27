/**
 * 强制补标：目录最后提交说明 ≠ 目标中文时，改写 .folder-label 并提交。
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { labelFor, TOP_LAST } from './label-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: '熊浩鑫',
  GIT_AUTHOR_EMAIL: '1960492369@qq.com',
  GIT_COMMITTER_NAME: '熊浩鑫',
  GIT_COMMITTER_EMAIL: '1960492369@qq.com'
}

function sh(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      windowsHide: true
    }).trim()
  } catch {
    return ''
  }
}
function run(cmd) {
  execSync(cmd, { stdio: 'pipe', env, windowsHide: true })
}

const files = sh('git ls-files -z').split('\0').filter(Boolean)
const dirs = new Set()
for (const f of files) {
  const parts = f.split('/')
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
}
dirs.add('scripts')

const sorted = [...dirs].sort(
  (a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b)
)
const topSet = new Set(TOP_LAST)
const order = [...sorted.filter((d) => !topSet.has(d)), ...TOP_LAST]

let n = 0
for (const dir of order) {
  const msg = labelFor(dir)
  const cur = sh(`git log -1 --format=%s -- "${dir.replace(/"/g, '\\"')}"`)
  if (cur === msg) continue

  const abs = path.join(ROOT, dir)
  fs.mkdirSync(abs, { recursive: true })
  const labelFile = path.join(abs, '.folder-label')
  const prev = fs.existsSync(labelFile) ? fs.readFileSync(labelFile, 'utf8') : ''
  const a = msg + '\n'
  const b = msg + '\n\n'
  const c = msg + '\n#\n'
  fs.writeFileSync(labelFile, prev === a ? b : prev === b ? c : a, 'utf8')

  const rel = `${dir}/.folder-label`
  run(`git add -f -- "${rel.replace(/"/g, '\\"')}"`)
  if (!sh('git diff --cached --name-only')) {
    fs.writeFileSync(labelFile, msg + '\n#' + Date.now() + '\n', 'utf8')
    run(`git add -f -- "${rel.replace(/"/g, '\\"')}"`)
  }
  if (!sh('git diff --cached --name-only')) {
    console.log('NOSTAGE', dir)
    continue
  }
  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`)
  console.log('FIXED', dir, '| was:', cur, '| now:', msg)
  n++
}

// 根
const rootMsg = labelFor('.')
if (sh('git log -1 --format=%s -- .folder-label LICENSE README.md') !== rootMsg) {
  fs.writeFileSync(path.join(ROOT, '.folder-label'), rootMsg + '\n', 'utf8')
  run('git add -f -- .folder-label')
  try {
    run(`git commit -m "${rootMsg}"`)
    n++
  } catch {
    /* ignore */
  }
}

console.log('DONE fixed=', n)
