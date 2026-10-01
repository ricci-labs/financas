import { escapeHtml, renderEmail } from '@api/core/email/layout'
import { describe, expect, it } from 'vitest'

const CONTENT = {
  heading: 'Olá, <b>Member A</b>',
  paragraphs: ['First paragraph', 'Tom & Jerry "quoted"'],
  action: { label: 'Open', url: 'https://example.test/path#token=abc' },
  notes: ['A note'],
}

describe('escapeHtml', () => {
  it('escapes every character that could start markup or leave an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })
})

describe('renderEmail', () => {
  it('writes a plain-text version with the link spelled out', () => {
    expect(renderEmail(CONTENT).text).toBe(
      [
        'Olá, <b>Member A</b>',
        'First paragraph',
        'Tom & Jerry "quoted"',
        'Open: https://example.test/path#token=abc',
        'A note',
      ].join('\n\n'),
    )
  })

  it('never lets content become markup in the HTML version', () => {
    const { html } = renderEmail(CONTENT)
    expect(html).toContain('Olá, &lt;b&gt;Member A&lt;/b&gt;')
    expect(html).toContain('Tom &amp; Jerry &quot;quoted&quot;')
    expect(html).not.toContain('<b>')
    expect(html).toContain('href="https://example.test/path#token=abc"')
  })
})

const RICH_CONTENT = {
  preheader: 'A <short> preview',
  illustration: 'envelope' as const,
  greeting: 'Olá, Member A!',
  heading: 'Confirme seu e-mail',
  paragraphs: [
    [
      'Esqueceu a senha? ',
      { link: { label: 'Peça uma nova', url: 'https://app.example.test/forgot-password' } },
      ' ou fale com ',
      { strong: 'Casa <b>' },
      '.',
    ],
  ],
  action: { label: 'Confirmar e-mail', url: 'https://app.example.test/verify-email#token=abc' },
  notes: ['O link vale por 24 horas.'],
  reason: 'Você recebeu este e-mail porque alguém criou uma conta.',
}

describe('renderEmail with the account layout', () => {
  it('puts the greeting first and spells inline links out in the text version', () => {
    expect(renderEmail(RICH_CONTENT).text).toBe(
      [
        'Olá, Member A!',
        'Confirme seu e-mail',
        'Esqueceu a senha? Peça uma nova (https://app.example.test/forgot-password) ou fale com Casa <b>.',
        'Confirmar e-mail: https://app.example.test/verify-email#token=abc',
        'O link vale por 24 horas.',
      ].join('\n\n'),
    )
  })

  it('renders inline links and emphasis, and escapes them', () => {
    const { html } = renderEmail(RICH_CONTENT)
    expect(html).toContain('href="https://app.example.test/forgot-password"')
    expect(html).toContain('>Peça uma nova</a>')
    expect(html).toContain('<strong>Casa &lt;b&gt;</strong>')
  })

  it('loads the images from the same origin as the action link', () => {
    const { html } = renderEmail(RICH_CONTENT)
    expect(html).toContain('src="https://app.example.test/email/owl-envelope.png"')
    expect(html).toContain('src="https://app.example.test/email/twise-logo.png"')
  })

  it('shows the preheader, the fallback address and the reason', () => {
    const { html } = renderEmail(RICH_CONTENT)
    expect(html).toContain('A &lt;short&gt; preview')
    expect(html).toContain('Se o botão não abrir, copie este endereço no navegador:')
    expect(html).toContain('>https://app.example.test/verify-email#token=abc</a>')
    expect(html).toContain('Você recebeu este e-mail porque alguém criou uma conta.')
  })

  it('leaves out the illustration band when there is none', () => {
    expect(renderEmail(CONTENT).html).not.toContain('/email/owl-')
  })
})
