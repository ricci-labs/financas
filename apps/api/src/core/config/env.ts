import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const DEFAULT_SMTP_PORT = 587
const DEFAULT_EMAIL_FROM_NAME = 'Finanças'
const DEFAULT_EMAIL_OUTBOX_DIR = '.private/outbox'
const DEFAULT_PUBLIC_URL = 'http://localhost:5173'
const MAX_PROXY_HOPS = 3
const REQUIRED_IN_PRODUCTION = ['PUBLIC_URL', 'SMTP_HOST', 'EMAIL_FROM'] as const

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3100),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    APP_VERSION: z.string().min(1).default('dev'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),
    PUBLIC_SIGNUP_ENABLED: z.stringbool().default(false),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(MAX_PROXY_HOPS).default(0),
    LOGIN_MAX_FAILURES_PER_EMAIL: z.coerce.number().int().min(1).default(5),
    LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().min(1).default(30),
    LOGIN_FAILURE_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_SMTP_PORT),
    SMTP_SECURE: z.stringbool().optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    EMAIL_FROM: z.email().optional(),
    EMAIL_FROM_NAME: z.string().min(1).default(DEFAULT_EMAIL_FROM_NAME),
    EMAIL_OUTBOX_DIR: z.string().min(1).default(DEFAULT_EMAIL_OUTBOX_DIR),
  })
  .superRefine((env, context) => {
    const hasUser = env.SMTP_USER !== undefined
    const hasPassword = env.SMTP_PASSWORD !== undefined
    if (hasUser !== hasPassword) {
      context.addIssue({
        code: 'custom',
        path: [hasUser ? 'SMTP_PASSWORD' : 'SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASSWORD must be set together',
      })
    }
    if (env.NODE_ENV !== 'production') {
      return
    }
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (env[name] === undefined) {
        context.addIssue({ code: 'custom', path: [name], message: 'required in production' })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

export function publicUrlOf(env: Pick<Env, 'PUBLIC_URL'>): string {
  return env.PUBLIC_URL ?? DEFAULT_PUBLIC_URL
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (result.success) {
    return result.data
  }

  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  throw new Error(`Invalid environment: ${problems.join('; ')}`)
}
