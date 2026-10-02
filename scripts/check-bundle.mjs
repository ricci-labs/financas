import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST_FOLDER = 'apps/web/dist'
const MANIFEST_FILE = join(DIST_FOLDER, '.vite/manifest.json')
const ENTRY = 'index.html'
const BUDGET_KB = 250
const BYTES_PER_KB = 1024

function staticFiles(manifest, key, seen = new Set()) {
  if (seen.has(key)) {
    return seen
  }
  seen.add(key)
  for (const imported of manifest[key]?.imports ?? []) {
    staticFiles(manifest, imported, seen)
  }
  return seen
}

function gzippedKb(file) {
  return gzipSync(readFileSync(join(DIST_FOLDER, file))).length / BYTES_PER_KB
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'))
} catch {
  console.error(`${MANIFEST_FILE} is missing. Run pnpm --filter @financas/web build first.`)
  process.exit(1)
}

const files = [...staticFiles(manifest, ENTRY)].map((key) => manifest[key].file)
const sizes = files.map((file) => ({ file, kb: gzippedKb(file) }))
const totalKb = sizes.reduce((sum, { kb }) => sum + kb, 0)
for (const { file, kb } of sizes.sort((a, b) => b.kb - a.kb)) {
  console.log(`  ${kb.toFixed(1).padStart(7)} KB  ${file}`)
}
if (totalKb > BUDGET_KB) {
  console.error(
    `Initial JavaScript is ${totalKb.toFixed(1)} KB gzipped, over the ${BUDGET_KB} KB budget (RNF-PERF-1).`,
  )
  process.exit(1)
}
console.log(
  `Initial JavaScript is ${totalKb.toFixed(1)} KB gzipped, within the ${BUDGET_KB} KB budget.`,
)
