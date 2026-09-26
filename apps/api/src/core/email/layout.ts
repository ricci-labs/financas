import type { EmailContent, RenderedEmail } from '@api/core/email/email.types'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const BODY_STYLE =
  'margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917'
const CARD_STYLE = 'max-width:480px;margin:0 auto;padding:24px;background:#ffffff;border-radius:8px'
const BUTTON_STYLE =
  'display:inline-block;padding:12px 20px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:6px'
const NOTE_STYLE = 'font-size:13px;color:#57534e'

export function renderEmail(content: EmailContent): RenderedEmail {
  return { text: renderText(content), html: renderHtml(content) }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}

function renderText({ heading, paragraphs, action, notes }: EmailContent): string {
  return [heading, ...paragraphs, `${action.label}: ${action.url}`, ...notes].join('\n\n')
}

function renderHtml({ heading, paragraphs, action, notes }: EmailContent): string {
  const body = [
    `<h1 style="font-size:20px">${escapeHtml(heading)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p><a href="${escapeHtml(action.url)}" style="${BUTTON_STYLE}">${escapeHtml(action.label)}</a></p>`,
    ...notes.map((note) => `<p style="${NOTE_STYLE}">${escapeHtml(note)}</p>`),
  ].join('')
  return `<!doctype html><html><body style="${BODY_STYLE}"><div style="${CARD_STYLE}">${body}</div></body></html>`
}
