import { BRAND_COLORS } from '@api/core/email/brand-colors.gen'
import type {
  EmailContent,
  EmailIllustration,
  EmailParagraph,
  EmailSpan,
  RenderedEmail,
} from '@api/core/email/email.types'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const EMAIL_IMAGES_PATH = '/email/'
const ILLUSTRATION_FILES: Record<EmailIllustration, string> = {
  envelope: 'owl-envelope.png',
  welcome: 'owl-welcome.png',
  key: 'owl-key.png',
  padlock: 'owl-padlock.png',
  invitation: 'owl-invitation.png',
}
const LOGO_FILE = 'twise-logo.png'
const LOGO_ALT = 'twise'
const LOGO_HEIGHT_PX = 28
const ILLUSTRATION_HEIGHT_PX = 172
const FALLBACK_LINE = 'Se o botão não abrir, copie este endereço no navegador:'
const FOOTER_BRAND = 'Twise'
const FOOTER_SLOGAN = ' · Leve, claro, a dois.'

const SANS = 'Figtree,Arial,Helvetica,sans-serif'
const DISPLAY = "'Bricolage Grotesque',Arial,Helvetica,sans-serif"
const STYLES = {
  body: `margin:0;padding:0;background:${BRAND_COLORS.page}`,
  preheader: 'display:none;max-height:0;overflow:hidden;opacity:0',
  outer: `background:${BRAND_COLORS.page};padding:28px 16px 32px;font-family:${SANS};color:${BRAND_COLORS.ink}`,
  card: `background:${BRAND_COLORS.surface};border:1px solid ${BRAND_COLORS.border};border-radius:20px;overflow:hidden`,
  art: `background:${BRAND_COLORS.mint};height:188px;padding-top:16px;text-align:center;vertical-align:bottom`,
  content: 'padding:28px 32px 8px',
  greeting: `margin:0 0 6px;font-size:15px;line-height:22px;color:${BRAND_COLORS.inkMuted}`,
  heading: `margin:0 0 12px;font-family:${DISPLAY};font-weight:750;font-size:28px;line-height:34px;letter-spacing:-0.02em;color:${BRAND_COLORS.ink}`,
  paragraph: 'margin:0 0 12px;font-size:16px;line-height:24px',
  button: `display:inline-block;margin:8px 0 4px;padding:13px 26px;border-radius:999px;background:${BRAND_COLORS.actionPrimary};color:${BRAND_COLORS.onActionPrimary};font-weight:650;font-size:16px;line-height:22px;text-decoration:none`,
  fallback: `margin:12px 0 0;font-size:13px;line-height:18px;color:${BRAND_COLORS.inkMuted};word-break:break-all`,
  link: `color:${BRAND_COLORS.mintInk};font-weight:600`,
  notes: `margin:20px 32px 0;padding:16px 0 24px;border-top:1px solid ${BRAND_COLORS.border}`,
  note: `margin:0 0 6px;font-size:13px;line-height:19px;color:${BRAND_COLORS.inkMuted}`,
  footer: `padding:16px 0 0;font-size:12px;line-height:18px;color:${BRAND_COLORS.inkSubtle};text-align:center`,
  footerBrand: `color:${BRAND_COLORS.ink}`,
}

export function renderEmail(content: EmailContent): RenderedEmail {
  return { text: renderText(content), html: renderHtml(content) }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}

function renderText({ greeting, heading, paragraphs, action, notes }: EmailContent): string {
  return [
    greeting,
    heading,
    ...paragraphs.map(paragraphText),
    `${action.label}: ${action.url}`,
    ...notes,
  ]
    .filter((block) => block !== undefined)
    .join('\n\n')
}

function paragraphText(paragraph: EmailParagraph): string {
  return spansOf(paragraph).map(spanText).join('')
}

function spanText(span: EmailSpan): string {
  if (typeof span === 'string') {
    return span
  }
  if ('strong' in span) {
    return span.strong
  }
  return `${span.link.label} (${span.link.url})`
}

function spansOf(paragraph: EmailParagraph): readonly EmailSpan[] {
  return typeof paragraph === 'string' ? [paragraph] : paragraph
}

function renderHtml(content: EmailContent): string {
  const imagesUrl = new URL(EMAIL_IMAGES_PATH, content.action.url)
  const preheader = content.preheader
    ? `<div style="${STYLES.preheader}">${escapeHtml(content.preheader)}</div>`
    : ''
  const rows = [
    `<tr><td style="padding:0 0 16px"><img src="${imageUrl(imagesUrl, LOGO_FILE)}" height="${LOGO_HEIGHT_PX}" alt="${LOGO_ALT}" style="display:block;border:0"></td></tr>`,
    `<tr><td style="${STYLES.card}">${cardHtml(content, imagesUrl)}</td></tr>`,
    `<tr><td style="${STYLES.footer}">${footerHtml(content.reason)}</td></tr>`,
  ].join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head><body style="${STYLES.body}">${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="${STYLES.outer}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">${rows}</table></td></tr></table></body></html>`
}

function cardHtml(content: EmailContent, imagesUrl: URL): string {
  const art = content.illustration
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${STYLES.art}"><img src="${imageUrl(imagesUrl, ILLUSTRATION_FILES[content.illustration])}" height="${ILLUSTRATION_HEIGHT_PX}" alt="" style="display:inline-block;border:0"></td></tr></table>`
    : ''
  const greeting = content.greeting
    ? `<p style="${STYLES.greeting}">${escapeHtml(content.greeting)}</p>`
    : ''
  const action = escapeHtml(content.action.url)
  const body = [
    greeting,
    `<h1 style="${STYLES.heading}">${escapeHtml(content.heading)}</h1>`,
    ...content.paragraphs.map(
      (paragraph) => `<p style="${STYLES.paragraph}">${paragraphHtml(paragraph)}</p>`,
    ),
    `<a href="${action}" style="${STYLES.button}">${escapeHtml(content.action.label)}</a>`,
    `<p style="${STYLES.fallback}">${FALLBACK_LINE}<br><a href="${action}" style="${STYLES.link}">${action}</a></p>`,
  ].join('')
  const notes = content.notes.map((note) => `<p style="${STYLES.note}">${escapeHtml(note)}</p>`)
  return `${art}<div style="${STYLES.content}">${body}</div><div style="${STYLES.notes}">${notes.join('')}</div>`
}

function paragraphHtml(paragraph: EmailParagraph): string {
  return spansOf(paragraph).map(spanHtml).join('')
}

function spanHtml(span: EmailSpan): string {
  if (typeof span === 'string') {
    return escapeHtml(span)
  }
  if ('strong' in span) {
    return `<strong>${escapeHtml(span.strong)}</strong>`
  }
  return `<a href="${escapeHtml(span.link.url)}" style="${STYLES.link}">${escapeHtml(span.link.label)}</a>`
}

function footerHtml(reason: string | undefined): string {
  const brand = `<strong style="${STYLES.footerBrand}">${FOOTER_BRAND}</strong>${FOOTER_SLOGAN}`
  return reason ? `${brand}<br>${escapeHtml(reason)}` : brand
}

function imageUrl(imagesUrl: URL, file: string): string {
  return escapeHtml(new URL(file, imagesUrl).toString())
}
