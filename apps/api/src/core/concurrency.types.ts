export type ConcurrencyLimit = <T>(work: () => Promise<T>) => Promise<T>
