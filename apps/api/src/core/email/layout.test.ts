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
