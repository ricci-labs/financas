export declare const SEMANTIC_TOKENS_FILE: string

export declare function readThemeValues(
  file?: string,
): Record<'light' | 'dark', Record<string, string>>

export declare function resolveColor(values: Record<string, string>, name: string): string
