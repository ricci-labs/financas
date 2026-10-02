import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readThemeValues, resolveColor } from './tokens/semantic-tokens.mjs'

const SOURCE = 'docs/design/assets/logo/twise-icone.svg'
const OUTPUT_FOLDER = 'apps/web/public/icons'
const MASKABLE_SAFE_SCALE = 0.8
const ICON_BOX = 120
const ICONS = [
  { file: 'icon-192.png', size: 192, isFullBleed: false },
  { file: 'icon-512.png', size: 512, isFullBleed: false },
  { file: 'maskable-512.png', size: 512, isFullBleed: true },
  { file: 'apple-touch-icon.png', size: 180, isFullBleed: true },
]

function fullBleed(source) {
  const drawing = source
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<rect[^>]*\/>/, '')
  const inset = (ICON_BOX * (1 - MASKABLE_SAFE_SCALE)) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_BOX} ${ICON_BOX}"><rect width="${ICON_BOX}" height="${ICON_BOX}" fill="${MINT}"/><g transform="translate(${inset} ${inset}) scale(${MASKABLE_SAFE_SCALE})">${drawing}</g></svg>`
}

async function rasterize(browser, svg, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const sized = svg.replace(/<svg([^>]*)>/, `<svg$1 width="${size}" height="${size}">`)
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${sized}</body></html>`,
  )
  const png = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  })
  await page.close()
  return png
}

const requireFromWeb = createRequire(join(process.cwd(), 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')
const MINT = resolveColor(readThemeValues().light, 'mint')
const source = readFileSync(SOURCE, 'utf8')
const plain = source.replace(/\swidth="\d+"\sheight="\d+"/, '')
mkdirSync(OUTPUT_FOLDER, { recursive: true })
const browser = await chromium.launch()
for (const icon of ICONS) {
  const svg = icon.isFullBleed ? fullBleed(plain) : plain
  writeFileSync(join(OUTPUT_FOLDER, icon.file), await rasterize(browser, svg, icon.size))
}
await browser.close()
writeFileSync(join(OUTPUT_FOLDER, 'favicon.svg'), source)
console.log(`Wrote ${ICONS.length + 1} app icons to ${OUTPUT_FOLDER} from ${SOURCE}.`)
