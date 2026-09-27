import { execSync } from 'child_process'
import { labelFor } from './label-lib.mjs'

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const files = sh('git ls-files -z').split('\0').filter(Boolean)
const dirs = new Set()
for (const f of files) {
  const p = f.split('/')
  for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/'))
}

let bad = 0
for (const d of [...dirs].sort()) {
  const want = labelFor(d)
  const got = sh(`git log -1 --format=%s -- "${d.replace(/"/g, '\\"')}"`)
  if (got !== want) {
    bad++
    if (bad <= 20) console.log('MISMATCH', d, '|', got, '| want', want)
  }
}
console.log('bad_total=' + bad + ' / ' + dirs.size)
