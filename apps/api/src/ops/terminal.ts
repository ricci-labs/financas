import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import type { Terminal } from '@api/ops/ops.types'

export function openTerminal(): Terminal {
  let isEchoMuted = false
  const echo = new Writable({
    write(chunk, _encoding, done) {
      if (!isEchoMuted) {
        process.stdout.write(chunk)
      }
      done()
    },
  })
  const reader = createInterface({
    input: process.stdin,
    output: echo,
    terminal: process.stdin.isTTY === true,
  })
  const lines = reader[Symbol.asyncIterator]()

  async function nextLine(): Promise<string> {
    const line = await lines.next()
    if (line.done) {
      throw new Error('The input ended before every answer was given')
    }
    return line.value
  }

  async function ask(question: string): Promise<string> {
    process.stdout.write(question)
    return nextLine()
  }

  async function askSecret(question: string): Promise<string> {
    process.stdout.write(question)
    isEchoMuted = true
    try {
      return await nextLine()
    } finally {
      isEchoMuted = false
      process.stdout.write('\n')
    }
  }

  return {
    ask,
    askSecret,
    say: (message) => process.stdout.write(`${message}\n`),
    close: () => reader.close(),
  }
}
