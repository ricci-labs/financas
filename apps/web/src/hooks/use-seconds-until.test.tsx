import { useSecondsUntil } from '@web/hooks/use-seconds-until'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

const ONE_MINUTE_MS = 60_000

function SecondsLeft({ untilMs }: { untilMs: number | null }) {
  return <output>{useSecondsUntil(untilMs)}</output>
}

describe('useSecondsUntil', () => {
  it('shows a full minute as 60 seconds, never 61', async () => {
    const screen = await render(<SecondsLeft untilMs={Date.now() + ONE_MINUTE_MS} />)
    expect(screen.getByRole('status').element().textContent).toBe('60')
  })

  it('is zero when there is nothing to wait for', async () => {
    const screen = await render(<SecondsLeft untilMs={null} />)
    await expect.element(screen.getByRole('status')).toHaveTextContent('0')
  })
})
