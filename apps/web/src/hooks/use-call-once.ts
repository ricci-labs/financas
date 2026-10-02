import { useEffect, useRef } from 'react'

export function useCallOnce<Value>(value: Value | null, call: (value: Value) => void): void {
  const hasCalled = useRef(false)

  useEffect(() => {
    if (value === null || hasCalled.current) {
      return
    }
    hasCalled.current = true
    call(value)
  }, [value, call])
}
