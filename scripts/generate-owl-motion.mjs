import { readFileSync, writeFileSync } from 'node:fs'

const DEMO_FOLDER = 'docs/design/account/animations'
const OUTPUT_FILE = 'apps/web/src/styles/owl-motion.gen.css'
const CHECK_FLAG = '--check'
const PIECE_SELECTOR = /^#[ko]-[\w-]+$/
const ALL_PIECES_SELECTOR = '.k g'
const MOMENT = "[data-slot='moment-screen']"
const PERCENT = 100
const DECIMALS = 3

const KITS = [
  {
    name: 'confirm',
    demo: 'Animacao-confirmar.html',
    seconds: 7,
    startsAt: 35,
    settlesAt: 92,
    isPhased: true,
  },
  {
    name: 'confirm-expired',
    demo: 'Animacao-confirmar-vencido.html',
    seconds: 6.5,
    startsAt: 36.92,
    settlesAt: 89.23,
    isPhased: true,
  },
  {
    name: 'invitation',
    demo: 'Animacao-convite.html',
    seconds: 6.5,
    startsAt: 30.77,
    settlesAt: 89.23,
    isPhased: true,
  },
  {
    name: 'sign-up-sent',
    demo: 'Animacao-cadastro-enviado.html',
    seconds: 6.5,
    startsAt: 0,
    settlesAt: 89.23,
  },
  {
    name: 'forgot-sent',
    demo: 'Animacao-esqueci-enviado.html',
    seconds: 6.5,
    startsAt: 0,
    settlesAt: 89.23,
  },
  {
    name: 'reset-expired',
    demo: 'Animacao-senha-vencido.html',
    seconds: 6.5,
    startsAt: 0,
    settlesAt: 89.23,
  },
  {
    name: 'closed',
    demo: 'Animacao-cadastro-fechado.html',
    seconds: 6.5,
    startsAt: 0,
    settlesAt: 89.23,
  },
  {
    name: 'brand',
    demo: 'Animacao-abertura.html',
    seconds: 4.6,
    startsAt: 0,
    settlesAt: 93.48,
    scope: "[data-slot='app-splash']",
    texts: { '.sp-name': "[data-splash='name']", '.sp-slogan': "[data-splash='slogan']" },
  },
]

const WAITING_PIECES = {
  '#k-ampulheta': 'owl-wait-turn',
  '#k-hourglass': 'owl-wait-turn',
  '#k-zz': 'owl-wait-rise',
}

const WAITING_KEYFRAMES = `@keyframes owl-wait-turn {
  0%, 20% { transform: rotate(0); }
  60%, 100% { transform: rotate(180deg); }
}

@keyframes owl-wait-rise {
  0% { opacity: 0.2; transform: translateY(4px); }
  70% { opacity: 1; transform: translateY(-6px); }
  100% { opacity: 0; transform: translateY(-12px); }
}
`

function demoStyles(demo) {
  const html = readFileSync(`${DEMO_FOLDER}/${demo}`, 'utf8')
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n')
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
}

function keyframesOf(css) {
  const keyframes = new Map()
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    const stops = []
    for (const stop of match[2].matchAll(/([\d.%,\s]+)\{([^{}]*)\}/g)) {
      for (const offset of stop[1].split(',')) {
        stops.push({ at: Number.parseFloat(offset), declarations: stop[2].trim() })
      }
    }
    keyframes.set(
      match[1],
      stops.sort((a, b) => a.at - b.at),
    )
  }
  return keyframes
}

function rulesOf(css) {
  const withoutKeyframes = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, '')
  return [...withoutKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((selector) => selector.trim()),
    declarations: match[2]
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean),
  }))
}

function round(value) {
  return Number(value.toFixed(DECIMALS))
}

function window(stops, kit) {
  const before = stops.filter((stop) => stop.at <= kit.startsAt).at(-1) ?? stops[0]
  const inside = stops.filter((stop) => stop.at > kit.startsAt && stop.at <= kit.settlesAt)
  const span = kit.settlesAt - kit.startsAt
  const frames = [{ ...before, at: kit.startsAt }, ...inside].map((stop) => ({
    at: round(((stop.at - kit.startsAt) / span) * PERCENT),
    declarations: stop.declarations,
  }))
  const last = frames.at(-1)
  return last.at < PERCENT ? [...frames, { at: PERCENT, declarations: last.declarations }] : frames
}

function animationOf(declarations) {
  const animation = declarations.find((declaration) => declaration.startsWith('animation:'))
  if (!animation) {
    return null
  }
  const [name, , ...rest] = animation
    .replace('animation:', '')
    .trim()
    .split(/\s+(?![^(]*\))/)
  const timing = rest.filter((part) => part !== 'infinite').join(' ') || 'linear'
  return { name, timing }
}

function scope(kit, phase) {
  const kitScope = kit.scope ?? `[data-owl-kit='${kit.name}']`
  return kit.isPhased ? `${kitScope}[data-phase='${phase}']` : kitScope
}

function entranceDelay(keyframes, rules, kit, selector) {
  const rule = rules.find((candidate) => candidate.selectors.includes(selector))
  const animation = rule && animationOf(rule.declarations)
  const stops = animation && keyframes.get(animation.name)
  if (!stops) {
    return 0
  }
  const hidden = stops.filter(
    (stop) =>
      stop.at >= kit.startsAt && stop.declarations.includes('opacity:0') && stop.at < kit.demoEnd,
  )
  const lastHidden = hidden.at(-1)
  return lastHidden ? round(((lastHidden.at - kit.startsAt) / PERCENT) * kit.seconds) : 0
}

function lastChange(stops, startsAt, settlesAt) {
  const inside = stops.filter((stop) => stop.at >= startsAt && stop.at <= settlesAt)
  const changes = inside.filter(
    (stop, index) => index > 0 && stop.declarations !== inside[index - 1].declarations,
  )
  return changes.at(-1)?.at ?? startsAt
}

function settledKit(kit, keyframes, rules) {
  const animated = rules
    .filter((rule) => rule.selectors.some((selector) => isPiece(kit, selector)))
    .map((rule) => animationOf(rule.declarations))
    .filter(Boolean)
  const settlesAt = Math.max(
    ...animated.map(({ name }) =>
      lastChange(keyframes.get(name) ?? [], kit.startsAt, kit.settlesAt),
    ),
  )
  return { ...kit, settlesAt, demoEnd: kit.settlesAt }
}

function isPiece(kit, selector) {
  return PIECE_SELECTOR.test(selector) || selector in (kit.texts ?? {})
}

function pieceLines(kit, keyframes, seconds, piece, rule) {
  const target = kit.texts?.[piece] ?? piece
  const lines = []
  const fixed = rule.declarations.filter((declaration) => !declaration.startsWith('animation'))
  if (fixed.length > 0 && target === piece) {
    lines.push(`${scope(kit, 'after')} ${target} { ${fixed.join('; ')}; }`)
  }
  const animation = animationOf(rule.declarations)
  const stops = animation && keyframes.get(animation.name)
  if (!stops) {
    return lines
  }
  const frames = window(stops, kit)
  const keyframeName = `owl-${kit.name}-${piece.replace(/^[.#]/, '')}`
  const keyframeStops = frames.map((frame) => `${frame.at}% { ${frame.declarations} }`).join(' ')
  lines.push(`@keyframes ${keyframeName} { ${keyframeStops} }`)
  if (kit.isPhased) {
    const waiting = WAITING_PIECES[piece]
    const start = waiting
      ? `animation: ${waiting} 1.2s ease-in-out infinite`
      : frames[0].declarations
    lines.push(`${scope(kit, 'before')} ${target} { ${start}; }`)
  }
  lines.push(
    `${scope(kit, 'after')} ${target} { animation: ${keyframeName} ${seconds}s ${animation.timing} both; }`,
  )
  return lines
}

function momentDelays(kit, keyframes, rules) {
  const textDelay = entranceDelay(keyframes, rules, kit, '.tw-st-b')
  const actionsDelay = entranceDelay(keyframes, rules, kit, '.tw-st-c')
  return `${MOMENT}:has(${scope(kit, 'after')}) { --moment-text-delay: ${textDelay}s; --moment-actions-delay: ${actionsDelay}s; }`
}

function kitSource(demoKit) {
  const css = demoStyles(demoKit.demo)
  const keyframes = keyframesOf(css)
  const rules = rulesOf(css)
  const kit = settledKit(demoKit, keyframes, rules)
  const seconds = round(((kit.settlesAt - kit.startsAt) / PERCENT) * kit.seconds)
  const kitScope = scope(kit, 'after').replace(/\[data-phase=[^\]]+\]/, '')
  const lines = [`${kitScope} svg g { transform-box: fill-box; transform-origin: center; }`]
  for (const rule of rules.filter(
    (candidate) => !candidate.selectors.includes(ALL_PIECES_SELECTOR),
  )) {
    for (const piece of rule.selectors.filter((selector) => isPiece(kit, selector))) {
      lines.push(...pieceLines(kit, keyframes, seconds, piece, rule))
    }
  }
  if (!kit.texts) {
    lines.push(momentDelays(kit, keyframes, rules))
  }
  return lines.join('\n')
}

function generatedSource() {
  return `${WAITING_KEYFRAMES}\n${KITS.map(kitSource).join('\n\n')}\n`
}

function currentSource() {
  try {
    return readFileSync(OUTPUT_FILE, 'utf8')
  } catch {
    return ''
  }
}

const source = generatedSource()
if (process.argv.includes(CHECK_FLAG)) {
  if (currentSource() !== source) {
    console.error(`${OUTPUT_FILE} is out of date with the motion demos. Run pnpm gen:owl-motion.`)
    process.exit(1)
  }
  console.log('Owl motion matches the design demos.')
} else {
  writeFileSync(OUTPUT_FILE, source)
  console.log(`Wrote ${OUTPUT_FILE} from ${KITS.length} motion demos.`)
}
